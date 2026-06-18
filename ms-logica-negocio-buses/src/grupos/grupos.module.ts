import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificacionesModule } from 'src/notificaciones/notificaciones.module';
import { Mensaje } from 'src/mensajes/entities/mensaje.entity';
import { Persona } from 'src/personas/entities/persona.entity';
import { GrupoMiembro } from './entities/grupo-miembro.entity';
import { Grupo } from './entities/grupo.entity';
import { GruposController } from './grupos.controller';
import { GrupoMiembrosRepository, GruposRepository } from './grupos.repository';
import { GruposService } from './grupos.service';

import { MensajesModule } from 'src/mensajes/mensajes.module';

import { GrupoMembresiaLog } from './entities/grupo-membresia-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Grupo, GrupoMiembro, Persona, Mensaje, GrupoMembresiaLog]),
    NotificacionesModule,
    forwardRef(() => MensajesModule),
  ],
  controllers: [GruposController],
  providers: [GruposRepository, GrupoMiembrosRepository, GruposService],
  exports: [GruposService, GrupoMiembrosRepository],
})
export class GruposModule {}
