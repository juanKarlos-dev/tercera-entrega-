import { Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTabsModule } from '@angular/material/tabs';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { MensajesService, Mensaje, CrearMensajeDto, FiltrosBandeja, UsuarioBusqueda, MensajeGrupal, LecturaDetalle, MensajeBandejaUnificada } from '../../core/services/mensajes.service';
import { Grupo, GrupoMiembro, GruposService, CrearGrupoDto } from '../../core/services/grupos.service';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { DatePipe } from '@angular/common';

type VistaPrincipal = 'DIRECTOS' | 'MIS_GRUPOS' | 'EXPLORAR';
type PestanaNuevoMsg = 'RECIBIDOS' | 'ENVIADOS' | 'NUEVO' | 'GRUPO';

@Component({
  selector: 'app-mensajes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatTabsModule,
    MatBadgeModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  templateUrl: './mensajes.component.html',
  styleUrls: ['./mensajes.component.scss'],
})
export class MensajesComponent implements OnInit, OnDestroy {
  private readonly mensajesSvc = inject(MensajesService);
  private readonly auth        = inject(AuthService);
  private readonly notifSvc   = inject(NotificationService);
  private readonly gruposSvc   = inject(GruposService);
  private readonly dialog      = inject(MatDialog);

  private uid = '';
  private subs: Subscription[] = [];
  private busquedaSubject = new Subject<string>();

  // --- Estado General ---
  readonly miId = signal<string>('');
  vistaActiva = signal<VistaPrincipal>('DIRECTOS');
  cargando = signal<boolean>(false);
  lecturasUnificadas = signal<LecturaDetalle | null>(null);

  // --- Mensajes Directos y Bandeja Unificada ---
  bandeja = signal<Mensaje[]>([]);
  enviados = signal<Mensaje[]>([]);
  bandejaUnificada = signal<MensajeBandejaUnificada[]>([]);
  
  // Filtros Bandeja
  filtroBandejaTipo = signal<'TODOS' | 'INDIVIDUAL' | 'GRUPAL'>('TODOS');
  filtroBandejaLeido = signal<'TODOS' | 'NO_LEIDOS'>('TODOS');
  filtroBandejaOrden = signal<'DESC' | 'ASC'>('DESC');
  filtroBandejaFechaDesde = signal<string>('');
  filtroBandejaFechaHasta = signal<string>('');

  mensajeUnificadoActivo = signal<MensajeBandejaUnificada | null>(null);

