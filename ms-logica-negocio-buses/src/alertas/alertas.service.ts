import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alerta, AlcanceAlerta, EstadoAlerta } from './entities/alerta.entity';
import { MensajesGrupalesRepository } from 'src/mensajes/mensajes-grupales.repository';
import { NotificacionesService } from 'src/notificaciones/notificaciones.service';
import { TipoMensaje } from 'src/common/enums/tipo-mensaje.enum';
import { DataSource } from 'typeorm';
import { SuscripcionBusProximoService } from 'src/tracking/suscripcion-bus-proximo.service';
import { MensajesGateway } from 'src/mensajes/mensajes.gateway';

@Injectable()
export class AlertasService {
  private readonly logger = new Logger(AlertasService.name);

  constructor(
    @InjectRepository(Alerta)
    private readonly alertasRepo: Repository<Alerta>,
    private readonly mensajesGrupalesRepo: MensajesGrupalesRepository,
    private readonly notificacionesSvc: NotificacionesService,
    private readonly dataSource: DataSource,
    private readonly suscripcionesSvc: SuscripcionBusProximoService,
    private readonly mensajesGateway: MensajesGateway,
  ) {}

  async crearAlerta(dto: {
    asunto: string;
    mensaje: string;
    urgente: boolean;
    alcance: AlcanceAlerta;
    rutaId?: number;
    zonaId?: number;
    scheduledAt?: Date;
  }): Promise<Alerta> {
    const isFuture = dto.scheduledAt && new Date(dto.scheduledAt) > new Date();
    
    const alerta = this.alertasRepo.create({
      asunto: dto.asunto,
      mensaje: dto.mensaje,
      urgente: !!dto.urgente,
      alcance: dto.alcance,
      rutaId: dto.rutaId,
      zonaId: dto.zonaId,
      scheduledAt: dto.scheduledAt,
      estado: isFuture ? EstadoAlerta.PENDIENTE : EstadoAlerta.ENVIADA,
    });

    const guardada = await this.alertasRepo.save(alerta);

    if (!isFuture) {
      await this.ejecutarEnvioAlerta(guardada);
    }

    return guardada;
  }

  async contarDestinatarios(alcance: AlcanceAlerta, rutaId?: number, zonaId?: number): Promise<number> {
    const dest = await this.obtenerSecurityUserIds(alcance, rutaId, zonaId);
    return dest.length;
  }

  async getEstadisticas(alertaId: number) {
    const alerta = await this.alertasRepo.findOne({ where: { id: alertaId } });
    if (!alerta) throw new Error('Alerta no encontrada');

    // Si tiene un mensajeGrupalId, podemos sacar datos reales de lectura
    if (alerta.mensajeGrupalId) {
      const result = await this.dataSource.query(`
        SELECT COUNT(*) as totalLeidos
        FROM mensajes_grupales_destinatarios
        WHERE mensaje_id = ? AND leido = true
      `, [alerta.mensajeGrupalId]);
      
      const leidos = parseInt(result[0].totalLeidos, 10) || 0;
      
      // Update the entity optionally
      if (leidos !== alerta.totalLeidos) {
        alerta.totalLeidos = leidos;
        await this.alertasRepo.save(alerta);
      }
    }

    return {
      id: alerta.id,
      estado: alerta.estado,
      totalEnviados: alerta.totalEnviados,
      totalLeidos: alerta.totalLeidos,
      pendientes: alerta.totalEnviados - alerta.totalLeidos,
    };
  }

  async procesarPendientes() {
    const pendientes = await this.alertasRepo.createQueryBuilder('a')
      .where('a.estado = :estado', { estado: EstadoAlerta.PENDIENTE })
      .andWhere('a.scheduledAt <= NOW()')
      .getMany();

    for (const alerta of pendientes) {
      try {
        await this.ejecutarEnvioAlerta(alerta);
      } catch (err: any) {
        this.logger.error(`Error enviando alerta programada ID ${alerta.id}: ${err.message}`);
      }
    }
  }

