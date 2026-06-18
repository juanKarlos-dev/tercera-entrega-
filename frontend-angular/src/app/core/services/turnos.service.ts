import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Turno } from '../models/negocio.models';

const unwrap = (r: any) => Array.isArray(r) ? r : (r.data ?? r);

@Injectable({ providedIn: 'root' })
export class TurnosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrlLogica}/turnos`;

  list(): Observable<Turno[]>                                { return this.http.get<any>(this.base).pipe(map(unwrap)); }
  getById(id: number): Observable<Turno>                    { return this.http.get<Turno>(`${this.base}/${id}`); }
  create(body: Partial<Turno>): Observable<Turno>           { return this.http.post<Turno>(this.base, body); }
  update(id: number, body: Partial<Turno>): Observable<Turno> { return this.http.patch<Turno>(`${this.base}/${id}`, body); }
  delete(id: number): Observable<void>                      { return this.http.delete<void>(`${this.base}/${id}`); }

  iniciar(id: number, body: { estadoConfirmadoBus: string; observacionesInicio?: string }): Observable<Turno> {
    return this.http.patch<Turno>(`${this.base}/${id}/iniciar`, body);
  }

  finalizar(id: number, body: { observacionesCierre?: string }): Observable<Turno> {
    return this.http.patch<Turno>(`${this.base}/${id}/finalizar`, body);
  }

  reportarRetraso(id: number, body: { minutosRetraso: number; motivo?: string }): Observable<{ message: string; data: { turnoId: number; minutosRetraso: number; motivo: string | null } }> {
    return this.http.put<any>(`${this.base}/${id}/retraso`, body);
  }
}
