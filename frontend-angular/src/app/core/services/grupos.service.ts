import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UsuarioBusqueda } from './mensajes.service';

export interface Grupo {
  id: number;
  nombre: string;
  descripcion?: string | null;
  tipo: 'PUBLICO' | 'PRIVADO';
  creadorId: string;
  imagen?: string | null;
  createdAt: string;
  totalMiembros?: number;
  ultimaLectura?: string; // Nuevo campo
  unreadCount?: number;   // Nuevo campo
}

export interface GrupoMiembro {
  id: number;
  grupoId: number;
  usuarioId: string;
  rol: 'ADMIN' | 'MIEMBRO';
  fechaUnion: string;
  bloqueado: boolean;
  nombres?: string;
  apellidos?: string;
}

export interface CrearGrupoDto {
  nombre: string;
  descripcion?: string;
  tipo?: 'PUBLICO' | 'PRIVADO';
  memberIds: string[];
  imagen?: string;
}

@Injectable({ providedIn: 'root' })
export class GruposService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrlLogica}/grupos`;

  getPublicos(q?: string): Observable<Grupo[]> {
    let url = `${this.base}/publicos`;
    if (q) {
      url += `?q=${encodeURIComponent(q)}`;
    }
    return this.http.get<Grupo[]>(url);
  }

  getMisGrupos(userId: string): Observable<Grupo[]> {
    return this.http.get<Grupo[]>(`${this.base}/mis-grupos?userId=${userId}`);
  }

  crear(dto: CrearGrupoDto, userId: string): Observable<Grupo> {
    return this.http.post<Grupo>(`${this.base}?userId=${userId}`, dto);
  }

  unirse(grupoId: number, userId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${grupoId}/unirse?userId=${userId}`, {});
  }

  getMiembros(grupoId: number, userId: string): Observable<GrupoMiembro[]> {
    return this.http.get<GrupoMiembro[]>(`${this.base}/${grupoId}/miembros?userId=${userId}`);
  }

  getLogMembresia(grupoId: number, userId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/${grupoId}/log-membresia?userId=${userId}`);
  }

  salir(grupoId: number, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${grupoId}/salir?userId=${userId}`);
  }

  remover(grupoId: number, adminId: string, usuarioId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${grupoId}/miembros/${usuarioId}?adminId=${adminId}`);
  }

  promover(grupoId: number, adminId: string, usuarioId: string): Observable<void> {
    return this.http.patch<void>(`${this.base}/${grupoId}/miembros/${usuarioId}/promover?adminId=${adminId}`, {});
  }

  bloquear(grupoId: number, adminId: string, usuarioId: string): Observable<void> {
    return this.http.patch<void>(`${this.base}/${grupoId}/miembros/${usuarioId}/bloquear?adminId=${adminId}`, {});
  }

  actualizarUltimaLectura(grupoId: number, userId: string): Observable<void> {
    return this.http.patch<void>(`${this.base}/${grupoId}/ultima-lectura?userId=${userId}`, {});
  }

  buscarUsuarios(q: string, excludeId: string): Observable<UsuarioBusqueda[]> {
    return this.http.get<UsuarioBusqueda[]>(`${this.base}/buscar-usuarios?q=${encodeURIComponent(q)}&excludeId=${encodeURIComponent(excludeId)}`);
  }

  subirImagen(grupoId: number, file: File): Observable<{ imagen: string }> {
    const form = new FormData();
    form.append('imagen', file);
    return this.http.post<{ imagen: string }>(`${this.base}/${grupoId}/imagen`, form);
  }

  eliminarMensaje(grupoId: number, mensajeId: number, adminId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${grupoId}/messages/${mensajeId}?adminId=${adminId}`);
  }
}
