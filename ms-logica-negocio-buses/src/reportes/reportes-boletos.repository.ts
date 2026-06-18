import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Boleto } from 'src/boletos/entities/boleto.entity';
import { EstadoBoleto } from 'src/common/enums/estado-boleto.enum';

@Injectable()
export class ReportesBoletosRepository extends Repository<Boleto> {
  constructor(private dataSource: DataSource) {
    super(Boleto, dataSource.createEntityManager());
  }

  getIngresosRaw(
    desde: Date,
    empresaId?: number,
  ): Promise<{ mes: string; tipo: string; nombre: string; total: string }[]> {
    const qb = this.createQueryBuilder('boleto')
      .select("DATE_FORMAT(boleto.fechaHoraAbordaje, '%Y-%m')", 'mes')
      .addSelect('metodoPago.tipo', 'tipo')
      .addSelect('metodoPago.nombre', 'nombre')
      .addSelect('SUM(boleto.tarifaAplicada)', 'total')
      .innerJoin('boleto.metodoPagoCiudadano', 'mpc')
      .innerJoin('mpc.metodoPago', 'metodoPago')
      .where('boleto.activo = :activo', { activo: true })
      .andWhere('boleto.estado IN (:...estados)', {
        estados: [EstadoBoleto.COMPLETADO, EstadoBoleto.ACTIVO],
      })
      .andWhere('boleto.fechaHoraAbordaje >= :desde', { desde })
      .groupBy("DATE_FORMAT(boleto.fechaHoraAbordaje, '%Y-%m')")
      .addGroupBy('metodoPago.tipo')
      .addGroupBy('metodoPago.nombre')
      .orderBy("DATE_FORMAT(boleto.fechaHoraAbordaje, '%Y-%m')", 'ASC');

    if (empresaId) {
      qb.innerJoin('boleto.programacion', 'programacion').andWhere(
        'programacion.empresa = :empresaId',
        { empresaId },
      );
    }

    return qb.getRawMany();
  }

  getDistribucionEtariaRaw(
    rutaId?: number,
    fechaDesde?: string,
    fechaHasta?: string,
  ): Promise<{ rangoEtario: string; cantidad: string }[]> {
    const rangosCaso = this.buildRangosCaso();

    const qb = this.createQueryBuilder('boleto')
      .select(rangosCaso, 'rangoEtario')
      .addSelect('COUNT(boleto.id)', 'cantidad')
      .innerJoin('boleto.ciudadano', 'ciudadano')
      .where('boleto.activo = :activo', { activo: true })
      .groupBy(rangosCaso);

    if (rutaId) {
      qb.innerJoin('boleto.programacion', 'programacion').andWhere(
        'programacion.ruta = :rutaId',
        { rutaId },
      );
    }

    if (fechaDesde) {
      qb.andWhere('boleto.fechaHoraAbordaje >= :fechaDesde', { fechaDesde });
    }

    if (fechaHasta) {
      qb.andWhere('boleto.fechaHoraAbordaje <= :fechaHasta', { fechaHasta });
    }

    return qb.getRawMany();
  }

  getDistribucionEtariaPorPeriodo(
    desde: Date,
    hasta: Date,
    rutaId?: number,
  ): Promise<{ rangoEtario: string; cantidad: string }[]> {
    const rangosCaso = this.buildRangosCaso();

    const qb = this.createQueryBuilder('boleto')
      .select(rangosCaso, 'rangoEtario')
      .addSelect('COUNT(boleto.id)', 'cantidad')
      .innerJoin('boleto.ciudadano', 'ciudadano')
      .where('boleto.activo = :activo', { activo: true })
      .andWhere('boleto.fechaHoraAbordaje >= :desde', { desde })
      .andWhere('boleto.fechaHoraAbordaje < :hasta', { hasta })
      .groupBy(rangosCaso);

    if (rutaId) {
      qb.innerJoin('boleto.programacion', 'programacion').andWhere(
        'programacion.ruta = :rutaId',
        { rutaId },
      );
    }

    return qb.getRawMany();
  }

  private buildRangosCaso(): string {
    return `CASE
      WHEN ciudadano.fecha_nacimiento IS NULL THEN 'SIN_INFORMACION'
      WHEN TIMESTAMPDIFF(YEAR, ciudadano.fecha_nacimiento, NOW()) < 18 THEN 'Menores'
      WHEN TIMESTAMPDIFF(YEAR, ciudadano.fecha_nacimiento, NOW()) BETWEEN 18 AND 25 THEN 'Jovenes'
      WHEN TIMESTAMPDIFF(YEAR, ciudadano.fecha_nacimiento, NOW()) BETWEEN 26 AND 40 THEN 'AdultosJovenes'
      WHEN TIMESTAMPDIFF(YEAR, ciudadano.fecha_nacimiento, NOW()) BETWEEN 41 AND 60 THEN 'Adultos'
      ELSE 'AdultosMayores'
    END`;
  }
}
