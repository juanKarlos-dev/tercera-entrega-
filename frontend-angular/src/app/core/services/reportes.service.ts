import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ReporteIngresosPorMetodo, ReporteDistribucionEtaria, ReporteTendenciaIncidentes } from '../models/negocio.models';

@Injectable({ providedIn: 'root' })
export class ReportesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrlLogica}/reportes`;

  ingresosPorMetodo(meses: 3 | 6 | 12 = 12): Observable<ReporteIngresosPorMetodo[]> {
    const params = new HttpParams().set('meses', meses);
    return this.http.get<any>(`${this.base}/ingresos-por-metodo-pago`, { params }).pipe(
      map(r => (r.data?.porMetodo ?? []).map((d: any): ReporteIngresosPorMetodo => ({
        metodo: d.nombre ?? d.tipo,
        total: d.total,
        cantidad: d.porcentaje,
      })))
    );
  }

  distribucionEtaria(): Observable<ReporteDistribucionEtaria[]> {
    return this.http.get<any>(`${this.base}/distribucion-etaria`).pipe(
      map(r => r.data?.distribucion ?? [])
    );
  }

  tendenciaIncidentes(): Observable<ReporteTendenciaIncidentes[]> {
    return this.http.get<any>(`${this.base}/tendencia-incidentes`).pipe(
      map(r => (r.data?.evolucionMensual ?? []).map((d: any): ReporteTendenciaIncidentes => ({
        fecha: d.mes,
        total: d.totalMes,
      })))
    );
  }

  exportarCSV(tipo: 'ingresos-por-metodo-pago' | 'distribucion-etaria' | 'tendencia-incidentes'): Observable<Blob> {
    return this.http.get(`${this.base}/${tipo}/exportar`, { responseType: 'blob' });
  }
}
