import { Component, inject, signal, OnInit, AfterViewInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  PanelControlService,
  BusEnPanel,
  EstadisticasPanel,
} from '../../core/services/panel-control.service';
import { TrackingService } from '../../core/services/tracking.service';
import { IncidentesService } from '../../core/services/incidentes.service';
import { Incidente } from '../../core/models/negocio.models';
import { AlertasService, ResultadoAlerta } from '../../core/services/alertas.service';
import { RutasService } from '../../core/services/rutas.service';
import { Ruta } from '../../core/models/negocio.models';
import { ZonasService, Zona } from '../../core/services/zonas.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-panel-control',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule, MatButtonModule, MatCheckboxModule,
    MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressBarModule, MatTooltipModule, MatProgressSpinnerModule,
  ],
  templateUrl: './panel-control.component.html',
  styleUrls: ['./panel-control.component.scss'],
})
export class PanelControlComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly panelSvc        = inject(PanelControlService);
  private readonly trackingSvc     = inject(TrackingService);
  private readonly incidentesSvc   = inject(IncidentesService);
  private readonly alertasSvc      = inject(AlertasService);
  private readonly notifSvc        = inject(NotificationService);
  private readonly rutasSvc        = inject(RutasService);
  private readonly zonasSvc        = inject(ZonasService);

  private map!: L.Map;
  private busMarkers = new Map<number, L.Marker>();
  private subs: Subscription[] = [];
  private refreshTimer?: ReturnType<typeof setInterval>;
  private tickTimer?:    ReturnType<typeof setInterval>;

  mostrarDialogAlerta    = signal(false);
  alertaAsunto           = signal('');
  alertaMensaje          = signal('');
  alertaUrgente          = signal(false);
  alertaAlcance          = signal<'TODOS' | 'RUTA' | 'ZONA'>('TODOS');
  alertaRutaId           = signal<number | null>(null);
  alertaZonaId           = signal<number | null>(null);
  alertaScheduledAt      = signal<string>('');
  alertaTotalDest        = signal<number | null>(null);
  enviandoAlerta         = signal(false);
  rutasActivas           = signal<Ruta[]>([]);
  zonasActivas           = signal<Zona[]>([]);

  cargando               = signal(true);
  estadisticas           = signal<EstadisticasPanel | null>(null);
  buses                  = signal<BusEnPanel[]>([]);
  incidentes             = signal<Incidente[]>([]);
  ultimaActualizacion    = signal<Date | null>(null);
  segundosDesde          = signal<number>(0);
  incidenteExpandidoId   = signal<number | null>(null);
  busSeleccionado        = signal<BusEnPanel | null>(null);
  /** Número de buses visibles en el mapa en tiempo real (actualizado por WebSocket). */
  busesEnMapa            = signal<number>(0);

  readonly busesOcupados = computed(() =>
    [...this.buses()]
      .filter(b => b.porcentajeOcupacion >= 90)
      .sort((a, b) => b.porcentajeOcupacion - a.porcentajeOcupacion)
  );

  readonly incidentesOrdenados = computed(() => {
    const orden: Record<string, number> = { CRITICO: 0, ALTO: 1, MEDIO: 2 };
    return [...this.incidentes()].sort(
      (a, b) => (orden[a.gravedad ?? ''] ?? 3) - (orden[b.gravedad ?? ''] ?? 3)
    );
  });

  readonly resumenFlota = computed(() => ({
    normal:    this.buses().filter(b => b.estado === 'normal').length,
    lleno:     this.buses().filter(b => b.estado === 'lleno').length,
    incidente: this.buses().filter(b => b.estado === 'incidente').length,
  }));

  readonly topBusesOcupacion = computed(() =>
    this.busesOcupados().length
      ? this.busesOcupados()
      : [...this.buses()].sort((a, b) => b.porcentajeOcupacion - a.porcentajeOcupacion).slice(0, 5)
  );

  ngOnInit(): void {
    this.cargar();
    this.rutasSvc.listActivas().subscribe(r => this.rutasActivas.set(r));
    this.zonasSvc.list().subscribe(z => this.zonasActivas.set(z));

    this.refreshTimer = setInterval(() => this.cargar(), 30_000);

    this.tickTimer = setInterval(() => {
      const last = this.ultimaActualizacion();
      if (last) this.segundosDesde.set(Math.round((Date.now() - last.getTime()) / 1000));
    }, 1000);

    // El websocket se conecta en ngAfterViewInit para asegurar que el mapa esté listo.
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initMap();
      setTimeout(() => {
        this.map.invalidateSize();
        this.map.setView([5.0703, -75.5138], 13);

        // Unirse a la room global del panel para recibir actualizaciones en tiempo real.
        // El evento 'todos-los-buses' llega cada ~12s, o inmediatamente al conectarse.
        this.trackingSvc.joinPanel();
        const wsSub = this.trackingSvc.onTodosLosBuses().subscribe(buses => {
          this.busesEnMapa.set(buses.length);
          const marcadores: BusEnPanel[] = buses
            .filter(b => b.lat != null && b.lng != null)
            .map(b => ({
              busId:               b.busId,
              placa:               b.placa,
              lat:                 b.lat,
              lng:                 b.lng,
              conductor:           '—',
              pasajerosActivos:    0,
              capacidadMaxima:     40,
              porcentajeOcupacion: 0,
              estado:              'normal' as const,
              incidentesActivos:   [],
              turno:               { id: b.turnoId, estado: null } as any,
            }));
          this.renderBusMarkers(marcadores);
        });
        this.subs.push(wsSub);
      }, 300);
    }, 200);
  }

  cargar(): void {
    this.cargando.set(true);
    this.panelSvc.cargarDesdePanel().subscribe({
      next: datos => {
        this.estadisticas.set(datos.estadisticas);
        this.buses.set(datos.buses);
        this.incidentes.set(datos.incidentes);
        this.ultimaActualizacion.set(new Date());
        this.segundosDesde.set(0);
        this.cargando.set(false);
        this.renderBusMarkers(datos.buses);
      },
      error: (err: unknown) => {
        console.error('[PanelControl] Error al cargar datos del panel:', err);
        this.cargando.set(false);
      },
    });
  }

  gravedadBadgeClass(gravedad?: string): string {
    const g = (gravedad ?? '').toUpperCase();
    if (g === 'CRITICO') return 'badge-gravedad badge-critico';
    if (g === 'ALTO')    return 'badge-gravedad badge-alto';
    return 'badge-gravedad badge-medio';
  }

  iconoIncidente(tipo?: string): string {
    const t = (tipo ?? '').toUpperCase();
    if (t === 'MECANICO') return 'build';
    if (t === 'ACCIDENTE') return 'car_crash';
    if (t === 'CLIMA') return 'thunderstorm';
    if (t === 'PASAJERO') return 'person_off';
    if (t === 'TRAFICO') return 'traffic';
    return 'warning';
  }

  tiempoAtras(fecha?: string): string {
    if (!fecha) return '—';
    const min = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
    if (min < 60) return `hace ${min} min`;
    return `hace ${Math.floor(min / 60)} h`;
  }

  toggleIncidente(id?: number): void {
    if (id == null) return;
    this.incidenteExpandidoId.set(this.incidenteExpandidoId() === id ? null : id);
  }

  abrirDialogAlerta(): void {
    this.mostrarDialogAlerta.set(true);
  }

  cerrarDialogAlerta(): void {
    this.mostrarDialogAlerta.set(false);
    this.alertaAsunto.set('');
    this.alertaMensaje.set('');
    this.alertaUrgente.set(false);
    this.alertaAlcance.set('TODOS');
    this.alertaRutaId.set(null);
    this.alertaZonaId.set(null);
    this.alertaScheduledAt.set('');
    this.alertaTotalDest.set(null);
  }

  onAlcanceChange(alcance: 'TODOS' | 'RUTA' | 'ZONA'): void {
    this.alertaAlcance.set(alcance);
    this.alertaRutaId.set(null);
    this.alertaZonaId.set(null);
    this.alertaTotalDest.set(null);
    this.actualizarContadorDestinatarios();
  }

  actualizarContadorDestinatarios(): void {
    this.alertasSvc.contarDestinatarios(
      this.alertaAlcance(),
      this.alertaRutaId() ?? undefined,
      this.alertaZonaId() ?? undefined
    ).subscribe({
      next: (res) => this.alertaTotalDest.set(res.total),
      error: () => this.alertaTotalDest.set(null)
    });
  }

  enviarAlertaMasiva(): void {
    if (!this.alertaAsunto().trim()) {
      this.notifSvc.error('El asunto es requerido');
      return;
    }
    if (!this.alertaMensaje().trim()) {
      this.notifSvc.error('El mensaje es requerido');
      return;
    }

    this.enviandoAlerta.set(true);
    this.alertasSvc.enviarMasiva({
      asunto: this.alertaAsunto(),
      mensaje: this.alertaMensaje(),
      urgente: this.alertaUrgente(),
      alcance: this.alertaAlcance(),
      rutaId: this.alertaRutaId() ?? undefined,
      zonaId: this.alertaZonaId() ?? undefined,
      scheduledAt: this.alertaScheduledAt() ? new Date(this.alertaScheduledAt()) : undefined,
    }).subscribe({
      next: (r: any) => {
        this.notifSvc.success(this.alertaScheduledAt() ? 'Alerta programada correctamente' : `Alerta enviada correctamente`);
        this.cerrarDialogAlerta();
        this.enviandoAlerta.set(false);
      },
      error: () => {
        this.notifSvc.error('No se pudo enviar la alerta');
        this.enviandoAlerta.set(false);
      },
    });
  }

  resolverIncidente(incidenteId: number): void {
    this.incidentesSvc
      .agregarComentario(incidenteId, 'Marcado como resuelto desde panel de control', 'RESUELTO')
      .subscribe({ next: () => this.cargar(), error: () => {} });
  }

  seleccionarBus(bus: BusEnPanel): void {
    this.busSeleccionado.set(bus);
    if (bus.lat != null && bus.lng != null) {
      this.map.panTo([bus.lat, bus.lng]);
    }
  }

  cerrarDetalleBus(): void {
    this.busSeleccionado.set(null);
  }

  busParaPlaca(placa?: string): BusEnPanel | undefined {
    if (!placa) return undefined;
    return this.buses().find(b => b.placa === placa);
  }

  private initMap(): void {
    this.map = L.map('panel-map', { center: [5.0703, -75.5138], zoom: 13 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);
  }

  private emojiEstado(bus: BusEnPanel): string {
    if (bus.estado === 'incidente') return '🔴';
    if (bus.estado === 'lleno')     return '🟠';
    return '🟢';
  }

  private renderBusMarkers(buses: BusEnPanel[]): void {
    if (!this.map) return;

    const activeIds = new Set(buses.map(b => b.busId));
    this.busMarkers.forEach((m, id) => {
      if (!activeIds.has(id)) { m.remove(); this.busMarkers.delete(id); }
    });

    buses.forEach(bus => {
      if (bus.lat == null || bus.lng == null) return;

      const emoji = this.emojiEstado(bus);
      const icon = L.divIcon({
        className: '',
        html: `<div class="panel-bus-dot panel-bus-dot--${bus.estado}">${emoji}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const incidentesHtml = bus.incidentesActivos.length
        ? `<p>⚠️ Incidentes: <b>${bus.incidentesActivos.length}</b> activo(s)</p>`
        : '';

      const popup = `
        <div class="panel-popup">
          <strong>${emoji} ${bus.placa}</strong>
          ${bus.modelo   ? `<p>Modelo: <b>${bus.modelo}</b></p>`   : ''}
          ${bus.empresa  ? `<p>Empresa: <b>${bus.empresa}</b></p>` : ''}
          <p>Conductor: <b>${bus.conductor}</b></p>
          ${bus.rutaNombre ? `<p>Ruta: <b>${bus.rutaNombre}</b></p>` : ''}
          <p>Pasajeros: <b>${bus.pasajerosActivos}/${bus.capacidadMaxima}</b> (${bus.porcentajeOcupacion}%)</p>
          <p>Estado turno: <b>${bus.turno.estado ?? '—'}</b></p>
          ${incidentesHtml}
          <a href="/incidentes" style="font-size:.8rem;color:#1976d2">Ver detalle completo →</a>
        </div>`;

      const tooltip = `${emoji} ${bus.placa} · ${bus.pasajerosActivos}/${bus.capacidadMaxima} pasajeros`;

      if (this.busMarkers.has(bus.busId)) {
        const m = this.busMarkers.get(bus.busId)!;
        m.setLatLng([bus.lat, bus.lng]);
        m.setIcon(icon);
        m.setPopupContent(popup);
        m.unbindTooltip();
        m.bindTooltip(tooltip, { permanent: false, direction: 'top' });
        m.off('click').on('click', () => this.seleccionarBus(bus));
      } else {
        const m = L.marker([bus.lat, bus.lng], { icon })
          .bindPopup(popup)
          .bindTooltip(tooltip, { permanent: false, direction: 'top' })
          .on('click', () => this.seleccionarBus(bus))
          .addTo(this.map);
        this.busMarkers.set(bus.busId, m);
      }
    });
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (this.tickTimer)    clearInterval(this.tickTimer);
    if (this.map) this.map.remove();
  }
}
