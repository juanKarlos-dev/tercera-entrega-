import { HttpClient } from '@angular/common/http';
import { inject, Injectable, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';

export interface BusActivo {
  busId: number;
  placa: string;
  turnoId: number;
  lat: number | null;
  lng: number | null;
  ultimaActualizacion: string | null;
  paraderoMasCercano: { id: number; nombre: string; orden: number; distanciaMetros?: number } | null;
  tiempoLlegadaMinutos: number | null;
  retrasado: boolean;
  minutosRetraso?: number | null;
  motivoRetraso?: string | null;
  activeIncidentsCount?: number;
}

export interface AlertaRetraso {
  busId: number;
  placa: string;
  mensaje: string;
  timestamp: string;
  rutaNombre?: string;
  minutosRetraso?: number;
}

export interface SuscripcionResponse {
  key: string;
  mensaje: string;
}

@Injectable({ providedIn: 'root' })
export class TrackingService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private socket: Socket | null = null;

  private connect(): Socket {
    if (!this.socket || !this.socket.connected) {
      this.socket = io(`${environment.serverUrl}/tracking`, {
        transports: ['websocket', 'polling'],
      });
    }
    return this.socket;
  }

  joinRuta(rutaId: number): void {
    this.connect().emit('join-ruta', { rutaId });
  }

  /**
   * Se une a la room 'panel-global' para recibir actualizaciones
   * de todos los buses activos en tiempo real (usado por el panel de control).
   */
  joinPanel(): void {
    this.connect().emit('join-panel');
  }

  /**
   * Escucha el evento 'todos-los-buses' emitido por el simulador cada ~12 s.
   * Devuelve el array completo de BusActivo sin filtrar por ruta.
   */
  onTodosLosBuses(): Observable<BusActivo[]> {
    return new Observable(observer => {
      const socket  = this.connect();
      const handler = (data: BusActivo[]) => observer.next(data);
      socket.on('todos-los-buses', handler);
      return () => socket.off('todos-los-buses', handler);
    });
  }

  updateUbicacion(busId: number, lat: number, lng: number, turnoId: number, rutaId: number): void {
    this.connect().emit('update-ubicacion', { busId, lat, lng, turnoId, rutaId });
  }

  onBusesActualizados(): Observable<{ rutaId: number; buses: BusActivo[] }> {
    return new Observable(observer => {
      const socket = this.connect();
      const handler = (data: { rutaId: number; buses: BusActivo[] }) => observer.next(data);
      socket.on('buses-actualizados', handler);
      return () => socket.off('buses-actualizados', handler);
    });
  }

  onAlertaRetraso(): Observable<AlertaRetraso> {
    return new Observable(observer => {
      const socket = this.connect();
      const handler = (data: AlertaRetraso) => observer.next(data);
      socket.on('alerta-retraso', handler);
      return () => socket.off('alerta-retraso', handler);
    });
  }

  getBusesRuta(rutaId: number): Observable<BusActivo[]> {
    return this.http
      .get<{ buses: BusActivo[] }>(`${environment.apiUrlLogica}/tracking/ruta/${rutaId}`)
      .pipe(map(r => r.buses ?? []));
  }

  /**
   * Consulta aislada de incidentes activos de un bus (incluye incidentes tipo RETRASO).
   * Reutiliza el endpoint de detalle ya existente en el módulo de tracking.
   */
  getIncidentesActivosBus(busId: number): Observable<Array<{ tipo: string; descripcion: string | null; estado: string }>> {
    return this.http
      .get<{ incidentesActivos: Array<{ tipo: string; descripcion: string | null; estado: string }> }>(
        `${environment.apiUrlLogica}/tracking/bus/${busId}/detalle`,
      )
      .pipe(map(r => r.incidentesActivos ?? []));
  }

  suscribirBusProximo(dto: object): Observable<SuscripcionResponse> {
    return this.http.post<SuscripcionResponse>(
      `${environment.apiUrlLogica}/tracking/suscribir-bus-proximo`,
      dto,
    );
  }

  cancelarSuscripcion(key: string): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(
      `${environment.apiUrlLogica}/tracking/suscribir-bus-proximo/${key}`,
    );
  }

  iniciarDemo(): Observable<{ ok: boolean; busesSimulados: number; mensaje: string }> {
    return this.http.post<{ ok: boolean; busesSimulados: number; mensaje: string }>(
      `${environment.apiUrlLogica}/tracking/demo/iniciar`,
      {},
    );
  }

  estadoDemo(): Observable<{ busesActivos: number }> {
    return this.http.get<{ busesActivos: number }>(
      `${environment.apiUrlLogica}/tracking/demo/estado`,
    );
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
