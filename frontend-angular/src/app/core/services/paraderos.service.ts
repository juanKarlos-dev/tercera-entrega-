import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Paradero } from '../models/negocio.models';

const unwrap = (r: any) => Array.isArray(r) ? r : (r.data ?? r);

@Injectable({ providedIn: 'root' })
export class ParaderosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrlLogica}/paraderos`;

  list(): Observable<Paradero[]>                                       { return this.http.get<any>(this.base).pipe(map(unwrap)); }
  getById(id: number): Observable<Paradero>                           { return this.http.get<Paradero>(`${this.base}/${id}`); }
  create(body: Partial<Paradero>): Observable<Paradero>               { return this.http.post<Paradero>(this.base, body); }
  update(id: number, body: Partial<Paradero>): Observable<Paradero>   { return this.http.patch<Paradero>(`${this.base}/${id}`, body); }
  delete(id: number): Observable<void>                                { return this.http.delete<void>(`${this.base}/${id}`); }

  buscarPorNombre(nombre: string): Observable<Paradero[]> {
    const params = new HttpParams().set('nombre', nombre);
    return this.http.get<any>(this.base, { params }).pipe(map(unwrap));
  }

  buscarCercanos(latitud: number, longitud: number): Observable<Paradero[]> {
    const round7 = (n: number) => parseFloat(n.toFixed(7));
    const params = new HttpParams()
      .set('latitud', round7(latitud))
      .set('longitud', round7(longitud));
    return this.http.get<any>(`${this.base}/cercanos`, { params }).pipe(map(unwrap));
  }
}
