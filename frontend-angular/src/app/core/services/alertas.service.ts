import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AlertaMasivaDto {
  asunto: string;
  mensaje: string;
  urgente: boolean;
  alcance: 'TODOS' | 'RUTA' | 'ZONA';
  rutaId?: number;
  zonaId?: number;
  scheduledAt?: Date;
}

export interface ResultadoAlerta {
  enviados: number;
  fallidos: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class AlertasService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrlLogica}/alertas`;

  enviarMasiva(dto: AlertaMasivaDto): Observable<ResultadoAlerta> {
    return this.http.post<ResultadoAlerta>(`${this.base}/masiva`, dto);
  }

  contarDestinatarios(alcance: string, rutaId?: number, zonaId?: number): Observable<{ total: number }> {
    let url = `${this.base}/contar-destinatarios?alcance=${alcance}`;
    if (rutaId) url += `&rutaId=${rutaId}`;
    if (zonaId) url += `&zonaId=${zonaId}`;
    return this.http.get<{ total: number }>(url);
  }

  getEstadisticas(id: number): Observable<any> {
    return this.http.get(`${this.base}/${id}/estadisticas`);
  }
}
