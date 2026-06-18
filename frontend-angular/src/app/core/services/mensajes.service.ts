import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';

export interface Mensaje {
  id: number;
  remitenteId: string;
  destinatarioId?: string | null;
  destinatarioNombre?: string;
  grupoId?: number | null;
  contenido: string;
  tipo: string;
  leido: boolean;
  fechaLeido?: string | null;
  createdAt: string;
  tieneUbicacion?: boolean;
  latitud?: number | null;
  longitud?: number | null;
  deletedByAdmin?: boolean;
  deletedByUserId?: string | null;
  deletedAt?: string | null;
  isGrupalRef?: boolean;
  originalGrupalId?: number;
}

export interface UsuarioBusqueda {
  securityUserId: string;
  nombres: string;
  apellidos: string;
  email: string;
}

export interface CrearMensajeDto {
  destinatarioId: string;
  contenido: string;
  tieneUbicacion?: boolean;
  latitud?: number;
  longitud?: number;
}

export interface FiltrosBandeja {
  soloNoLeidos?: boolean;
  tipo?: 'DIRECTO' | 'GRUPO' | 'MASIVO';
  fechaDesde?: string;
  fechaHasta?: string;
}

export interface MensajeGrupal {
  id: number;
  remitenteId: string;
  contenido: string;
  tipo: string;
  createdAt: string;
  deletedByAdmin: boolean;
  deletedAt?: string | null;
  deletedByUserId?: string | null;
  deletionReason?: string | null;
  // Extraídos del backend en getGrupalesEnviados:
  groupIds?: number[];
  totalRecipients?: number;
  readCount?: number;
}

export interface LecturaDetalle {
  totalRecipients: number;
  readCount: number;
  pendingCount: number;
  readUsers: { usuarioId: string; nombre?: string; readAt: string }[];
  pendingUsers: { usuarioId: string; nombre?: string }[];
}

export interface MensajeBandejaUnificada {
  id: string; // 'directo_1' o 'grupal_5'
  originalId: number;
  tipo: 'INDIVIDUAL' | 'GRUPAL' | 'ALERTA_MASIVA';
  emisorId: string;
  emisorNombre?: string;
  contenido: string;
  preview?: string;
  createdAt: string;
  leido: boolean;
}

