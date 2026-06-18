import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { QueryReporteEtarioDto } from './dto/query-reporte-etario.dto';
import { QueryReporteIncidentesDto } from './dto/query-reporte-incidentes.dto';
import { QueryReporteIngresosDto } from './dto/query-reporte-ingresos.dto';
import { ReportesService } from './reportes.service';

@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('ingresos-por-metodo-pago')
  getIngresosPorMetodoPago(@Query() query: QueryReporteIngresosDto) {
    return this.reportesService.getIngresosPorMetodoPago(query);
  }

  @Get('ingresos-por-metodo-pago/exportar')
  async exportarIngresosPorMetodoPago(
    @Query() query: QueryReporteIngresosDto,
    @Res() res: Response,
  ) {
    const resultado =
      await this.reportesService.getIngresosPorMetodoPago(query);

    const header = 'mes,TARJETA_PREPAGADA,EFECTIVO,QR,totalMes';
    const rows = resultado.data.evolucionMensual.map(
      (f) =>
        `${f.mes},${f.datos['TARJETA_PREPAGADA']},${f.datos['EFECTIVO']},${f.datos['QR']},${f.totalMes}`,
    );
    const csv = [header, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="ingresos-metodo-pago.csv"',
    );
    res.send(csv);
  }

  @Get('distribucion-etaria')
  getDistribucionEtaria(@Query() query: QueryReporteEtarioDto) {
    return this.reportesService.getDistribucionEtaria(query);
  }

  @Get('distribucion-etaria/exportar')
  async exportarDistribucionEtaria(
    @Query() query: QueryReporteEtarioDto,
    @Res() res: Response,
  ) {
    const resultado = await this.reportesService.getDistribucionEtaria(query);

    const header = 'rango,cantidad,porcentaje';
    const rows = resultado.data.distribucion.map(
      (f) => `"${f.rango}",${f.cantidad},${f.porcentaje}`,
    );
    const csv = [header, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="distribucion-etaria.csv"',
    );
    res.send(csv);
  }

  @Get('tendencia-incidentes')
  getTendenciaIncidentes(@Query() query: QueryReporteIncidentesDto) {
    return this.reportesService.getTendenciaIncidentes(query);
  }
}