  private async ejecutarEnvioAlerta(alerta: Alerta) {
    const destinatarios = await this.obtenerSecurityUserIds(alerta.alcance, alerta.rutaId ?? undefined, alerta.zonaId ?? undefined);
    
    if (destinatarios.length === 0) {
      alerta.estado = EstadoAlerta.ENVIADA;
      alerta.totalEnviados = 0;
      await this.alertasRepo.save(alerta);
      return;
    }

    // Guardar en la bandeja unificada (mensajes_grupales) con tipo ALERTA_MASIVA
    const remitenteAdmin = 'SISTEMA_ALERTAS';
    const msg = await this.mensajesGrupalesRepo.guardarMensajeGrupal(
      { remitenteId: remitenteAdmin, contenido: alerta.mensaje, tipo: TipoMensaje.ALERTA_MASIVA },
      [],
      destinatarios
    );

    alerta.estado = EstadoAlerta.ENVIADA;
    alerta.mensajeGrupalId = msg.id;
    alerta.totalEnviados = destinatarios.length;
    await this.alertasRepo.save(alerta);

    // Opcional: si es urgente, enviar push o email?
    // Aquí invocamos el NotificacionesService si se requiere email
    if (alerta.urgente) {
      // Notificación WebSockets
      this.mensajesGateway.emitirAlertaUrgente(destinatarios, alerta);
      
      // Obtenemos los correos reales
      const correos = await this.obtenerEmails(destinatarios);
      this.notificacionesSvc.notificarMasivo({
        destinatarios: correos,
        asunto: alerta.asunto,
        mensaje: alerta.mensaje,
        urgente: true,
      }).catch(e => this.logger.warn(`No se pudo enviar email urgente: ${e.message}`));
    }
  }

  private async obtenerSecurityUserIds(alcance: AlcanceAlerta, rutaId?: number, zonaId?: number): Promise<string[]> {
    if (alcance === AlcanceAlerta.RUTA && rutaId) {
      let citizenIds: string[] = [];
      const emails = this.suscripcionesSvc.getAllEmailsPorRuta(rutaId);
      if (emails.length > 0) {
        const emailList = emails.map(e => `'${e}'`).join(',');
        const result = await this.dataSource.query(
          `SELECT security_user_id FROM personas WHERE email IN (${emailList}) AND activo = true AND security_user_id IS NOT NULL`
        );
        citizenIds = result.map((r: any) => r.security_user_id);
      }

      // Obtener conductores con turno EN_CURSO en la ruta actual
      const driverResult = await this.dataSource.query(`
        SELECT p.security_user_id 
        FROM turnos t
        JOIN programaciones pr ON pr.turno_id = t.id
        JOIN conductores c ON t.conductor_id = c.id
        JOIN personas p ON c.persona_id = p.id
        WHERE pr.ruta_id = ? AND t.estado = 'EN_CURSO' AND p.activo = true AND p.security_user_id IS NOT NULL
      `, [rutaId]);
      const driverIds = driverResult.map((r: any) => r.security_user_id);

      return Array.from(new Set([...citizenIds, ...driverIds]));
    }
    if (alcance === AlcanceAlerta.ZONA && zonaId) {
      let citizenIds: string[] = [];
      const rutasResult = await this.dataSource.query(
        `SELECT DISTINCT rp.ruta_id FROM rutas_paraderos rp JOIN paraderos pa ON pa.id = rp.paradero_id WHERE pa.zona_id = ?`,
        [zonaId]
      );
      const rutaIds: number[] = rutasResult.map((r: any) => r.ruta_id);
      
      let allEmails = new Set<string>();
      rutaIds.forEach(rId => {
        const emails = this.suscripcionesSvc.getAllEmailsPorRuta(rId);
        emails.forEach(e => allEmails.add(e));
      });

      if (allEmails.size > 0) {
        const emailList = Array.from(allEmails).map(e => `'${e}'`).join(',');
        const result = await this.dataSource.query(
          `SELECT security_user_id FROM personas WHERE email IN (${emailList}) AND activo = true AND security_user_id IS NOT NULL`
        );
        citizenIds = result.map((r: any) => r.security_user_id);
      }

      const driverResult = await this.dataSource.query(`
        SELECT p.security_user_id 
        FROM turnos t
        JOIN programaciones pr ON pr.turno_id = t.id
        JOIN rutas_paraderos rp ON rp.ruta_id = pr.ruta_id
        JOIN paraderos pa ON pa.id = rp.paradero_id
        JOIN conductores c ON t.conductor_id = c.id
        JOIN personas p ON c.persona_id = p.id
        WHERE pa.zona_id = ? AND t.estado = 'EN_CURSO' AND p.activo = true AND p.security_user_id IS NOT NULL
      `, [zonaId]);
      const driverIds = driverResult.map((r: any) => r.security_user_id);

      return Array.from(new Set([...citizenIds, ...driverIds]));
    }
    
    // For TODOS, fallback to all users
    const query = `SELECT security_user_id FROM personas WHERE activo = true AND security_user_id IS NOT NULL`;
    const result = await this.dataSource.query(query);
    return result.map((r: any) => r.security_user_id);
  }

  private async obtenerEmails(securityUserIds: string[]): Promise<string[]> {
    if (!securityUserIds.length) return [];
    const ids = securityUserIds.map(id => `'${id}'`).join(',');
    const query = `SELECT email FROM personas WHERE security_user_id IN (${ids}) AND activo = true AND email IS NOT NULL`;
    const result = await this.dataSource.query(query);
    return result.map((r: any) => r.email);
  }
}
