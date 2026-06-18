import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { MetodoPago, MetodoPagoCiudadano, RecargaRequest, RecargaResponse } from '../models/negocio.models';

@Injectable({ providedIn: 'root' })
export class MetodosPagoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrlLogica}/metodos-pago`;

  crear(body: Partial<MetodoPago>): Observable<MetodoPago> {
    return this.http.post<{ data: MetodoPago }>(this.base, body).pipe(map(r => r.data));
  }

  listar(): Observable<MetodoPago[]> {
    return this.http.get<{ data: MetodoPago[] }>(this.base).pipe(map(r => r.data ?? []));
  }

  asignarCiudadano(ciudadanoId: number, metodoPagoId: number, saldoInicial: number): Observable<MetodoPagoCiudadano> {
    return this.http
      .post<{ data: MetodoPagoCiudadano }>(`${this.base}/ciudadanos`, { ciudadanoId, metodoPagoId, saldoInicial })
      .pipe(map(r => r.data));
  }

  getByciudadano(ciudadanoId: number): Observable<MetodoPagoCiudadano[]> {
    return this.http
      .get<{ data: MetodoPagoCiudadano[] }>(`${this.base}/ciudadanos/${ciudadanoId}`)
      .pipe(map(r => r.data ?? []));
  }

  recargar(body: RecargaRequest): Observable<RecargaResponse> {
    return this.http
      .post<{ data: RecargaResponse }>(`${this.base}/recargar`, body)
      .pipe(map(r => r.data));
  }

  webhookEpayco(body: any): Observable<any> {
    return this.http.post(`${this.base}/webhook-epayco`, body);
  }
}
