import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CrearGrupoDto } from './dto/crear-grupo.dto';
import { GruposService } from './grupos.service';

@Controller('grupos')
export class GruposController {
  constructor(private readonly gruposService: GruposService) {}

  @Get('publicos')
  listarPublicos(@Query('q') q?: string) {
    return this.gruposService.listarPublicos(q);
  }

  @Get('mis-grupos')
  getMisGrupos(@Query('userId') userId: string) {
    return this.gruposService.getMisGrupos(userId);
  }

  @Post()
  crearGrupo(@Body() dto: CrearGrupoDto, @Query('userId') userId: string) {
    return this.gruposService.crearGrupo(dto, userId);
  }

  @Post(':id/unirse')
  unirse(@Param('id', ParseIntPipe) id: number, @Query('userId') userId: string) {
    return this.gruposService.unirse(id, userId);
  }

  @Post(':id/miembros')
  agregarMiembros(
    @Param('id', ParseIntPipe) id: number,
    @Body('memberIds') memberIds: string[],
    @Query('adminId') adminId: string,
  ) {
    return this.gruposService.agregarMiembros(id, memberIds, adminId);
  }

  @Get(':id/miembros')
  getMiembros(@Param('id', ParseIntPipe) id: number) {
    return this.gruposService.getMiembros(id);
  }

  @Get(':id/log-membresia')
  getLogMembresia(@Param('id', ParseIntPipe) id: number) {
    return this.gruposService.getLogs(id);
  }

  @Delete(':id/salir')
  salir(@Param('id', ParseIntPipe) id: number, @Query('userId') userId: string) {
    return this.gruposService.salir(id, userId);
  }

  @Delete(':id/miembros/:usuarioId')
  removerMiembro(
    @Param('id', ParseIntPipe) id: number,
    @Param('usuarioId') usuarioId: string,
    @Query('adminId') adminId: string,
  ) {
    return this.gruposService.removerMiembro(id, adminId, usuarioId);
  }

  @Patch(':id/miembros/:usuarioId/promover')
  promoverMiembro(
    @Param('id', ParseIntPipe) id: number,
    @Param('usuarioId') usuarioId: string,
    @Query('adminId') adminId: string,
  ) {
    return this.gruposService.promoverMiembro(id, adminId, usuarioId);
  }

  @Patch(':id/miembros/:usuarioId/bloquear')
  bloquearMiembro(
    @Param('id', ParseIntPipe) id: number,
    @Param('usuarioId') usuarioId: string,
    @Query('adminId') adminId: string,
  ) {
    return this.gruposService.bloquearMiembro(id, adminId, usuarioId);
  }

  @Patch(':id/ultima-lectura')
  actualizarUltimaLectura(
    @Param('id', ParseIntPipe) id: number,
    @Query('userId') userId: string,
  ) {
    return this.gruposService.actualizarUltimaLectura(id, userId);
  }

  @Get('buscar-usuarios')
  buscarUsuarios(
    @Query('q') q: string,
    @Query('excludeId') excludeId: string,
  ) {
    if (!q || q.length < 2) return [];
    return this.gruposService.buscarUsuarios(q, excludeId);
  }

  @Post(':id/imagen')
  @UseInterceptors(
    FileInterceptor('imagen', {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          const uploadPath = './uploads/grupos';
          mkdirSync(uploadPath, { recursive: true });
          callback(null, uploadPath);
        },
        filename: (_req, file, callback) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1_000_000_000)}`;
          callback(null, `grupo-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, callback) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
          return callback(
            new BadRequestException('La imagen debe ser JPG, PNG o WEBP.'),
            false,
          );
        }
        callback(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  subirImagen(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Debe adjuntar una imagen.');
    return this.gruposService.actualizarImagen(id, `/uploads/grupos/${file.filename}`);
  }

  @Delete(':groupId/messages/:messageId')
  eliminarMensaje(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('messageId', ParseIntPipe) messageId: number,
    @Query('adminId') adminId: string,
  ) {
    return this.gruposService.eliminarMensajeComoAdmin(groupId, messageId, adminId);
  }
}
