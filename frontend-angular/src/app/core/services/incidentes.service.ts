import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Incidente } from '../models/negocio.models';

const unwrap = (r: any) => Array.isArray(r) ? r : (r.data ?? r);

@Injectable({ providedIn: 'root' })
export class IncidentesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrlLogica}/incidentes`;

  crear(body: Partial<Incidente>): Observable<Incidente> {
    return this.http.post<any>(this.base, body).pipe(map(unwrap));
  }

  getByBus(busId: number): Observable<Incidente[]> {
    return this.http.get<any>(`${this.base}/bus/${busId}`).pipe(map(unwrap));
  }

  subirFotografias(id: number, files: File[]): Observable<Incidente> {
    const form = new FormData();
    files.forEach(f => form.append('fotografias', f));
    return this.http.post<Incidente>(`${this.base}/${id}/fotografias`, form);
  }

  agregarComentario(id: number, comentario: string, nuevoEstado?: string): Observable<Incidente> {
    const body: any = { comentario };
    if (nuevoEstado) body.nuevoEstado = nuevoEstado;
    return this.http.patch<Incidente>(`${this.base}/${id}/comentario`, body);
  }
}
