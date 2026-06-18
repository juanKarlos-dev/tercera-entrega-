import { Injectable, NotFoundException } from '@nestjs/common';
import { LessThan, Not } from 'typeorm';
import { EstadoPqrs } from 'src/common/enums/estado-pqrs.enum';
import { NotificacionesService } from 'src/notificaciones/notificaciones.service';
import { ActualizarEstadoPqrsDto } from './dto/actualizar-estado-pqrs.dto';
import { CrearPqrsDto } from './dto/crear-pqrs.dto';
import { Pqrs } from './entities/pqrs.entity';
import { PqrsRepository } from './pqrs.repository';

@Injectable()
export class PqrsService {
  constructor(
    private readonly pqrsRepository: PqrsRepository,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  async crear(dto: CrearPqrsDto): Promise<Pqrs> {
    const pqrs = await this.pqrsRepository.guardar({
      tipo: dto.tipo,
      categoria: dto.categoria,
      descripcion: dto.descripcion,
      email: dto.email,
    });

    const radicado = `PQRS-${new Date().getFullYear()}-${pqrs.id.toString().padStart(6, '0')}`;
    pqrs.radicado = radicado;
    const pqrsConRadicado = await this.pqrsRepository.guardar(pqrs);

    void this.notificacionesService.notificarMasivo({
      destinatarios: [dto.email],
      asunto: `✅ PQRS recibida - Radicado ${radicado}`,
      mensaje: `
        <h2>Tu PQRS fue registrada exitosamente</h2>
        <p><b>Radicado:</b> ${radicado}</p>
        <p><b>Tipo:</b> ${dto.tipo}</p>
        <p><b>Categoría:</b> ${dto.categoria}</p>
        <p><b>Descripción:</b> ${dto.descripcion}</p>
        <p>El tiempo estimado de respuesta es de <b>5 días hábiles</b>.</p>
        <p>Guarda tu número de radicado para consultar el estado de tu solicitud.</p>
      `,
      urgente: false,
    });

    // Llamada adicional a N8N sin bloquear
    fetch('http://localhost:5678/webhook/pqrs-notificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        radicado: radicado,
        tipo: dto.tipo,
        categoria: dto.categoria,
        descripcion: dto.descripcion,
        email: dto.email,
      }),
    }).catch((err) => console.error('Error enviando a N8N (pqrs-notificar):', err));

    return pqrsConRadicado;
  }

  async obtenerTodos(estado?: string, categoria?: string): Promise<Pqrs[]> {
    const where: any = {};
    if (estado) where.estado = estado;
    if (categoria) where.categoria = categoria;

    return this.pqrsRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async vencidos(): Promise<Pqrs[]> {
    // TEMPORAL PARA PRUEBA - cambiar de vuelta a 72 horas después
    const hace72h = new Date(Date.now() - 2 * 60 * 1000);
    return this.pqrsRepository.find({
      where: {
        estado: Not(EstadoPqrs.RESUELTO),
        createdAt: LessThan(hace72h),
      },
      select: ['radicado', 'tipo', 'categoria', 'createdAt', 'email'],
    });
  }

  async consultarRadicado(radicado: string): Promise<Pqrs> {
    const pqrs = await this.pqrsRepository.findByRadicado(radicado);
    if (!pqrs) throw new NotFoundException('Radicado no encontrado');
    return pqrs;
  }

  async cambiarEstado(id: number, dto: ActualizarEstadoPqrsDto): Promise<Pqrs> {
    const pqrs = await this.pqrsRepository.findById(id);
    if (!pqrs) throw new NotFoundException('PQRS no encontrada');

    const estadoAnterior = pqrs.estado;

    await this.pqrsRepository.actualizarEstado(id, dto.estado, dto.respuesta);

    void this.notificacionesService.notificarMasivo({
      destinatarios: [pqrs.email],
      asunto: `📋 Actualización PQRS ${pqrs.radicado} - ${dto.estado}`,
      mensaje: `
        <h2>Actualización de tu PQRS</h2>
        <p><b>Radicado:</b> ${pqrs.radicado}</p>
        <p><b>Nuevo estado:</b> ${dto.estado}</p>
        ${dto.respuesta ? `<p><b>Respuesta:</b> ${dto.respuesta}</p>` : ''}
      `,
      urgente: false,
    });

    // Llamada asíncrona a N8N
    fetch('http://localhost:5678/webhook/pqrs-notificar-estado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: pqrs.email,
        radicado: pqrs.radicado,
        estadoAnterior,
        estadoNuevo: dto.estado,
        respuesta: dto.respuesta,
      }),
    }).catch((err) => console.error('Error enviando a N8N (pqrs-notificar-estado):', err));

    return (await this.pqrsRepository.findById(id)) as Pqrs;
  }
}
