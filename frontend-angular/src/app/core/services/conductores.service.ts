import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Conductor } from '../models/negocio.models';

const unwrap = (r: any) => Array.isArray(r) ? r : (r.data ?? r);

@Injectable({ providedIn: 'root' })
export class ConductoresService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrlLogica}/conductores`;

  list(): Observable<Conductor[]>                                      { return this.http.get<any>(this.base).pipe(map(unwrap)); }
  getById(id: number): Observable<Conductor>                          { return this.http.get<Conductor>(`${this.base}/${id}`); }
  create(body: Partial<Conductor>): Observable<Conductor>             { return this.http.post<Conductor>(this.base, body); }
  update(id: number, body: Partial<Conductor>): Observable<Conductor> { return this.http.patch<Conductor>(`${this.base}/${id}`, body); }
  delete(id: number): Observable<void>                                { return this.http.delete<void>(`${this.base}/${id}`); }
}
