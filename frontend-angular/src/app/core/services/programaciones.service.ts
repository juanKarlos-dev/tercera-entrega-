import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Programacion } from '../models/negocio.models';

const unwrap = (r: any) => Array.isArray(r) ? r : (r.data ?? r);

@Injectable({ providedIn: 'root' })
export class ProgramacionesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrlLogica}/programaciones`;

  list(): Observable<Programacion[]>                                         { return this.http.get<any>(this.base).pipe(map(unwrap)); }
  getById(id: number): Observable<Programacion>                             { return this.http.get<Programacion>(`${this.base}/${id}`); }
  create(body: Partial<Programacion>): Observable<Programacion>             { return this.http.post<Programacion>(this.base, body); }
  update(id: number, body: Partial<Programacion>): Observable<Programacion> { return this.http.patch<Programacion>(`${this.base}/${id}`, body); }
  delete(id: number): Observable<void>                                      { return this.http.delete<void>(`${this.base}/${id}`); }

  getHorariosVisibles(): Observable<Programacion[]> {
    return this.http.get<any>(`${this.base}/horarios/visibles`).pipe(map(unwrap));
  }
}
