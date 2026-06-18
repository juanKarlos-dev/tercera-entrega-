import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ParseFormDataJsonPipe } from '../common/pipes/parse-form-data.pipe';
import { ActualizarEstadoPqrsDto } from './dto/actualizar-estado-pqrs.dto';
import { CrearPqrsDto } from './dto/crear-pqrs.dto';
import { PqrsService } from './pqrs.service';

@Controller('pqrs')
export class PqrsController {
  constructor(private readonly pqrsService: PqrsService) {}

  @Get('vencidos')
  vencidos() {
    return this.pqrsService.vencidos();
  }

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  crear(
    @Body(ParseFormDataJsonPipe) dto: CrearPqrsDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.pqrsService.crear(dto);
  }

  @Get()
  obtenerTodos(
    @Query('estado') estado?: string,
    @Query('categoria') categoria?: string,
  ) {
    return this.pqrsService.obtenerTodos(estado, categoria);
  }

  @Get(':radicado')
  consultarRadicado(@Param('radicado') radicado: string) {
    return this.pqrsService.consultarRadicado(radicado);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEstadoPqrsDto,
  ) {
    return this.pqrsService.cambiarEstado(id, dto);
  }
}
