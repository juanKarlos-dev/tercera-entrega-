import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { AlertasService } from './alertas.service';
import { AlcanceAlerta } from './entities/alerta.entity';

@Controller('alertas')
export class AlertasController {
  constructor(private readonly alertasService: AlertasService) {}

  @Post('masiva')
  crearAlerta(
    @Body() dto: {
      asunto: string;
      mensaje: string;
      urgente: boolean;
      alcance: AlcanceAlerta;
      rutaId?: number;
      zonaId?: number;
      scheduledAt?: Date;
    }
  ) {
    return this.alertasService.crearAlerta(dto);
  }

  @Get('contar-destinatarios')
  contarDestinatarios(
    @Query('alcance') alcance: AlcanceAlerta,
    @Query('rutaId') rutaId?: string,
    @Query('zonaId') zonaId?: string,
  ) {
    return this.alertasService.contarDestinatarios(
      alcance,
      rutaId ? parseInt(rutaId, 10) : undefined,
      zonaId ? parseInt(zonaId, 10) : undefined
    ).then(total => ({ total }));
  }

  @Get(':id/estadisticas')
  getEstadisticas(@Param('id', ParseIntPipe) id: number) {
    return this.alertasService.getEstadisticas(id);
  }
}
