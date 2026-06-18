import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificacionesModule } from 'src/notificaciones/notificaciones.module';
import { Pqrs } from './entities/pqrs.entity';
import { PqrsController } from './pqrs.controller';
import { PqrsRepository } from './pqrs.repository';
import { PqrsService } from './pqrs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pqrs]),
    NotificacionesModule,
    MulterModule.register({ dest: './uploads/pqrs' }),
  ],
  controllers: [PqrsController],
  providers: [PqrsRepository, PqrsService],
})
export class PqrsModule {}