@Injectable({ providedIn: 'root' })
export class MensajesService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrlLogica}/mensajes`;
  private socket: Socket | null = null;

  enviarDirecto(dto: CrearMensajeDto, userId: string): Observable<Mensaje> {
    return this.http.post<Mensaje>(`${this.base}?userId=${userId}`, dto);
  }

  getBandeja(userId: string): Observable<Mensaje[]> {
    return this.http.get<Mensaje[]>(`${this.base}/bandeja?userId=${userId}`);
  }

  getBandejaUnificada(userId: string): Observable<MensajeBandejaUnificada[]> {
    return this.http.get<MensajeBandejaUnificada[]>(`${this.base}/bandeja-unificada?userId=${userId}`);
  }

  getBandejaFiltrada(userId: string, filtros: FiltrosBandeja): Observable<Mensaje[]> {
    let params = new HttpParams().set('userId', userId);
    if (filtros.soloNoLeidos !== undefined) params = params.set('soloNoLeidos', String(filtros.soloNoLeidos));
    if (filtros.tipo)       params = params.set('tipo', filtros.tipo);
    if (filtros.fechaDesde) params = params.set('fechaDesde', filtros.fechaDesde);
    if (filtros.fechaHasta) params = params.set('fechaHasta', filtros.fechaHasta);
    return this.http.get<Mensaje[]>(`${this.base}/bandeja/filtrar`, { params });
  }

  getEnviados(userId: string): Observable<Mensaje[]> {
    return this.http.get<Mensaje[]>(`${this.base}/enviados?userId=${userId}`);
  }

  marcarLeido(id: number, userId: string): Observable<void> {
    return this.http.patch<void>(`${this.base}/${id}/leer?userId=${userId}`, {});
  }

  enviarAGrupo(grupoId: number, userId: string, contenido: string): Observable<Mensaje> {
    return this.http.post<Mensaje>(`${this.base}/grupo/${grupoId}?userId=${userId}`, { contenido });
  }

  getHistorialGrupo(grupoId: number): Observable<Mensaje[]> {
    return this.http.get<Mensaje[]>(`${this.base}/grupo/${grupoId}`);
  }

  buscarUsuarios(q: string, excludeId: string): Observable<UsuarioBusqueda[]> {
    const params = new HttpParams().set('q', q).set('excludeId', excludeId);
    return this.http.get<UsuarioBusqueda[]>(`${this.base}/buscar-usuarios`, { params });
  }

  // --- Módulo Mensajes Grupales ---

  enviarMensajeGrupal(groupIds: number[], contenido: string, userId: string): Observable<MensajeGrupal> {
    return this.http.post<MensajeGrupal>(`${this.base}/grupales?userId=${userId}`, { groupIds, contenido });
  }

  getGrupalesEnviados(userId: string): Observable<MensajeGrupal[]> {
    return this.http.get<MensajeGrupal[]>(`${this.base}/grupales/enviados?userId=${userId}`);
  }

  getLecturasGrupal(mensajeId: number): Observable<LecturaDetalle> {
    return this.http.get<LecturaDetalle>(`${this.base}/grupales/${mensajeId}/lecturas`);
  }

  getLecturas(id: string): Observable<LecturaDetalle> {
    return this.http.get<LecturaDetalle>(`${this.base}/${id}/lecturas`);
  }

  marcarLeidoGrupal(mensajeId: number, userId: string): Observable<void> {
    return this.http.patch<void>(`${this.base}/grupales/${mensajeId}/leer?userId=${userId}`, {});
  }

  eliminarGrupalPorAdmin(mensajeId: number, adminId: string, reason: string): Observable<void> {
    return this.http.patch<void>(`${this.base}/grupales/${mensajeId}/eliminar?adminId=${adminId}`, { reason });
  }

  /** Elimina un mensaje del chat de grupo normal (Tipo GRUPO) como administrador */
  eliminarMensajeGrupo(grupoId: number, mensajeId: number, adminId: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiUrlLogica}/grupos/${grupoId}/messages/${mensajeId}?adminId=${adminId}`
    );
  }

  onNuevoMensajeGrupalBroadcast(): Observable<MensajeGrupal> {
    return new Observable(observer => {
      const socket = this.socket;
      if (!socket) return;
      const handler = (data: MensajeGrupal) => observer.next(data);
      socket.on('nuevo-mensaje-grupal-broadcast', handler);
      return () => socket.off('nuevo-mensaje-grupal-broadcast', handler);
    });
  }

  onAlertaUrgente(): Observable<any> {
    return new Observable(observer => {
      const socket = this.socket;
      if (!socket) return;
      const handler = (data: any) => observer.next(data);
      socket.on('alerta-urgente', handler);
      return () => socket.off('alerta-urgente', handler);
    });
  }

  conectar(userId: string): void {
    if (this.socket?.connected) return;
    this.socket = io(`${environment.serverUrl}/mensajes`, {
      transports: ['websocket', 'polling'],
    });
    this.socket.emit('join-user', { userId });
  }

  joinGrupo(grupoId: number): void {
    if (this.socket?.connected) {
      this.socket.emit('join-grupo', { grupoId });
    }
  }

  onNuevoMensaje(): Observable<Mensaje> {
    return new Observable(observer => {
      const socket = this.socket;
      if (!socket) return;
      const handler = (data: Mensaje) => observer.next(data);
      socket.on('nuevo-mensaje', handler);
      return () => socket.off('nuevo-mensaje', handler);
    });
  }

  onNuevoMensajeGrupo(): Observable<Mensaje> {
    return new Observable(observer => {
      const socket = this.socket;
      if (!socket) return;
      const handler = (data: Mensaje) => observer.next(data);
      socket.on('nuevo-mensaje-grupo', handler);
      return () => socket.off('nuevo-mensaje-grupo', handler);
    });
  }

  onRemovidoGrupo(): Observable<{ grupoId: number }> {
    return new Observable(observer => {
      const socket = this.socket;
      if (!socket) return;
      const handler = (data: { grupoId: number }) => observer.next(data);
      socket.on('removido-grupo', handler);
      return () => socket.off('removido-grupo', handler);
    });
  }

  desconectar(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  ngOnDestroy(): void {
    this.desconectar();
  }
}
