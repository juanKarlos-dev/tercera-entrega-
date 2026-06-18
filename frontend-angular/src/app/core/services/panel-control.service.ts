import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Turno, Boleto, Incidente } from '../models/negocio.models';
import { TurnosService } from './turnos.service';

export interface BusEnPanel {
  busId: number;
  placa: string;
  modelo?: string;
  empresa?: string;
  conductor: string;
  rutaNombre?: string;
  pasajerosActivos: number;
  capacidadMaxima: number;
  porcentajeOcupacion: number;
  estado: 'normal' | 'incidente' | 'lleno';
  lat: number | null;
  lng: number | null;
  turnoId?: number;
  incidentesActivos: Incidente[];
  turno: Turno;
}

export interface EstadisticasPanel {
  busesActivos: number;
  pasajerosEnTransito: number;
  incidentesActivos: number;
  busesLlenos: number;
}

export interface DatosPanel {
  estadisticas: EstadisticasPanel;
  buses: BusEnPanel[];
  incidentes: Incidente[];
}

@Injectable({ providedIn: 'root' })
export class PanelControlService {
  private readonly http      = inject(HttpClient);
  private readonly turnosSvc = inject(TurnosService);
  private readonly base      = environment.apiUrlLogica;

  private unwrap(r: any): any[] {
    return Array.isArray(r) ? r : (r.data ?? r.items ?? []);
  }

  private getBoletosActivos(): Observable<Boleto[]> {
    return this.http.get<any>(`${this.base}/boletos`).pipe(
      map(r => this.unwrap(r).filter((b: Boleto) => b.estado === 'ACTIVO')),
      catchError(() => of([])),
    );
  }

  getIncidentesActivos(): Observable<Incidente[]> {
    return this.http.get<any>(`${this.base}/incidentes`).pipe(
      map(r => this.unwrap(r).filter((i: Incidente) =>
        i.estado === 'PENDIENTE' || i.estado === 'EN_REVISION'
      )),
      catchError(() => of([])),
    );
  }

  getBusesConOcupacion(turnos: Turno[], boletos: Boleto[], incidentes: Incidente[]): BusEnPanel[] {
    return turnos.map(turno => {
      const busId     = turno.bus?.id ?? turno.busId ?? 0;
      const capacidad = turno.bus?.capacidadMaximaPasajeros ?? 40;
      const pasajeros = boletos.filter(b => b.turnoId === turno.id).length;
      const porcentaje = capacidad > 0 ? Math.round((pasajeros / capacidad) * 100) : 0;
      const incBus = incidentes.filter(i => (i.bus?.id ?? i.busId) === busId);
      const estado  = this.determinarEstadoBus(porcentaje, incBus);

      const conductor = turno.conductor?.persona
        ? `${turno.conductor.persona.nombres ?? ''} ${turno.conductor.persona.apellidos ?? ''}`.trim()
        : (turno.conductor?.numeroLicencia ?? '—');

      return {
        busId,
        placa:               turno.bus?.placa  ?? `Bus ${busId}`,
        modelo:              turno.bus?.modelo,
        empresa:             turno.empresa?.nombre ?? turno.bus?.empresa?.nombre,
        conductor,
        rutaNombre:          turno.ruta?.nombre,
        pasajerosActivos:    pasajeros,
        capacidadMaxima:     capacidad,
        porcentajeOcupacion: porcentaje,
        estado,
        lat:                 turno.latitudInicio  ?? null,
        lng:                 turno.longitudInicio ?? null,
        turnoId:             turno.id,
        incidentesActivos:   incBus,
        turno,
      };
    });
  }

  determinarEstadoBus(porcentaje: number, incidentes: Incidente[]): 'normal' | 'incidente' | 'lleno' {
    if (incidentes.length > 0) return 'incidente';
    if (porcentaje >= 90)      return 'lleno';
    return 'normal';
  }

  getEstadisticas(buses: BusEnPanel[], incidentes: Incidente[]): EstadisticasPanel {
    return {
      busesActivos:        buses.length,
      pasajerosEnTransito: buses.reduce((s, b) => s + b.pasajerosActivos, 0),
      incidentesActivos:   incidentes.length,
      busesLlenos:         buses.filter(b => b.porcentajeOcupacion >= 90).length,
    };
  }

  cargar(): Observable<DatosPanel> {
    return forkJoin({
      turnos: this.turnosSvc.list().pipe(
        map(ts => ts.filter(t => t.estado === 'EN_CURSO')),
        catchError(() => of([])),
      ),
      boletos:    this.getBoletosActivos(),
      incidentes: this.getIncidentesActivos(),
    }).pipe(
      map(({ turnos, boletos, incidentes }) => {
        const buses = this.getBusesConOcupacion(turnos, boletos, incidentes);
        return {
          estadisticas: this.getEstadisticas(buses, incidentes),
          buses,
          incidentes,
        };
      }),
    );
  }

  cargarDesdePanel(): Observable<DatosPanel> {
    return this.http.get<any>(`${this.base}/tracking/panel`).pipe(
      map(data => {
        const incidentes: Incidente[] = data.incidentesActivos ?? [];
        const buses: BusEnPanel[] = (data.buses ?? []).map((b: any) => {
          const incBus = incidentes.filter(
            i => (i.bus?.id ?? i.busId) === b.busId,
          );
          const estado = this.determinarEstadoBus(b.porcentajeOcupacion ?? 0, incBus);
          return {
            busId:               b.busId,
            placa:               b.placa,
            modelo:              b.modelo ?? undefined,
            empresa:             b.empresa ?? undefined,
            conductor:           b.conductor ?? '—',
            rutaNombre:          b.paraderoMasCercano?.nombre ?? undefined,
            pasajerosActivos:    b.pasajerosActivos ?? 0,
            capacidadMaxima:     b.capacidadMaxima ?? 40,
            porcentajeOcupacion: b.porcentajeOcupacion ?? 0,
            estado,
            lat:                 b.lat,
            lng:                 b.lng,
            turnoId:             b.turnoId,
            incidentesActivos:   incBus,
            turno:               { id: b.turnoId, estado: b.turnoEstado } as Turno,
          };
        });
        const busesLlenos = buses.filter(b => b.porcentajeOcupacion >= 90).length;
        const estadisticas: EstadisticasPanel = {
          busesActivos:        data.totalBusesActivos,
          pasajerosEnTransito: data.totalPasajeros,
          incidentesActivos:   incidentes.length,
          busesLlenos,
        };
        return { estadisticas, buses, incidentes };
      }),
      catchError(() => this.cargar()),
    );
  }
}
