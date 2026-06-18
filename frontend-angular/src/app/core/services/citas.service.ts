import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface CitaDto {
  nombre: string;
  email: string;
  tipoAtencion: 'Presencial' | 'Virtual';
  tipoConsulta: 'Problema con tarjeta' | 'Reclamo' | 'Reembolso' | 'Otro';
  motivo: string;
  fechaHora: string;
  fechaHoraFin: string;
}

export interface CitaResponse {
  ok: boolean;
  mensaje?: string;
}

@Injectable({ providedIn: 'root' })
export class CitasService {
  private readonly http = inject(HttpClient);
  private readonly webhookUrl = '/webhook/citas-transporte';
  private readonly disponibilidadUrl = '/webhook/citas-disponibilidad';

  consultarDisponibilidad(): Observable<{ ocupados: { start: string, end: string }[] }> {
    return this.http.get<{ ocupados: { start: string, end: string }[] }>(this.disponibilidadUrl);
  }

  agendarCita(dto: CitaDto): Observable<CitaResponse> {
    return this.http.post<CitaResponse>(this.webhookUrl, { body: dto }, {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
