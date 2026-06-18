import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NotificacionesService } from './notificaciones.service';

@Module({
  imports: [HttpModule],
  providers: [NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
