import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Ciudadano } from '../models/negocio.models';

const unwrap = (r: any) => Array.isArray(r) ? r : (r.data ?? r);

@Injectable({ providedIn: 'root' })
export class CiudadanosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrlLogica}/ciudadanos`;

  list(): Observable<Ciudadano[]>                                       { return this.http.get<any>(this.base).pipe(map(unwrap)); }
  getById(id: number): Observable<Ciudadano>                           { return this.http.get<Ciudadano>(`${this.base}/${id}`); }
  findBySecurityUserId(securityUserId: string): Observable<Ciudadano>  { return this.http.get<Ciudadano>(`${this.base}/security-user/${securityUserId}`); }
  create(body: Partial<Ciudadano>): Observable<Ciudadano>              { return this.http.post<Ciudadano>(this.base, body); }
  update(id: number, body: Partial<Ciudadano>): Observable<Ciudadano>  { return this.http.patch<Ciudadano>(`${this.base}/${id}`, body); }
  delete(id: number): Observable<void>                                 { return this.http.delete<void>(`${this.base}/${id}`); }

  actualizarAlertasClima(id: number, body: { alertaClima: boolean; emailAlerta?: string; horarioViaje?: string }): Observable<Ciudadano> {
    return this.http.patch<Ciudadano>(`${this.base}/${id}/alertas-clima`, body);
  }
}
