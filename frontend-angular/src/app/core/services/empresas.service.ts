import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Empresa } from '../models/negocio.models';

const unwrap = (r: any) => Array.isArray(r) ? r : (r.data ?? r);

@Injectable({ providedIn: 'root' })
export class EmpresasService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrlLogica}/empresas`;

  list(): Observable<Empresa[]>                                  { return this.http.get<any>(this.base).pipe(map(unwrap)); }
  getById(id: number): Observable<Empresa>                      { return this.http.get<Empresa>(`${this.base}/${id}`); }
  create(body: Partial<Empresa>): Observable<Empresa>           { return this.http.post<Empresa>(this.base, body); }
  update(id: number, body: Partial<Empresa>): Observable<Empresa> { return this.http.patch<Empresa>(`${this.base}/${id}`, body); }
  delete(id: number): Observable<void>                          { return this.http.delete<void>(`${this.base}/${id}`); }
}
