import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface EtaBus {
  busId: number;
  placa: string;
  tiempoLlegadaMinutos: number;
  retrasado: boolean;
}

@Injectable({ providedIn: 'root' })
export class TrackingEtaService {
  private readonly http = inject(HttpClient);

  getEta(rutaId: number, paraderoId: number): Observable<EtaBus[]> {
    return this.http.get<EtaBus[]>(
      `${environment.apiUrlLogica}/tracking/ruta/${rutaId}/paradero/${paraderoId}/eta`,
    );
  }
}
