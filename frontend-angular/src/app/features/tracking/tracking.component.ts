import { Component, inject, signal, OnInit, AfterViewInit, OnDestroy, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RutasService } from '../../core/services/rutas.service';
import { TurnosService } from '../../core/services/turnos.service';
import { TrackingService, BusActivo, AlertaRetraso } from '../../core/services/tracking.service';
import { TrackingEtaService, EtaBus } from '../../core/services/tracking-eta.service';
import { NotificationService } from '../../core/services/notification.service';
import { Ruta, ParaderoEnRuta } from '../../core/models/negocio.models';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tracking',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatProgressBarModule,
    MatTooltipModule, MatSlideToggleModule, MatInputModule,
  ],
  templateUrl: './tracking.component.html',
  styleUrls: ['./tracking.component.scss'],
})
export class TrackingComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly rutasSvc        = inject(RutasService);
  private readonly turnosSvc       = inject(TurnosService);
  private readonly trackingSvc     = inject(TrackingService);
  private readonly etaSvc          = inject(TrackingEtaService);
  private readonly notificationSvc = inject(NotificationService);
  private readonly router          = inject(Router);

  private map!: L.Map;
  private busMarkers    = new Map<number, L.Marker>();
  private paraderoLayers: L.Marker[] = [];
  private subs: Subscription[] = [];
  private pollingTimer?: ReturnType<typeof setInterval>;
  private tickTimer?:    ReturnType<typeof setInterval>;
  private etaTimer?:     ReturnType<typeof setInterval>;

  private notifiedBuses = new Set<string>();

  // Removido cache de motivosRetraso ya que el backend lo envía en BusActivo

  rutas               = signal<Ruta[]>([]);
  rutaSeleccionada    = signal<Ruta | null>(null);
  busesActivos        = signal<BusActivo[]>([]);
  paraderoEspera      = signal<ParaderoEnRuta | null>(null);
  paraderosDeLaRuta   = signal<ParaderoEnRuta[]>([]);
  cargando            = signal(false);
  ultimaActualizacion = signal<Date | null>(null);
  segundosDesdeActual = signal<number | null>(null);
  etasBuses           = signal<EtaBus[]>([]);
  busSeleccionado     = signal<BusActivo | null>(null);
  alertasRetraso      = signal<AlertaRetraso[]>([]);
  minutosAlerta       = signal<number>(10);
  alertaActiva        = signal(false);
  suscripcionKey      = signal<string | null>(null);
  suscribiendose      = signal(false);

  alertaInterna = signal<{ busId: number; placa: string; rutaNombre: string; paraderoNombre: string; eta: number; } | null>(null);
  alertaBannerCerrado = signal<boolean>(false);
  mostrarVistaAlerta  = signal<boolean>(false);
  canalNotificacion   = signal<'push'>('push');

  estadoPermisoPush = signal<NotificationPermission>('default');

  // Paso 4: filtro de rutas activas
  soloRutasActivas    = signal<boolean>(false);

  // Demo
  lanzandoDemo  = signal<boolean>(false);
  mensajeDemo   = signal<string | null>(null);
  demoOk        = signal<boolean>(false);

  // Paso 5: countdown suave — valores locales que se decrementan cada segundo
  etaCountdown        = signal<number | null>(null);  // para el card ETA grande
  etaDetailCountdown  = signal<number | null>(null);  // para el detalle del bus

  /** ETA grande con countdown suave aplicado (o fallback al valor calculado). */
  readonly etaDisplay = computed<number | null>(() => {
    const cd = this.etaCountdown();
    if (cd !== null) return Math.max(0, cd);
    return this.etaMenor()?.t ?? null;
  });

  /** ETA del bus seleccionado con countdown suave. */
  readonly etaDetailDisplay = computed<number | null>(() => {
    const cd = this.etaDetailCountdown();
    if (cd !== null) return Math.max(0, cd);
    return this.etaDelBusSeleccionado()?.tiempoLlegadaMinutos ?? null;
  });

  constructor() {
    effect(() => {
      const paradero = this.paraderoEspera();
      const ruta = this.rutaSeleccionada();
      if (paradero?.paraderoId && ruta?.id) {
        this.startEtaPolling(ruta.id, paradero.paraderoId);
      } else {
        this.stopEtaPolling();
        this.etasBuses.set([]);
      }
    });
  }

  readonly busesRetrasados = computed(() =>
    this.busesActivos().filter(b => {
      const t = this.calcularTiempoLlegada(b, this.paraderoEspera());
      return t > 10;
    })
  );

  readonly busesRetrasadosEta = computed(() =>
    this.etasBuses().filter(b => b.retrasado)
  );

  /** Buses con retraso reportado directamente por el backend (independiente del polling de ETA). */
  readonly busesConRetrasoActivo = computed(() =>
    this.busesActivos().filter(b => b.retrasado)
  );

  readonly etaMenor = computed<{ bus: BusActivo; t: number } | null>(() => {
    const paradero = this.paraderoEspera();
    if (!paradero) return null;
    let best: { bus: BusActivo; t: number } | null = null;
    for (const bus of this.busesActivos()) {
      const t = this.calcularTiempoLlegada(bus, paradero);
      if (t >= 0 && (best === null || t < best.t)) {
        best = { bus, t };
      }
    }
    return best;
  });

  readonly horaEstimada = computed(() => {
    const eta = this.etaMenor();
    if (!eta) return null;
    const d = new Date();
    d.setMinutes(d.getMinutes() + eta.t);
    return d;
  });

  readonly etaDelBusSeleccionado = computed(() => {
    const sel = this.busSeleccionado();
    if (!sel) return null;
    return this.etasBuses().find(b => b.busId === sel.busId) ?? null;
  });

  readonly distanciaAlBus = computed<string>(() => {
    const bus = this.busSeleccionado();
    const paradero = this.paraderoEspera();
    if (!bus || bus.lat == null || bus.lng == null || !paradero?.latitud || !paradero?.longitud) return '—';
    const km = this.haversineKm(bus.lat, bus.lng, paradero.latitud, paradero.longitud);
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  });

  readonly mejorEtaBus = computed<{ bus: BusActivo; minutos: number } | null>(() => {
    const paradero = this.paraderoEspera();
    if (!paradero) return null;
    let best: { bus: BusActivo; minutos: number } | null = null;
    for (const bus of this.busesActivos()) {
      const t = this.calcularTiempoLlegada(bus, paradero);
      if (t >= 0 && (best === null || t < best.minutos)) {
        best = { bus, minutos: t };
      }
    }
    return best;
  });

  ngOnInit(): void {
    if ('Notification' in window) {
      this.estadoPermisoPush.set(Notification.permission);
    }

    this.cargarRutas();

    const wsSub = this.trackingSvc.onBusesActualizados().subscribe(data => {
      if (data.rutaId === this.rutaSeleccionada()?.id) {
        this.procesarBuses(data.buses);
      }
    });

    const alertaSub = this.trackingSvc.onAlertaRetraso().subscribe(alerta => {
      this.alertasRetraso.update(a => {
        const exists = a.some(x => x.busId === alerta.busId);
        return exists ? a : [alerta, ...a].slice(0, 5);
      });
    });

    this.subs.push(wsSub, alertaSub);

    // Countdown suave: tick cada 1 segundo
    this.tickTimer = setInterval(() => {
      const last = this.ultimaActualizacion();
      if (last) {
        this.segundosDesdeActual.set(Math.round((Date.now() - last.getTime()) / 1000));
      }
      // Decrementar ETA local 1 segundo = 1/60 de minuto
      this.etaCountdown.update(v => v !== null ? Math.max(0, v - 1 / 60) : null);
      this.etaDetailCountdown.update(v => v !== null ? Math.max(0, v - 1 / 60) : null);
    }, 1000);
  }

  /** Carga rutas según el toggle activo/todas. */
  private cargarRutas(): void {
    const obs = this.soloRutasActivas() ? this.rutasSvc.listActivas() : this.rutasSvc.list();
    obs.subscribe(r => this.rutas.set(r));
  }

  /** Toggle "Solo rutas activas" — recarga la lista de rutas. */
  toggleSoloRutasActivas(valor: boolean): void {
    this.soloRutasActivas.set(valor);
    this.cargarRutas();
  }

  /** Lanza el simulador de buses desde el backend. */
  lanzarDemo(): void {
    this.lanzandoDemo.set(true);
    this.trackingSvc.iniciarDemo().subscribe({
      next: res => {
        this.demoOk.set(res.busesSimulados > 0);
        this.mensajeDemo.set(res.mensaje);
        this.lanzandoDemo.set(false);
        // Si hay ruta seleccionada, recarga los buses
        const ruta = this.rutaSeleccionada();
        if (ruta?.id) setTimeout(() => this.fetchBuses(ruta.id!), 1500);
      },
      error: () => {
        this.mensajeDemo.set('Error al iniciar la demo. Revisa que el backend esté corriendo.');
        this.demoOk.set(false);
        this.lanzandoDemo.set(false);
      },
    });
  }

  cerrarDemo(): void {
    this.mensajeDemo.set(null);
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initMap();
      setTimeout(() => {
        if (this.map) this.map.invalidateSize();
      }, 300);
    }, 200);
  }

  abrirVistaAlerta(): void {
    this.mostrarVistaAlerta.set(true);
  }

  cerrarVistaAlerta(): void {
    this.mostrarVistaAlerta.set(false);
  }

  cerrarBanner(): void {
    this.alertaBannerCerrado.set(true);
  }

  refreshBuses(): void {
    const ruta = this.rutaSeleccionada();
    if (ruta?.id) this.fetchBuses(ruta.id);
  }

  onRutaChange(ruta: Ruta | null): void {
    this.cancelarAlerta();
    this.alertaBannerCerrado.set(false);
    this.alertaActiva.set(false);
    this.rutaSeleccionada.set(ruta);
    this.paraderoEspera.set(null);
    this.busesActivos.set([]);
    this.paraderosDeLaRuta.set([]);
    this.busSeleccionado.set(null);
    this.alertasRetraso.set([]);
    this.etaCountdown.set(null);
    this.etaDetailCountdown.set(null);
    this.notifiedBuses.clear();
    this.alertaInterna.set(null);
    this.limpiarMapa();

    if (!ruta?.id) return;

    this.rutasSvc.getMapa(ruta.id).subscribe(mapa => {
      const paraderos = mapa.paraderos ?? [];
      this.paraderosDeLaRuta.set(paraderos);
      if (paraderos.length > 0) {
        this.paraderoEspera.set(paraderos[0]);
      }
      this.renderParaderoMarkers(paraderos);
    });

    this.trackingSvc.joinRuta(ruta.id);

    if (this.pollingTimer) clearInterval(this.pollingTimer);
    this.fetchBuses(ruta.id);
    this.pollingTimer = setInterval(() => this.fetchBuses(ruta.id!), 10_000);
  }

  hasGps(bus: BusActivo): boolean {
    return bus.lat != null && bus.lat !== 0 && bus.lng != null && bus.lng !== 0;
  }

  calcularTiempoLlegada(bus: BusActivo, paraderoDestino: ParaderoEnRuta | null): number {
    const paraderoOrigen = bus.paraderoMasCercano;
    if (!paraderoOrigen || !paraderoDestino) return -1;

    const paraderos = this.paraderosDeLaRuta();
    const idxOrigen  = paraderos.findIndex(p => p.paraderoId === paraderoOrigen.id);
    const idxDestino = paraderos.findIndex(p => p.paraderoId === paraderoDestino.paraderoId);

    if (idxOrigen === -1 || idxDestino === -1) return -1;
    if (idxOrigen >= idxDestino) return 0;

    let minutos = 0;
    for (let i = idxOrigen; i < idxDestino; i++) {
      minutos += paraderos[i + 1]?.tiempoEstimadoDesdeAnteriorMinutos ?? 5;
    }
    return minutos;
  }

  formatTiempo(bus: BusActivo): string {
    const t = this.calcularTiempoLlegada(bus, this.paraderoEspera());
    if (t < 0) return 'Calculando...';
    if (t === 0) return 'Llegando';
    return `${t} min`;
  }

  seleccionarBus(bus: BusActivo): void {
    this.busSeleccionado.set(this.busSeleccionado()?.busId === bus.busId ? null : bus);
  }

  cerrarDetalle(): void {
    this.busSeleccionado.set(null);
  }

  /** Indica si algún bus activo tiene este paradero como el más cercano. */
  esParaderoMasCercanoAlgunBus(paraderoId: number | undefined): boolean {
    return this.busesActivos().some(b => b.paraderoMasCercano?.id === paraderoId);
  }

  getProximoParadero(bus: BusActivo): string {
    const masCercano = bus.paraderoMasCercano;
    if (!masCercano) return 'Calculando...';

    const paraderos = this.paraderosDeLaRuta();
    const siguiente = paraderos
      .filter(p => (p.orden ?? 0) > masCercano.orden)
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))[0];

    return siguiente?.nombre ?? 'Fin de ruta';
  }

  cerrarAlerta(busId: number): void {
    this.alertasRetraso.update(a => a.filter(x => x.busId !== busId));
  }

  horaLlegada(minutos: number): string {
    const d = new Date(Date.now() + minutos * 60000);
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  /** Mensaje de alerta combinando minutos de retraso y motivo. */
  mensajeAlertaRetraso(bus: BusActivo): string {
    if (bus.motivoRetraso) return bus.motivoRetraso;
    if (bus.minutosRetraso != null) return `Lleva ${bus.minutosRetraso} min de retraso`;
    return 'Presenta retraso en su recorrido';
  }

  // Se removió actualizarMotivoRetraso porque el backend ahora envía la info en BusActivo.

  solicitarPermisoPush(): void {
    if (!('Notification' in window)) return;
    Notification.requestPermission().then(permission => {
      this.estadoPermisoPush.set(permission);
    });
  }

  suscribirAlerta(): void {
    const ruta = this.rutaSeleccionada();
    const paradero = this.paraderoEspera();
    if (!ruta || !paradero) return;

    this.suscribiendose.set(true);
    const dto = {
      ciudadanoEmail: 'push@app.local', // Dummy email ya que ahora es 100% push
      rutaId: ruta.id,
      paraderoId: paradero.paraderoId,
      paraderoNombre: paradero.nombre,
      rutaNombre: ruta.nombre,
      minutosAnticipacion: this.minutosAlerta(),
    };
    this.trackingSvc.suscribirBusProximo(dto).subscribe({
      next: res => {
        this.suscripcionKey.set(res.key);
        this.notificationSvc.success(res.mensaje);
        this.suscribiendose.set(false);
        if (this.estadoPermisoPush() === 'default') {
          this.solicitarPermisoPush();
        }
      },
      error: () => {
        this.notificationSvc.error('No se pudo activar la alerta');
        this.suscribiendose.set(false);
      },
    });
  }

  cancelarAlerta(): void {
    const key = this.suscripcionKey();
    if (!key) return;
    this.trackingSvc.cancelarSuscripcion(key).subscribe({
      next: () => {
        this.suscripcionKey.set(null);
        this.notifiedBuses.clear();
        this.alertaInterna.set(null);
        this.notificationSvc.info('Alerta cancelada');
      },
      error: () => this.notificationSvc.error('No se pudo cancelar la alerta'),
    });
  }

  private fetchBuses(rutaId: number): void {
    this.cargando.set(true);
    this.trackingSvc.getBusesRuta(rutaId).subscribe({
      next: buses => {
        this.procesarBuses(buses);
        this.cargando.set(false);
      },
      error: () => this.fetchBusesFromTurnos(rutaId),
    });
  }

  private fetchBusesFromTurnos(rutaId: number): void {
    this.turnosSvc.list().subscribe({
      next: turnos => {
        const enCurso = turnos.filter(t =>
          t.estado === 'EN_CURSO' &&
          (t.rutaId === rutaId || t.ruta?.id === rutaId),
        );

        const now = Date.now();
        const buses: BusActivo[] = enCurso.map(t => {
          const lat = t.latitudInicio ?? null;
          const lng = t.longitudInicio ?? null;
          const inicioMs = t.fechaInicioProgramada
            ? new Date(t.fechaInicioProgramada).getTime()
            : null;
          const retrasado = inicioMs != null
            ? (now - inicioMs) > 10 * 60 * 1000
            : false;
          const minutosRetraso = retrasado && inicioMs != null
            ? Math.round((now - inicioMs) / 60000)
            : undefined;

          return {
            busId:   t.bus?.id   ?? t.busId   ?? 0,
            placa:   t.bus?.placa ?? `Bus ${t.busId ?? '?'}`,
            turnoId: t.id ?? 0,
            lat,
            lng,
            ultimaActualizacion: null,
            paraderoMasCercano:  null,
            tiempoLlegadaMinutos: null,
            retrasado,
            minutosRetraso,
          };
        });

        this.procesarBuses(buses);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  private procesarBuses(buses: BusActivo[]): void {
    const enriquecidos = buses.map(bus => {
      const lat = bus.lat;
      const lng = bus.lng;
      if (lat != null && lat !== 0 && lng != null && lng !== 0) {
        const result = this.calcularParaderoCercano(lat, lng);
        if (result) {
          return {
            ...bus,
            paraderoMasCercano: {
              id:              result.paradero.paraderoId ?? 0,
              nombre:          result.paradero.nombre     ?? '',
              orden:           result.paradero.orden      ?? 0,
              distanciaMetros: result.distanciaMetros,
            },
          };
        }
      }
      return bus;
    });

    this.busesActivos.set(enriquecidos);
    this.marcaActualizacion();
    this.renderBusMarkers(enriquecidos);

    // No es necesario llamar actualizarMotivoRetraso porque viene del backend

    // Paso 5: resetear countdown con el ETA calculado a partir de los datos recién llegados
    const paradero = this.paraderoEspera();
    if (paradero) {
      let mejorEta: number | null = null;
      for (const bus of enriquecidos) {
        const t = this.calcularTiempoLlegada(bus, paradero);
        if (t >= 0 && (mejorEta === null || t < mejorEta)) {
          mejorEta = t;
        }
      }
      this.etaCountdown.set(mejorEta);
      this.etaCountdown.set(null);
    }

    this.checkUpcomingBusNotifications();
  }

  private checkUpcomingBusNotifications(): void {
    if (!this.suscripcionKey()) return;

    const ruta = this.rutaSeleccionada();
    const paradero = this.paraderoEspera();
    const minsAnticipacion = this.minutosAlerta();

    if (!ruta || !paradero) return;

    // Buscar buses próximos que cumplan la condición
    let mejorCandidato: { bus: BusActivo; eta: number } | null = null;

    for (const bus of this.busesActivos()) {
      const eta = this.calcularTiempoLlegada(bus, paradero);
      if (eta >= 0 && eta <= minsAnticipacion) {
        const notifKey = `${ruta.id}_${paradero.paraderoId}_${bus.busId}_${minsAnticipacion}`;
        if (!this.notifiedBuses.has(notifKey)) {
          if (!mejorCandidato || eta < mejorCandidato.eta) {
            mejorCandidato = { bus, eta };
          }
        }
      }
    }

    if (mejorCandidato) {
      const bus = mejorCandidato.bus;
      const eta = Math.round(mejorCandidato.eta);
      const notifKey = `${ruta.id}_${paradero.paraderoId}_${bus.busId}_${minsAnticipacion}`;
      
      this.notifiedBuses.add(notifKey);

      // Notificación interna
      this.alertaInterna.set({
        busId: bus.busId,
        placa: bus.placa,
        rutaNombre: ruta.nombre ?? '',
        paraderoNombre: paradero.nombre ?? '',
        eta
      });

      // Notificación del navegador
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Tu bus está cerca', {
          body: `Ruta ${ruta.nombre} · Bus ${bus.placa} · Llega en ${eta} min al paradero ${paradero.nombre}`,
          icon: '/assets/icons/bus.png' // Opcional, ignóralo si no existe
        });
      }
    }
  }

  verBusEnVivo(busId: number): void {
    this.alertaInterna.set(null);
    const bus = this.busesActivos().find(b => b.busId === busId);
    if (bus) {
      this.seleccionarBus(bus);
    }
  }

  prepararPago(): void {
    this.alertaInterna.set(null);
    this.router.navigate(['/metodos-pago']);
  }

  cerrarAlertaInterna(): void {
    this.alertaInterna.set(null);
  }

  private calcularParaderoCercano(lat: number, lng: number): { paradero: ParaderoEnRuta; distanciaMetros: number } | null {
    const paraderos = this.paraderosDeLaRuta();
    let minDist = Infinity;
    let nearest: ParaderoEnRuta | null = null;
    for (const p of paraderos) {
      if (p.latitud == null || p.longitud == null) continue;
      const d = this.haversineKm(lat, lng, p.latitud, p.longitud) * 1000;
      if (d < minDist) { minDist = d; nearest = p; }
    }
    if (!nearest) return null;
    return { paradero: nearest, distanciaMetros: Math.round(minDist) };
  }

  private marcaActualizacion(): void {
    this.ultimaActualizacion.set(new Date());
    this.segundosDesdeActual.set(0);
  }

  private initMap(): void {
    this.map = L.map('tracking-map', { center: [5.0703, -75.5138], zoom: 13 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(this.map);
    setTimeout(() => this.map.invalidateSize(), 300);
  }

  private limpiarMapa(): void {
    this.busMarkers.forEach(m => m.remove());
    this.busMarkers.clear();
    this.paraderoLayers.forEach(m => m.remove());
    this.paraderoLayers = [];
  }

  private renderParaderoMarkers(paraderos: ParaderoEnRuta[]): void {
    if (!this.map) return;
    this.paraderoLayers.forEach(m => m.remove());
    this.paraderoLayers = [];

    setTimeout(() => {
      paraderos.forEach(p => {
        if (p.latitud == null || p.longitud == null) return;
        const icon = L.divIcon({
          className: '',
          html: `<div class="paradero-marker"><div class="paradero-circulo">${p.orden}</div><div class="paradero-nombre">${p.nombre ?? ''}</div></div>`,
          iconSize: [80, 50],
          iconAnchor: [40, 14],
        });
        const m = L.marker([p.latitud, p.longitud], { icon })
          .bindPopup(`<b>Parada ${p.orden}</b><br>${p.nombre}`)
          .addTo(this.map);
        this.paraderoLayers.push(m);
      });

      if (paraderos.length > 0 && paraderos[0].latitud && paraderos[0].longitud) {
        this.map.setView([paraderos[0].latitud, paraderos[0].longitud], 14);
      }
    }, 100);
  }

  private renderBusMarkers(buses: BusActivo[]): void {
    const activeIds = new Set(buses.map(b => b.busId));

    this.busMarkers.forEach((m, id) => {
      if (!activeIds.has(id)) { m.remove(); this.busMarkers.delete(id); }
    });

    const selId = this.busSeleccionado()?.busId;

    buses.forEach(bus => {
      const gps = this.hasGps(bus);

      if (!gps) {
        if (this.busMarkers.has(bus.busId)) {
          const m = this.busMarkers.get(bus.busId)!;
          m.setIcon(L.divIcon({
            className: '',
            html: `<div class="bus-dot bus-dot--offline">📵</div>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19],
          }));
          m.unbindTooltip();
          m.bindTooltip(bus.placa, { permanent: true, direction: 'top', offset: [0, -20] });
        }
        return;
      }

      const tiempo = this.calcularTiempoLlegada(bus, this.paraderoEspera());
      const retrasadoVisual = tiempo > 10;
      const seleccionado    = selId === bus.busId;

      const icon = L.divIcon({
        className: '',
        html: `<div class="bus-dot${retrasadoVisual ? ' retrasado' : ''}${seleccionado ? ' seleccionado' : ''}">🚌</div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const popupHtml = bus.paraderoMasCercano
        ? `<div class="bus-popup">
            <strong>${bus.placa}</strong>
            ${bus.retrasado ? `<div class="bus-popup-alerta"><strong>Estado: Retrasado</strong><br>Retraso acumulado: ${bus.minutosRetraso} min${bus.activeIncidentsCount ? `<br>Incidentes activos: ${bus.activeIncidentsCount}` : ''}</div>` : ''}
            <div class="bus-popup-row"><span class="bus-popup-label">Paradero más cercano:</span></div>
            <div class="bus-popup-value">${bus.paraderoMasCercano.nombre}</div>
            <div class="bus-popup-row"><span class="bus-popup-label">Distancia:</span></div>
            <div class="bus-popup-value">${bus.paraderoMasCercano.distanciaMetros != null ? bus.paraderoMasCercano.distanciaMetros + ' m' : '—'}</div>
           </div>`
        : `<div class="bus-popup"><strong>${bus.placa}</strong>${bus.retrasado ? `<div class="bus-popup-alerta"><strong>Estado: Retrasado</strong><br>Retraso acumulado: ${bus.minutosRetraso} min${bus.activeIncidentsCount ? `<br>Incidentes activos: ${bus.activeIncidentsCount}` : ''}</div>` : ''}<div class="bus-popup-label">Sin datos de paradero</div></div>`;

      if (this.busMarkers.has(bus.busId)) {
        const m = this.busMarkers.get(bus.busId)!;
        m.setLatLng([bus.lat!, bus.lng!]);
        m.setIcon(icon);
        m.setZIndexOffset(1000);
        m.unbindTooltip();
        m.bindTooltip(bus.placa, { permanent: true, direction: 'top', offset: [0, -20] });
        m.setPopupContent(popupHtml);
        m.off('click');
        m.on('click', () => this.seleccionarBus(bus));
      } else {
        const m = L.marker([bus.lat!, bus.lng!], { icon, zIndexOffset: 1000 })
          .bindTooltip(bus.placa, { permanent: true, direction: 'top', offset: [0, -20] })
          .bindPopup(popupHtml, { offset: [0, -10] })
          .addTo(this.map);
        m.on('click', () => this.seleccionarBus(bus));
        this.busMarkers.set(bus.busId, m);
      }
    });
  }

  private startEtaPolling(rutaId: number, paraderoId: number): void {
    this.stopEtaPolling();
    this.fetchEtas(rutaId, paraderoId);
    this.etaTimer = setInterval(() => this.fetchEtas(rutaId, paraderoId), 30_000);
  }

  private stopEtaPolling(): void {
    if (this.etaTimer) {
      clearInterval(this.etaTimer);
      this.etaTimer = undefined;
    }
  }

  private fetchEtas(rutaId: number, paraderoId: number): void {
    this.etaSvc.getEta(rutaId, paraderoId).subscribe({
      next: etas => {
        this.etasBuses.set(etas);
        // Paso 5: resetear countdown de detalle con el mejor ETA del endpoint
        if (etas.length > 0) {
          const mejor = Math.min(...etas.map(e => e.tiempoLlegadaMinutos));
          this.etaDetailCountdown.set(mejor);
        } else {
          this.etaDetailCountdown.set(null);
        }
      },
      error: () => {},
    });
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (v: number) => v * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  ngOnDestroy(): void {
    if (this.suscripcionKey()) {
      this.trackingSvc.cancelarSuscripcion(this.suscripcionKey()!).subscribe();
    }
    this.subs.forEach(s => s.unsubscribe());
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    if (this.tickTimer)    clearInterval(this.tickTimer);
    if (this.etaTimer)     clearInterval(this.etaTimer);
    this.trackingSvc.disconnect();
    if (this.map) this.map.remove();
  }
}
