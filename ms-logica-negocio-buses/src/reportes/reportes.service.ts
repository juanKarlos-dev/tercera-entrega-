import { Injectable } from '@nestjs/common';
import { TipoIncidente } from 'src/common/enums/tipo-incidente.enum';
import { TipoMetodoPago } from 'src/common/enums/tipo-metodo-pago.enum';
import { QueryReporteEtarioDto } from './dto/query-reporte-etario.dto';
import { QueryReporteIncidentesDto } from './dto/query-reporte-incidentes.dto';
import { QueryReporteIngresosDto } from './dto/query-reporte-ingresos.dto';
import { ReportesBoletosRepository } from './reportes-boletos.repository';
import { ReportesIncidentesRepository } from './reportes-incidentes.repository';

@Injectable()
export class ReportesService {
  constructor(
    private readonly reportesBoletosRepository: ReportesBoletosRepository,
    private readonly reportesIncidentesRepository: ReportesIncidentesRepository,
  ) {}

  async getIngresosPorMetodoPago(query: QueryReporteIngresosDto) {
    const ahora = new Date();
    const desde = new Date(ahora);
    desde.setMonth(desde.getMonth() - query.meses);

    const formatearMes = (fecha: Date): string =>
      `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;

    const desdeStr = formatearMes(desde);
    const hastaStr = formatearMes(ahora);

    const todosLosMeses: string[] = [];
    const cursor = new Date(desde.getFullYear(), desde.getMonth(), 1);
    const hastaDate = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    while (cursor <= hastaDate) {
      todosLosMeses.push(formatearMes(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const filas = await this.reportesBoletosRepository.getIngresosRaw(desde, query.empresaId);

    const mapPorMetodo = new Map<
      string,
      { tipo: string; nombre: string; total: number }
    >();

    for (const fila of filas) {
      const key = `${fila.tipo}__${fila.nombre}`;
      const existente = mapPorMetodo.get(key);
      if (existente) {
        existente.total += Number(fila.total);
      } else {
        mapPorMetodo.set(key, {
          tipo: fila.tipo,
          nombre: fila.nombre,
          total: Number(fila.total),
        });
      }
    }

    const totalGeneral = Array.from(mapPorMetodo.values()).reduce(
      (suma, m) => suma + m.total,
      0,
    );

    const porMetodo = Array.from(mapPorMetodo.values()).map((m) => ({
      tipo: m.tipo,
      nombre: m.nombre,
      total: m.total,
      porcentaje:
        totalGeneral > 0
          ? Number(((m.total / totalGeneral) * 100).toFixed(2))
          : 0,
    }));

    const evolucionMensual = todosLosMeses.map((mes) => {
      const filasMes = filas.filter((f) => f.mes === mes);
      const datos: Record<string, number> = {
        [TipoMetodoPago.TARJETA_PREPAGADA]: 0,
        [TipoMetodoPago.EFECTIVO]: 0,
        [TipoMetodoPago.QR]: 0,
      };
      let totalMes = 0;
      for (const fila of filasMes) {
        datos[fila.tipo] = (datos[fila.tipo] ?? 0) + Number(fila.total);
        totalMes += Number(fila.total);
      }
      return { mes, datos, totalMes };
    });

    return {
      message: 'Reporte de ingresos por método de pago obtenido correctamente.',
      data: {
        periodo: { meses: query.meses, desde: desdeStr, hasta: hastaStr },
        totalGeneral,
        porMetodo,
        evolucionMensual,
      },
    };
  }

  async getDistribucionEtaria(query: QueryReporteEtarioDto) {
    const ahora = new Date();
    const inicioMesActual = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);

    const [filas, filasMesActual, filasMesAnterior] = await Promise.all([
      this.reportesBoletosRepository.getDistribucionEtariaRaw(
        query.rutaId,
        query.fechaDesde,
        query.fechaHasta,
      ),
      this.reportesBoletosRepository.getDistribucionEtariaPorPeriodo(
        inicioMesActual,
        ahora,
        query.rutaId,
      ),
      this.reportesBoletosRepository.getDistribucionEtariaPorPeriodo(
        inicioMesAnterior,
        inicioMesActual,
        query.rutaId,
      ),
    ]);

    const getCantidad = (
      filasArr: { rangoEtario: string; cantidad: string }[],
      key: string,
    ): number => {
      const fila = filasArr.find((f) => f.rangoEtario === key);
      return fila ? Number(fila.cantidad) : 0;
    };

    const RANGOS_CONFIG = [
      { key: 'Menores', label: 'Menores (0-17)' },
      { key: 'Jovenes', label: 'Jóvenes (18-25)' },
      { key: 'AdultosJovenes', label: 'Adultos Jóvenes (26-40)' },
      { key: 'Adultos', label: 'Adultos (41-60)' },
      { key: 'AdultosMayores', label: 'Adultos Mayores (60+)' },
    ];

    const cantidadSinInfo = getCantidad(filas, 'SIN_INFORMACION');
    const cantidadesPorRango = RANGOS_CONFIG.map((r) => ({
      ...r,
      cantidad: getCantidad(filas, r.key),
    }));
    const totalConInfo = cantidadesPorRango.reduce(
      (suma, r) => suma + r.cantidad,
      0,
    );
    const totalPasajeros = totalConInfo + cantidadSinInfo;

    const distribucion = cantidadesPorRango.map((r) => ({
      rango: r.label,
      cantidad: r.cantidad,
      porcentaje:
        totalConInfo > 0
          ? Number(((r.cantidad / totalConInfo) * 100).toFixed(2))
          : 0,
      variacionVsMesAnterior:
        filasMesAnterior.length === 0
          ? null
          : getCantidad(filasMesActual, r.key) -
            getCantidad(filasMesAnterior, r.key),
    }));

    const segmentoPredominante = distribucion.reduce(
      (max, r) => (r.cantidad > max.cantidad ? r : max),
      distribucion[0],
    );

    return {
      message: 'Distribución etaria de pasajeros obtenida correctamente.',
      data: {
        totalPasajeros,
        sinInformacion: {
          cantidad: cantidadSinInfo,
          porcentaje:
            totalPasajeros > 0
              ? Number(((cantidadSinInfo / totalPasajeros) * 100).toFixed(2))
              : 0,
        },
        distribucion,
        segmentoPredominante: {
          rango: segmentoPredominante.rango,
          cantidad: segmentoPredominante.cantidad,
          porcentaje: segmentoPredominante.porcentaje,
        },
      },
    };
  }

  async getTendenciaIncidentes(query: QueryReporteIncidentesDto) {
    const meses = query.meses ?? 12;
    const ahora = new Date();
    const desde = new Date(ahora);
    desde.setMonth(desde.getMonth() - meses);

    const formatearMes = (fecha: Date): string =>
      `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;

    const desdeStr = formatearMes(desde);
    const hastaStr = formatearMes(ahora);

    const todosLosMeses: string[] = [];
    const cursor = new Date(desde.getFullYear(), desde.getMonth(), 1);
    const hastaDate = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    while (cursor <= hastaDate) {
      todosLosMeses.push(formatearMes(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const filas = await this.reportesIncidentesRepository.getTendenciaRaw(desde, query.empresaId);

    const tiposIncidente = Object.values(TipoIncidente);

    const totalesPorTipo = tiposIncidente.reduce(
      (acc, tipo) => {
        acc[tipo] = filas
          .filter((f) => f.tipo === tipo)
          .reduce((suma, f) => suma + Number(f.cantidad), 0);
        return acc;
      },
      {} as Record<string, number>,
    );

    const totalGeneral = Object.values(totalesPorTipo).reduce(
      (suma, n) => suma + n,
      0,
    );

    const evolucionMensual = todosLosMeses.map((mes) => {
      const filasMes = filas.filter((f) => f.mes === mes);
      const datos = tiposIncidente.reduce(
        (acc, tipo) => {
          const fila = filasMes.find((f) => f.tipo === tipo);
          acc[tipo] = fila ? Number(fila.cantidad) : 0;
          return acc;
        },
        {} as Record<string, number>,
      );
      const totalMes = Object.values(datos).reduce((suma, n) => suma + n, 0);
      return { mes, datos, totalMes };
    });

    return {
      message: 'Tendencia de incidentes obtenida correctamente.',
      data: {
        periodo: { meses, desde: desdeStr, hasta: hastaStr },
        tiposIncidente,
        evolucionMensual,
        totalesPorTipo,
        totalGeneral,
      },
    };
  }
}
