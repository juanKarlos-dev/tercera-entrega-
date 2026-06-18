import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Pqrs {
  id: number;
  radicado: string;
  tipo: string;
  categoria: string;
  descripcion: string;
  email: string;
  estado: string;
  respuesta?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrearPqrsDto {
  tipo: string;
  categoria: string;
  descripcion: string;
  email: string;
}

export interface ActualizarEstadoDto {
  estado: string;
  respuesta?: string;
}

@Injectable({ providedIn: 'root' })
export class PqrsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrlLogica}/pqrs`;

  crear(data: FormData): Observable<Pqrs> {
    return this.http.post<Pqrs>(this.base, data);
  }

  consultar(radicado: string): Observable<Pqrs> {
    return this.http.get<Pqrs>(`${this.base}/${radicado}`);
  }

  obtenerTodos(estado?: string, categoria?: string): Observable<Pqrs[]> {
    let params = new HttpParams();
    if (estado) params = params.set('estado', estado);
    if (categoria) params = params.set('categoria', categoria);
    return this.http.get<Pqrs[]>(this.base, { params });
  }

  cambiarEstado(id: number, dto: ActualizarEstadoDto): Observable<Pqrs> {
    return this.http.patch<Pqrs>(`${this.base}/${id}/estado`, dto);
  }
}
