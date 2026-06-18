import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Bus } from '../models/negocio.models';

const unwrap = (r: any) => Array.isArray(r) ? r : (r.data ?? r);

@Injectable({ providedIn: 'root' })
export class BusesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrlLogica}/buses`;

  list(): Observable<Bus[]>                               { return this.http.get<any>(this.base).pipe(map(unwrap)); }
  getById(id: number): Observable<Bus>                   { return this.http.get<Bus>(`${this.base}/${id}`); }
  create(body: Partial<Bus>): Observable<Bus>            { return this.http.post<Bus>(this.base, body); }
  update(id: number, body: Partial<Bus>): Observable<Bus> { return this.http.patch<Bus>(`${this.base}/${id}`, body); }
  delete(id: number): Observable<void>                   { return this.http.delete<void>(`${this.base}/${id}`); }

  subirFoto(id: number, file: File): Observable<Bus> {
    const form = new FormData();
    form.append('foto', file);
    return this.http.post<Bus>(`${this.base}/${id}/foto`, form);
  }
}