  readonly bandejaFiltrada = computed(() => {
    let lista = this.bandejaUnificada();
    if (this.filtroBandejaTipo() !== 'TODOS') {
      lista = lista.filter(m => m.tipo === this.filtroBandejaTipo());
    }
    if (this.filtroBandejaLeido() === 'NO_LEIDOS') {
      lista = lista.filter(m => !m.leido);
    }
    if (this.filtroBandejaFechaDesde()) {
      const desdeStr = this.filtroBandejaFechaDesde() + 'T00:00:00';
      const desde = new Date(desdeStr).getTime();
      lista = lista.filter(m => new Date(m.createdAt).getTime() >= desde);
    }
    if (this.filtroBandejaFechaHasta()) {
      const hastaStr = this.filtroBandejaFechaHasta() + 'T23:59:59';
      const hasta = new Date(hastaStr).getTime();
      lista = lista.filter(m => new Date(m.createdAt).getTime() <= hasta);
    }
    return lista.sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return this.filtroBandejaOrden() === 'DESC' ? diff : -diff;
    });
  });
  contactoActivo = signal<string | null>(null);
  historialChat = signal<Mensaje[]>([]);
  mensajeEnCursor = signal<string>('');

  // --- Pestañas panel derecho ---
  pestanaPanel = signal<PestanaNuevoMsg>('RECIBIDOS');
  mensajeDetalleEnviado = signal<Mensaje | null>(null);

  // Computado de conversaciones directas
  readonly conversaciones = computed((): { interlocutor: string; msg: Mensaje; noLeidos: number }[] => {
    const todos = [...this.bandeja(), ...this.enviados()].filter(m => !m.grupoId);
    const mapa = new Map<string, { msg: Mensaje; noLeidos: number }>();

    for (const msg of todos) {
      const interlocutor = msg.remitenteId === this.uid ? (msg.destinatarioId ?? '') : msg.remitenteId;
      if (!interlocutor) continue;

      const prev = mapa.get(interlocutor);
      const isUnread = msg.remitenteId === interlocutor && !msg.leido;
      const noLeidos = (prev?.noLeidos ?? 0) + (isUnread ? 1 : 0);

      if (!prev || new Date(msg.createdAt) > new Date(prev.msg.createdAt)) {
        mapa.set(interlocutor, { msg, noLeidos });
      } else {
        mapa.set(interlocutor, { msg: prev.msg, noLeidos });
      }
    }
    return [...mapa.entries()]
      .map(([interlocutor, data]) => ({ interlocutor, msg: data.msg, noLeidos: data.noLeidos }))
      .sort((a, b) => new Date(b.msg.createdAt).getTime() - new Date(a.msg.createdAt).getTime());
  });

  readonly totalNoLeidosDirectos = computed(() => this.bandeja().filter(m => !m.leido && !m.grupoId).length);
  readonly totalNoLeidosMisGrupos = computed(() => this.misGrupos().reduce((sum, g) => sum + (g.unreadCount || 0), 0));

  constructor() {
    effect(() => {
      if (this.vistaActiva() === 'EXPLORAR') {
        this.cargarGruposPublicos();
      }
    });
  }

  // --- Grupos ---
  misGrupos = signal<Grupo[]>([]);
  gruposPublicos = signal<Grupo[]>([]);
  grupoActivo = signal<Grupo | null>(null);
  miembrosGrupo = signal<GrupoMiembro[]>([]);
  historialGrupo = signal<Mensaje[]>([]);
  mensajeGrupoEnCursor = signal<string>('');

  // --- Panel de Miembros: búsqueda, historial ---
  busquedaMiembro = signal<string>('');
  logMembresia = signal<any[]>([]);

  readonly miembrosGrupoFiltrados = computed(() => {
    const q = this.busquedaMiembro().toLowerCase().trim();
    if (!q) return this.miembrosGrupo();
    return this.miembrosGrupo().filter(m => {
      const nombre = `${m.nombres ?? ''} ${m.apellidos ?? ''}`.toLowerCase();
      return nombre.includes(q);
    });
  });

  // --- Formulario Nuevo Mensaje ---
  mostrarNuevoMensaje = signal<boolean>(false);
  nuevoDestinatario = signal<string>('');
  nuevoMensajeTexto = signal<string>('');
  enviando = signal<boolean>(false);

  // --- Búsqueda de destinatario ---
  busquedaTexto = signal<string>('');
  resultadosBusqueda = signal<UsuarioBusqueda[]>([]);
  destinatarioSeleccionado = signal<UsuarioBusqueda | null>(null);
  buscando = signal<boolean>(false);

  // --- GPS / Ubicación ---
  adjuntarUbicacion = signal<boolean>(false);
  latitud = signal<number | null>(null);
  longitud = signal<number | null>(null);
  gpsEstado = signal<'idle' | 'ok' | 'error'>('idle');
  cargandoGps = signal<boolean>(false);

  // --- Crear Grupo ---
  mostrarCrearGrupo = signal<boolean>(false);
  nuevoGrupoNombre = signal<string>('');
  nuevoGrupoDesc = signal<string>('');
  creandoGrupo = signal<boolean>(false);
  nuevoGrupoMiembros = signal<UsuarioBusqueda[]>([]);
  nuevoGrupoBusquedaQuery = signal<string>('');
  nuevoGrupoBusquedaResultados = signal<UsuarioBusqueda[]>([]);
  nuevoGrupoBuscando = signal<boolean>(false);
  private readonly grupoMiembrosSubject = new Subject<string>();

  // --- Mensajes Grupales (Broadcast) ---
  gruposSeleccionados = signal<Set<number>>(new Set());
  miembrosPorGrupo = signal<Map<number, GrupoMiembro[]>>(new Map());
  grupalesEnviados = signal<MensajeGrupal[]>([]);
  mensajeGrupalTexto = signal<string>('');
  mensajeDetalleGrupal = signal<MensajeGrupal | null>(null);
  lecturasGrupalActivo = signal<LecturaDetalle | null>(null);
  enviandoGrupal = signal<boolean>(false);

  readonly totalDestinatariosUnicos = computed(() => {
    const seleccionados = this.gruposSeleccionados();
    const miembrosMap = this.miembrosPorGrupo();
    const unicos = new Set<string>();

    for (const gid of seleccionados) {
      const miembros = miembrosMap.get(gid) || [];
      for (const m of miembros) {
        if (m.usuarioId !== this.uid) unicos.add(m.usuarioId);
      }
    }
    return unicos.size;
  });

  /** Mapa de id → nombre completo construido a partir de los miembros cargados */
  readonly mapaNombres = computed(() => {
    const mapa = new Map<string, string>();
    for (const m of this.miembrosGrupo()) {
      const nombre = [m.nombres, m.apellidos].filter(Boolean).join(' ') || m.usuarioId;
      mapa.set(m.usuarioId, nombre);
    }
    return mapa;
  });

  /** Devuelve el nombre completo de un usuario por su ID; si no existe, devuelve el ID */
  getNombreMiembro(id: string): string {
    return this.mapaNombres().get(id) || id;
  }

  /** Etiqueta legible para el rol */
  getLabelRol(rol: string): string {
    return rol === 'ADMIN' ? '👑 Administrador' : 'Miembro';
  }

  ngOnInit(): void {
    this.uid = this.auth.payload()?.id ?? '';
    if (!this.uid) return;
    this.miId.set(this.uid);

    this.cargarBandeja();
    this.cargarBandejaUnificada();
    this.cargarEnviados();
    this.cargarMisGrupos();
    this.cargarGrupalesEnviados();

    this.mensajesSvc.conectar(this.uid);

    // Socket directos
    const wsSubDirecto = this.mensajesSvc.onNuevoMensaje().subscribe(msg => {
      this.bandeja.update(b => [msg, ...b]);
      
      const unificado: MensajeBandejaUnificada = {
        id: `IND-${msg.id}`,
        originalId: msg.id,
        tipo: 'INDIVIDUAL',
        emisorId: msg.remitenteId,
        emisorNombre: msg.remitenteId, // Not ideal but we don't have the user's name immediately
        contenido: msg.contenido,
        createdAt: msg.createdAt,
        leido: false,
      };
      this.bandejaUnificada.update(b => [unificado, ...b]);

      if (this.contactoActivo() === msg.remitenteId) {
        this.historialChat.update(h => [...h, msg]);
        this.mensajesSvc.marcarLeido(msg.id, this.uid).subscribe();
      } else {
        this.notifSvc.info(`Nuevo mensaje de ${msg.remitenteId}`);
      }
    });

    // Socket grupos
    const wsSubGrupo = this.mensajesSvc.onNuevoMensajeGrupo().subscribe(msg => {
      if (this.grupoActivo()?.id === msg.grupoId) {
        this.historialGrupo.update(h => [...h, msg]);
      } else {
        const gName = this.misGrupos().find(g => g.id === msg.grupoId)?.nombre || 'un grupo';
        this.notifSvc.info(`Nuevo mensaje en ${gName}`);
      }
    });

    // Socket grupales broadcast
    const wsSubGrupalBroadcast = this.mensajesSvc.onNuevoMensajeGrupalBroadcast().subscribe(msgGrupal => {
      // Lo mostramos en la bandeja de recibidos general mapeando campos
      const mappedMsg: Mensaje = {
        id: msgGrupal.id,
        remitenteId: msgGrupal.remitenteId,
        contenido: msgGrupal.contenido,
        tipo: 'MASIVO_GRUPAL', // Para distinguirlo en UI si quisiéramos
        leido: false,
        createdAt: msgGrupal.createdAt,
      };
      this.bandeja.update(b => [mappedMsg, ...b]);

      const unificado: MensajeBandejaUnificada = {
        id: `MASIVO-${msgGrupal.id}`,
        originalId: msgGrupal.id,
        tipo: 'GRUPAL',
        emisorId: msgGrupal.remitenteId,
        emisorNombre: msgGrupal.remitenteId,
        contenido: msgGrupal.contenido,
        createdAt: msgGrupal.createdAt,
        leido: false,
      };
      this.bandejaUnificada.update(b => [unificado, ...b]);

      this.notifSvc.info(`Nuevo mensaje grupal de ${msgGrupal.remitenteId}`);
    });

    // Búsqueda con debounce
    const busquedaSub = this.busquedaSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(q => {
        if (q.length < 2) { this.resultadosBusqueda.set([]); return of([]); }
        this.buscando.set(true);
        return this.mensajesSvc.buscarUsuarios(q, this.uid);
      }),
    ).subscribe({
      next: resultados => {
        this.resultadosBusqueda.set(resultados);
        this.buscando.set(false);
      },
      error: () => this.buscando.set(false),
    });

    const grupoMiembrosSub = this.grupoMiembrosSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => {
        if (q.length < 2) { this.nuevoGrupoBusquedaResultados.set([]); return of([]); }
        this.nuevoGrupoBuscando.set(true);
        return this.gruposSvc.buscarUsuarios(q, this.uid);
      }),
    ).subscribe({
      next: resultados => {
        this.nuevoGrupoBusquedaResultados.set(
          resultados.filter(u => !this.nuevoGrupoMiembros().some(m => m.securityUserId === u.securityUserId)),
        );
        this.nuevoGrupoBuscando.set(false);
      },
      error: () => this.nuevoGrupoBuscando.set(false),
    });

    this.subs.push(wsSubDirecto, wsSubGrupo, wsSubGrupalBroadcast, busquedaSub, grupoMiembrosSub);
  }

  // ─── CARGAS DE DATOS ─────────────────────────────────

  cargarBandeja(): void {
    this.mensajesSvc.getBandeja(this.uid).subscribe({
      next: msgs => this.bandeja.set(msgs),
    });
  }

  cargarBandejaUnificada(): void {
    this.mensajesSvc.getBandejaUnificada(this.uid).subscribe({
      next: msgs => this.bandejaUnificada.set(msgs),
    });
  }

  cargarEnviados(): void {
    this.mensajesSvc.getEnviados(this.uid).subscribe({
      next: msgs => this.enviados.set(msgs),
    });
  }

  cargarGrupalesEnviados(): void {
    this.mensajesSvc.getGrupalesEnviados(this.uid).subscribe({
      next: msgs => this.grupalesEnviados.set(msgs),
    });
  }

  cargarMisGrupos(): void {
    this.gruposSvc.getMisGrupos(this.uid).subscribe({
      next: grupos => {
        this.misGrupos.set(grupos);
        grupos.forEach(g => {
          this.mensajesSvc.joinGrupo(g.id);
          // Pre-cargar miembros para cálculo de destinatarios únicos
          this.gruposSvc.getMiembros(g.id, this.uid).subscribe({
            next: (miembros) => {
              const mapa = new Map(this.miembrosPorGrupo());
              mapa.set(g.id, miembros);
              this.miembrosPorGrupo.set(mapa);
            }
          });
        });
      }
    });
  }

  cargarGruposPublicos(): void {
    this.cargando.set(true);
    this.gruposSvc.getPublicos().subscribe({
      next: grupos => {
        const misIds = this.misGrupos().map(g => g.id);
        this.gruposPublicos.set(grupos.filter(g => !misIds.includes(g.id)));
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false)
    });
  }

  // ─── BÚSQUEDA DE DESTINATARIO ────────────────────────

  onBusquedaChange(texto: string): void {
    this.busquedaTexto.set(texto);
    this.destinatarioSeleccionado.set(null);
    this.busquedaSubject.next(texto);
  }

  seleccionarDestinatario(usuario: UsuarioBusqueda): void {
    this.destinatarioSeleccionado.set(usuario);
    this.busquedaTexto.set(`${usuario.nombres} ${usuario.apellidos}`);
    this.resultadosBusqueda.set([]);
  }

  limpiarDestinatario(): void {
    this.destinatarioSeleccionado.set(null);
    this.busquedaTexto.set('');
    this.resultadosBusqueda.set([]);
  }

  // ─── GPS ─────────────────────────────────────────────

  onToggleUbicacion(activo: boolean): void {
    this.adjuntarUbicacion.set(activo);
    if (!activo) {
      this.latitud.set(null);
      this.longitud.set(null);
      this.gpsEstado.set('idle');
      return;
    }
    this.obtenerUbicacion();
  }

  obtenerUbicacion(): void {
    if (!navigator.geolocation) {
      this.gpsEstado.set('error');
      return;
    }
    this.cargandoGps.set(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.latitud.set(pos.coords.latitude);
        this.longitud.set(pos.coords.longitude);
        this.gpsEstado.set('ok');
        this.cargandoGps.set(false);
      },
      () => {
        this.gpsEstado.set('error');
        this.cargandoGps.set(false);
        this.adjuntarUbicacion.set(false);
      },
      { timeout: 8000 }
    );
  }

  // ─── NAVEGACIÓN ──────────────────────────────────────

  cambiarVista(vista: VistaPrincipal): void {
    this.vistaActiva.set(vista);
    this.contactoActivo.set(null);
    this.grupoActivo.set(null);
    if (vista === 'EXPLORAR') {
      this.cargarGruposPublicos();
    }
  }

  abrirPanelNuevoMensaje(): void {
    this.pestanaPanel.set('NUEVO');
    this.limpiarDestinatario();
    this.nuevoMensajeTexto.set('');
    this.adjuntarUbicacion.set(false);
    this.gpsEstado.set('idle');
  }

  // ─── DIRECTOS ────────────────────────────────────────

  abrirConversacion(interlocutorId: string): void {
    if (!interlocutorId) return;
    this.contactoActivo.set(interlocutorId);
    this.grupoActivo.set(null);

    const todos = [...this.bandeja(), ...this.enviados()].filter(m => !m.grupoId);
    const historial = todos
      .filter(m => m.remitenteId === interlocutorId || m.destinatarioId === interlocutorId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    this.historialChat.set(historial);

    // Marcar como leídos
    this.bandeja()
      .filter(m => m.remitenteId === interlocutorId && !m.leido)
      .forEach(m => {
        this.mensajesSvc.marcarLeido(m.id, this.uid).subscribe(() => {
          this.bandeja.update(b => b.map(x => x.id === m.id ? { ...x, leido: true } : x));
          this.bandejaUnificada.update(b => b.map(x => x.originalId === m.id && x.tipo === 'INDIVIDUAL' ? { ...x, leido: true } : x));
        });
      });
  }

  enviarRespuestaDirecta(): void {
    if (!this.mensajeEnCursor().trim() || !this.contactoActivo()) return;

    const dto: CrearMensajeDto = {
      destinatarioId: this.contactoActivo()!,
      contenido: this.mensajeEnCursor().trim(),
    };

    this.mensajesSvc.enviarDirecto(dto, this.uid).subscribe({
      next: msg => {
        this.mensajeEnCursor.set('');
        this.historialChat.update(h => [...h, msg]);
        this.enviados.update(e => [msg, ...e]);
      },
      error: () => this.notifSvc.error('No se pudo enviar el mensaje'),
    });
  }

  // ─── BANDEJA UNIFICADA ───────────────────────────────

  abrirMensajeUnificado(msg: MensajeBandejaUnificada): void {
    this.mensajeUnificadoActivo.set(msg);
    this.contactoActivo.set(null);
    this.grupoActivo.set(null);
    this.mensajeEnCursor.set('');
    this.lecturasUnificadas.set(null);

    // Cargar lecturas
    this.mensajesSvc.getLecturas(msg.id).subscribe({
      next: lecturas => this.lecturasUnificadas.set(lecturas),
      error: () => console.error('Error cargando lecturas')
    });

    // Marcar como leído
    if (!msg.leido) {
      if (msg.tipo === 'INDIVIDUAL') {
        this.mensajesSvc.marcarLeido(msg.originalId, this.uid).subscribe(() => {
          this.bandejaUnificada.update(b => b.map(x => x.id === msg.id ? { ...x, leido: true } : x));
          this.bandeja.update(b => b.map(x => x.id === msg.originalId ? { ...x, leido: true } : x));
        });
      } else {
        this.mensajesSvc.marcarLeidoGrupal(msg.originalId, this.uid).subscribe(() => {
          this.bandejaUnificada.update(b => b.map(x => x.id === msg.id ? { ...x, leido: true } : x));
        });
      }
    }
  }

  cerrarMensajeUnificado(): void {
    this.mensajeUnificadoActivo.set(null);
    this.lecturasUnificadas.set(null);
  }

  enviarRespuestaUnificada(): void {
    const msgActivo = this.mensajeUnificadoActivo();
    if (!this.mensajeEnCursor().trim() || !msgActivo) return;

    const dto: CrearMensajeDto = {
      destinatarioId: msgActivo.emisorId,
      contenido: this.mensajeEnCursor().trim(),
    };

    this.mensajesSvc.enviarDirecto(dto, this.uid).subscribe({
      next: msg => {
        this.mensajeEnCursor.set('');
        this.notifSvc.success('Respuesta enviada correctamente');
        // Opcional: Cerrar la vista
        this.cerrarMensajeUnificado();
        // Agregar a enviados
        this.enviados.update(e => [msg, ...e]);
      },
      error: () => this.notifSvc.error('No se pudo enviar la respuesta'),
    });
  }

  enviarNuevoMensaje(): void {
    const destinatario = this.destinatarioSeleccionado();
    if (!destinatario || !this.nuevoMensajeTexto().trim()) return;

    this.enviando.set(true);

    const dto: CrearMensajeDto = {
      destinatarioId: destinatario.securityUserId,
      contenido: this.nuevoMensajeTexto().trim(),
      tieneUbicacion: this.adjuntarUbicacion() && this.gpsEstado() === 'ok',
      latitud: this.latitud() ?? undefined,
      longitud: this.longitud() ?? undefined,
    };

    this.mensajesSvc.enviarDirecto(dto, this.uid).subscribe({
      next: msg => {
        this.enviados.update(e => [msg, ...e]);
        this.limpiarDestinatario();
        this.nuevoMensajeTexto.set('');
        this.adjuntarUbicacion.set(false);
        this.gpsEstado.set('idle');
        this.enviando.set(false);
        this.notifSvc.success('Mensaje enviado');
        this.pestanaPanel.set('ENVIADOS');
      },
      error: () => {
        this.notifSvc.error('Error al enviar');
        this.enviando.set(false);
      },
    });
  }

  abrirDetalleEnviado(msg: Mensaje): void {
    this.mensajeDetalleEnviado.set(msg);
    // Si hay cambios en el estado de lectura, refrescar enviados
    this.cargarEnviados();
  }

  verEnGoogleMaps(lat: number, lng: number): void {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  }

  // ─── GRUPOS ──────────────────────────────────────────

  abrirGrupo(g: Grupo): void {
    this.grupoActivo.set(g);
    this.contactoActivo.set(null);
    this.pestanaPanel.set('RECIBIDOS');
    
    // Marcar como leído en backend
    if (this.uid) {
      this.gruposSvc.actualizarUltimaLectura(g.id, this.uid).subscribe();
      
      // Actualizar contador localmente
      this.misGrupos.update(grupos => grupos.map(gr => gr.id === g.id ? { ...gr, unreadCount: 0 } : gr));
    }

    this.mensajesSvc.getHistorialGrupo(g.id).subscribe({
      next: (historial) => this.historialGrupo.set(historial)
    });

    this.gruposSvc.getMiembros(g.id, this.uid).subscribe({
      next: miembros => {
        this.miembrosGrupo.set(miembros);
        this.busquedaMiembro.set('');
        // Cargar historial de membresía si el usuario es admin
        const yo = miembros.find(m => m.usuarioId === this.uid);
        if (yo?.rol === 'ADMIN') {
          this.gruposSvc.getLogMembresia(g.id, this.uid).subscribe({
            next: logs => this.logMembresia.set(logs)
          });
        } else {
          this.logMembresia.set([]);
        }
      }
    });
  }

  enviarMensajeGrupo(): void {
    const g = this.grupoActivo();
    if (!this.mensajeGrupoEnCursor().trim() || !g) return;

    this.mensajesSvc.enviarAGrupo(g.id, this.uid, this.mensajeGrupoEnCursor().trim()).subscribe({
      next: () => { this.mensajeGrupoEnCursor.set(''); },
      error: () => this.notifSvc.error('Error al enviar al grupo'),
    });
  }

  onNuevoGrupoBusqueda(q: string): void {
    this.nuevoGrupoBusquedaQuery.set(q);
    this.grupoMiembrosSubject.next(q);
  }

  agregarMiembroGrupo(u: UsuarioBusqueda): void {
    if (!this.nuevoGrupoMiembros().some(m => m.securityUserId === u.securityUserId)) {
      this.nuevoGrupoMiembros.update(ms => [...ms, u]);
    }
    this.nuevoGrupoBusquedaResultados.set([]);
    this.nuevoGrupoBusquedaQuery.set('');
  }

  quitarMiembroGrupo(u: UsuarioBusqueda): void {
    this.nuevoGrupoMiembros.update(ms => ms.filter(m => m.securityUserId !== u.securityUserId));
  }

  crearGrupo(): void {
    if (!this.nuevoGrupoNombre().trim() || this.nuevoGrupoMiembros().length < 2) return;
    this.creandoGrupo.set(true);

    const dto: CrearGrupoDto = {
      nombre:      this.nuevoGrupoNombre().trim(),
      descripcion: this.nuevoGrupoDesc().trim(),
      tipo:        'PUBLICO',
      memberIds:   this.nuevoGrupoMiembros().map(m => m.securityUserId),
    };

    this.gruposSvc.crear(dto, this.uid).subscribe({
      next: g => {
        this.misGrupos.update(m => [g, ...m]);
        this.mensajesSvc.joinGrupo(g.id);
        this.mostrarCrearGrupo.set(false);
        this.nuevoGrupoNombre.set('');
        this.nuevoGrupoDesc.set('');
        this.nuevoGrupoMiembros.set([]);
        this.nuevoGrupoBusquedaQuery.set('');
        this.creandoGrupo.set(false);
        this.notifSvc.success('Grupo creado exitosamente');
        this.cambiarVista('MIS_GRUPOS');
        this.abrirGrupo(g);
      },
      error: () => {
        this.notifSvc.error('Error al crear grupo');
        this.creandoGrupo.set(false);
      }
    });
  }

  unirseAGrupoPublico(grupo: Grupo): void {
    this.gruposSvc.unirse(grupo.id, this.uid).subscribe({
      next: () => {
        this.notifSvc.success(`Te has unido a ${grupo.nombre}`);
        this.gruposPublicos.update(gs => gs.filter(g => g.id !== grupo.id));
        this.cargarMisGrupos();
      },
      error: () => this.notifSvc.error('Error al unirse al grupo')
    });
  }

  abandonarGrupo(): void {
    const g = this.grupoActivo();
    if (!g) return;

    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Abandonar Grupo',
        message: `¿Estás seguro que deseas abandonar el grupo "${g.nombre}"?`,
        confirmLabel: 'Abandonar',
        cancelLabel: 'Cancelar',
        danger: true,
      }
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.gruposSvc.salir(g.id, this.uid).subscribe({
        next: () => {
          this.notifSvc.success(`Has abandonado ${g.nombre}`);
          this.misGrupos.update(gs => gs.filter(x => x.id !== g.id));
          this.grupoActivo.set(null);
        },
        error: err => this.notifSvc.error(err.error?.message || 'Error al salir del grupo')
      });
    });
  }

  removerMiembro(usuarioId: string): void {
    const g = this.grupoActivo();
    if (!g) return;
    this.gruposSvc.remover(g.id, this.uid, usuarioId).subscribe({
      next: () => {
        this.miembrosGrupo.update(ms => ms.filter(m => m.usuarioId !== usuarioId));
        this.notifSvc.success('Miembro removido');
      },
      error: err => this.notifSvc.error(err.error?.message || 'Error al remover miembro')
    });
  }

  esAdminGrupo(): boolean {
    const g = this.grupoActivo();
    if (!g) return false;
    const yo = this.miembrosGrupo().find(m => m.usuarioId === this.uid);
    return yo?.rol === 'ADMIN';
  }

  promoverMiembro(usuarioId: string): void {
    const g = this.grupoActivo();
    if (!g) return;
    const miembro = this.miembrosGrupo().find(m => m.usuarioId === usuarioId);
    const nombre = miembro ? `${miembro.nombres ?? ''} ${miembro.apellidos ?? ''}`.trim() || usuarioId : usuarioId;
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Promover a Administrador', message: `¿Promover a "${nombre}" como administrador del grupo?`, danger: false }
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.gruposSvc.promover(g.id, this.uid, usuarioId).subscribe({
        next: () => {
          this.miembrosGrupo.update(ms => ms.map(m => m.usuarioId === usuarioId ? { ...m, rol: 'ADMIN' as const } : m));
          this.notifSvc.success('Miembro promovido a administrador');
          // Refrescar log
          this.gruposSvc.getLogMembresia(g.id, this.uid).subscribe({ next: logs => this.logMembresia.set(logs) });
        },
        error: err => this.notifSvc.error(err.error?.message || 'Error al promover miembro')
      });
    });
  }

  bloquearMiembro(usuarioId: string): void {
    const g = this.grupoActivo();
    if (!g) return;
    const miembro = this.miembrosGrupo().find(m => m.usuarioId === usuarioId);
    const nombre = miembro ? `${miembro.nombres ?? ''} ${miembro.apellidos ?? ''}`.trim() || usuarioId : usuarioId;
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Bloquear Usuario', message: `¿Bloquear a "${nombre}" del grupo? No podrá volver a unirse.`, danger: true }
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.gruposSvc.bloquear(g.id, this.uid, usuarioId).subscribe({
        next: () => {
          this.miembrosGrupo.update(ms => ms.map(m => m.usuarioId === usuarioId ? { ...m, bloqueado: true } : m));
          this.notifSvc.success('Usuario bloqueado del grupo');
          // Refrescar log
          this.gruposSvc.getLogMembresia(g.id, this.uid).subscribe({ next: logs => this.logMembresia.set(logs) });
        },
        error: err => this.notifSvc.error(err.error?.message || 'Error al bloquear usuario')
      });
    });
  }

  eliminarMensajeDeGrupo(msg: Mensaje): void {
    const grupo = this.grupoActivo();
    if (!grupo) return;
    if (!confirm('¿Eliminar este mensaje para todos los miembros del grupo?')) return;
    
    if (msg.isGrupalRef && msg.originalGrupalId) {
      this.mensajesSvc.eliminarGrupalPorAdmin(msg.originalGrupalId, this.uid, 'Eliminado por admin de grupo').subscribe({
        next: () => {
          this.notifSvc.success('Mensaje masivo eliminado');
          this.historialGrupo.update(hist =>
            hist.map(m => m.id === msg.id ? { ...m, deletedByAdmin: true, contenido: '' } : m)
          );
        },
        error: () => this.notifSvc.error('No tienes permiso para eliminar este mensaje masivo'),
      });
    } else {
      this.mensajesSvc.eliminarMensajeGrupo(grupo.id, msg.id, this.uid).subscribe({
        next: () => {
          this.notifSvc.success('Mensaje eliminado');
          this.historialGrupo.update(hist =>
            hist.map(m => m.id === msg.id ? { ...m, deletedByAdmin: true, contenido: '' } : m)
          );
        },
        error: () => this.notifSvc.error('No tienes permiso para eliminar este mensaje'),
      });
    }
  }

  // ─── MENSAJES GRUPALES (BROADCAST) ───────────────────

  abrirPanelMensajeGrupal(): void {
    this.pestanaPanel.set('GRUPO');
    this.gruposSeleccionados.set(new Set());
    this.mensajeGrupalTexto.set('');
    this.mensajeDetalleGrupal.set(null);
    this.lecturasGrupalActivo.set(null);
    this.cargarMisGrupos();
    this.cargarGrupalesEnviados();
  }

  toggleGrupoSeleccion(grupoId: number): void {
    const current = new Set(this.gruposSeleccionados());
    if (current.has(grupoId)) {
      current.delete(grupoId);
    } else {
      current.add(grupoId);
    }
    this.gruposSeleccionados.set(current);
  }

  enviarMensajeGrupal(): void {
    const seleccionados = Array.from(this.gruposSeleccionados());
    if (seleccionados.length === 0 || !this.mensajeGrupalTexto().trim()) return;

    this.enviandoGrupal.set(true);
    this.mensajesSvc.enviarMensajeGrupal(seleccionados, this.mensajeGrupalTexto().trim(), this.uid).subscribe({
      next: (msg) => {
        this.notifSvc.success('Mensaje grupal enviado correctamente');
        this.gruposSeleccionados.set(new Set());
        this.mensajeGrupalTexto.set('');
        this.enviandoGrupal.set(false);
        this.cargarGrupalesEnviados();
      },
      error: () => {
        this.notifSvc.error('Error al enviar mensaje grupal');
        this.enviandoGrupal.set(false);
      }
    });
  }

  abrirDetalleGrupal(msg: MensajeGrupal): void {
    this.mensajeDetalleGrupal.set(msg);
    this.lecturasGrupalActivo.set(null);
    this.mensajesSvc.getLecturasGrupal(msg.id).subscribe({
      next: (detalle) => this.lecturasGrupalActivo.set(detalle)
    });
  }

  esAdminDeAlgunGrupo(groupIds: number[] | undefined): boolean {
    if (!groupIds) return false;
    for (const gid of groupIds) {
      const miembros = this.miembrosPorGrupo().get(gid) || [];
      const yo = miembros.find(m => m.usuarioId === this.uid);
      if (yo?.rol === 'ADMIN') return true;
    }
    return false;
  }

  eliminarMensajeGrupal(msg: MensajeGrupal): void {
    if (!confirm('¿Seguro que deseas eliminar este mensaje para todos los miembros de los grupos?')) return;
    this.mensajesSvc.eliminarGrupalPorAdmin(msg.id, this.uid, 'Mensaje inapropiado').subscribe({
      next: () => {
        this.notifSvc.success('Mensaje grupal eliminado');
        this.cargarGrupalesEnviados();
        if (this.mensajeDetalleGrupal()?.id === msg.id) {
          const actual = this.mensajeDetalleGrupal();
          if (actual) this.mensajeDetalleGrupal.set({ ...actual, deletedByAdmin: true });
        }
      },
      error: () => this.notifSvc.error('Error al eliminar mensaje grupal')
    });
  }

  // ─── UTILIDADES ──────────────────────────────────────

  inicialEnAvatar(id: string): string {
    return id ? id[0].toUpperCase() : '?';
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.mensajesSvc.desconectar();
  }
}
