import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificacionesModule } from 'src/notificaciones/notificaciones.module';
import { MensajesModule } from 'src/mensajes/mensajes.module';
import { AlertasController } from './alertas.controller';
import { AlertasService } from './alertas.service';
import { Alerta } from './entities/alerta.entity';
import { AlertasCron } from './alertas.cron';
import { TrackingModule } from 'src/tracking/tracking.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alerta]),
    NotificacionesModule,
    MensajesModule,
    TrackingModule,
  ],
  controllers: [AlertasController],
  providers: [AlertasService, AlertasCron],
})
export class AlertasModule {}
