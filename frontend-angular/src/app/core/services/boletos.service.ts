import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Boleto, AbordajeRequest, AbordajeResponse, DescensoRequest, RecorridoBoleto } from '../models/negocio.models';

const unwrap = (r: any) => Array.isArray(r) ? r : (r.data ?? r);

@Injectable({ providedIn: 'root' })
export class BoletosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrlLogica}/boletos`;

  abordaje(body: AbordajeRequest): Observable<AbordajeResponse> {
    return this.http.post<AbordajeResponse>(`${this.base}/abordaje`, body);
  }

  descenso(body: DescensoRequest): Observable<Boleto> {
    return this.http.post<Boleto>(`${this.base}/descenso`, body);
  }

  historialCiudadano(ciudadanoId: number): Observable<Boleto[]> {
    return this.http.get<any>(`${this.base}/ciudadano/${ciudadanoId}/historial`).pipe(map(unwrap));
  }

  recorrido(id: number): Observable<RecorridoBoleto> {
    return this.http.get<any>(`${this.base}/${id}/recorrido`).pipe(map(r => r.data ?? r));
  }
}
