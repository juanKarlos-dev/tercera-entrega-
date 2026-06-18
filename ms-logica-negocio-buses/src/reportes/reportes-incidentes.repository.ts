import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Incidente } from 'src/incidentes/entities/incidente.entity';

@Injectable()
export class ReportesIncidentesRepository extends Repository<Incidente> {
  constructor(private dataSource: DataSource) {
    super(Incidente, dataSource.createEntityManager());
  }

  getTendenciaRaw(
    desde: Date,
    empresaId?: number,
  ): Promise<{ mes: string; tipo: string; cantidad: string }[]> {
    const qb = this.createQueryBuilder('incidente')
      .select("DATE_FORMAT(incidente.fechaHoraReporte, '%Y-%m')", 'mes')
      .addSelect('incidente.tipo', 'tipo')
      .addSelect('COUNT(incidente.id)', 'cantidad')
      .where('incidente.activo = :activo', { activo: true })
      .andWhere('incidente.fechaHoraReporte >= :desde', { desde })
      .groupBy("DATE_FORMAT(incidente.fechaHoraReporte, '%Y-%m')")
      .addGroupBy('incidente.tipo')
      .orderBy("DATE_FORMAT(incidente.fechaHoraReporte, '%Y-%m')", 'ASC');

    if (empresaId) {
      qb.innerJoin('incidente.bus', 'bus')
        .innerJoin('bus.empresa', 'empresa')
        .andWhere('empresa.id = :empresaId', { empresaId });
    }

    return qb.getRawMany();
  }
}
