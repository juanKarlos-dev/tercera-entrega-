import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Boleto } from 'src/boletos/entities/boleto.entity';
import { Ciudadano } from 'src/ciudadanos/entities/ciudadano.entity';
import { Incidente } from 'src/incidentes/entities/incidente.entity';
import { MetodoPagoCiudadano } from 'src/metodos-pago/entities/metodo-pago-ciudadano.entity';
import { MetodoPago } from 'src/metodos-pago/entities/metodos-pago.entity';
import { ReportesBoletosRepository } from './reportes-boletos.repository';
import { ReportesController } from './reportes.controller';
import { ReportesIncidentesRepository } from './reportes-incidentes.repository';
import { ReportesService } from './reportes.service';

@Module({
  imports: [TypeOrmModule.forFeature([Boleto, MetodoPago, MetodoPagoCiudadano, Ciudadano, Incidente])],
  controllers: [ReportesController],
  providers: [ReportesService, ReportesBoletosRepository, ReportesIncidentesRepository],
})
export class ReportesModule {}
