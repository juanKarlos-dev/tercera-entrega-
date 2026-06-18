import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Ruta, RutaMapa } from '../models/negocio.models';

const unwrap = (r: any) => Array.isArray(r) ? r : (r.data ?? r);

@Injectable({ providedIn: 'root' })
export class RutasService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrlLogica}/rutas`;

  list(): Observable<Ruta[]>                               { return this.http.get<any>(this.base).pipe(map(unwrap)); }
  listActivas(): Observable<Ruta[]>                        { return this.http.get<any>(`${this.base}?activas=true`).pipe(map(unwrap)); }
  getById(id: number): Observable<Ruta>                   { return this.http.get<Ruta>(`${this.base}/${id}`); }
  create(body: Partial<Ruta>): Observable<Ruta>           { return this.http.post<Ruta>(this.base, body); }
  update(id: number, body: Partial<Ruta>): Observable<Ruta> { return this.http.patch<Ruta>(`${this.base}/${id}`, body); }
  delete(id: number): Observable<void>                    { return this.http.delete<void>(`${this.base}/${id}`); }

  getMapa(id: number): Observable<RutaMapa> {
    return this.http.get<any>(`${this.base}/${id}/mapa`).pipe(
      map(r => {
        const raw = r.data ?? r;
        return { ...raw, paraderos: raw.puntos ?? raw.paraderos ?? [] } as RutaMapa;
      })
    );
  }
}
