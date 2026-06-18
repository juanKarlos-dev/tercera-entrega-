import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { NotificacionesService } from 'src/notificaciones/notificaciones.service';
import { TipoGrupo } from 'src/common/enums/tipo-grupo.enum';
import { RolGrupo } from 'src/common/enums/rol-grupo.enum';
import { Persona } from 'src/personas/entities/persona.entity';
import { CrearGrupoDto } from './dto/crear-grupo.dto';
import { Grupo } from './entities/grupo.entity';
import { GrupoMiembro } from './entities/grupo-miembro.entity';
import { GrupoMiembrosRepository, GruposRepository } from './grupos.repository';

import { MensajesGateway } from 'src/mensajes/mensajes.gateway';

@Injectable()
export class GruposService {
  constructor(
    private readonly gruposRepo: GruposRepository,
    private readonly grupoMiembrosRepo: GrupoMiembrosRepository,
    private readonly notificacionesService: NotificacionesService,
    @Inject(forwardRef(() => MensajesGateway)) private readonly mensajesGateway: MensajesGateway,
  ) {}

  async crearGrupo(dto: CrearGrupoDto, creadorId: string): Promise<Grupo> {
    const grupo = await this.gruposRepo.saveGrupo({
      nombre:      dto.nombre,
      descripcion: dto.descripcion,
      tipo:        dto.tipo ?? TipoGrupo.PUBLICO,
      creadorId,
      imagen:      dto.imagen ?? null,
    });

    await this.grupoMiembrosRepo.saveMiembro({
      grupoId:   grupo.id,
      usuarioId: creadorId,
      rol:       RolGrupo.ADMIN,
      bloqueado: false,
    });

    for (const memberId of dto.memberIds) {
      await this.grupoMiembrosRepo.saveMiembro({
        grupoId:   grupo.id,
        usuarioId: memberId,
        rol:       RolGrupo.MIEMBRO,
        bloqueado: false,
      });
    }

    const emails = await this.gruposRepo.findEmailsBySecurityUserIds(dto.memberIds);
    if (emails.length > 0) {
      void this.notificacionesService.notificarMasivo({
        destinatarios: emails,
        asunto: `Te han agregado al grupo "${grupo.nombre}"`,
        mensaje: `
          <h2>¡Bienvenido al grupo!</h2>
          <p>Has sido agregado al grupo <b>${grupo.nombre}</b>.</p>
          ${grupo.descripcion ? `<p><b>Descripción:</b> ${grupo.descripcion}</p>` : ''}
          <p>Ya puedes participar en las conversaciones del grupo.</p>
        `,
        urgente: false,
      });
    }

    return grupo;
  }

  async agregarMiembros(grupoId: number, memberIds: string[], adminId: string): Promise<void> {
    const isAdmin = await this.grupoMiembrosRepo.getRolMiembro(grupoId, adminId);
    if (isAdmin !== RolGrupo.ADMIN) {
      throw new ForbiddenException('Solo los administradores pueden agregar miembros');
    }

    const grupo = await this.gruposRepo.findById(grupoId);
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    const addedIds: string[] = [];
    for (const memberId of memberIds) {
      const exists = await this.grupoMiembrosRepo.esMiembro(grupoId, memberId);
      if (!exists) {
        await this.grupoMiembrosRepo.saveMiembro({
          grupoId,
          usuarioId: memberId,
          rol: RolGrupo.MIEMBRO,
          bloqueado: false,
        });
        await this.gruposRepo.saveLog({ grupoId, accion: 'AGREGADO', usuarioObjetivoId: memberId, realizadoPorId: adminId });
        addedIds.push(memberId);
      }
    }

    if (addedIds.length > 0) {
      const emails = await this.gruposRepo.findEmailsBySecurityUserIds(addedIds);
      if (emails.length > 0) {
        void this.notificacionesService.notificarMasivo({
          destinatarios: emails,
          asunto: `Te han agregado al grupo "${grupo.nombre}"`,
          mensaje: `
            <h2>¡Bienvenido al grupo!</h2>
            <p>Has sido agregado al grupo <b>${grupo.nombre}</b> por un administrador.</p>
            ${grupo.descripcion ? `<p><b>Descripción:</b> ${grupo.descripcion}</p>` : ''}
            <p>Ya puedes participar en las conversaciones del grupo.</p>
          `,
          urgente: false,
        });
      }
    }
  }

  buscarUsuarios(q: string, excludeId: string): Promise<Persona[]> {
    return this.gruposRepo.buscarPersonasPorNombre(q, excludeId);
  }

  async actualizarImagen(id: number, url: string): Promise<{ imagen: string }> {
    const grupo = await this.gruposRepo.findById(id);
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    await this.gruposRepo.updateImagen(id, url);
    return { imagen: url };
  }

  async eliminarMensajeComoAdmin(grupoId: number, mensajeId: number, adminId: string): Promise<void> {
    if ((await this.grupoMiembrosRepo.getRolMiembro(grupoId, adminId)) !== RolGrupo.ADMIN)
      throw new ForbiddenException('Solo los administradores del grupo pueden eliminar mensajes');
    const mensaje = await this.gruposRepo.findMensajeEnGrupo(mensajeId, grupoId);
    if (!mensaje) throw new NotFoundException('Mensaje no encontrado en este grupo');
    if (mensaje.deletedByAdmin) throw new BadRequestException('El mensaje ya fue eliminado');
    await this.gruposRepo.eliminarMensajePorAdmin(mensajeId, adminId);
  }

  async listarPublicos(q?: string): Promise<(Grupo & { totalMiembros: number })[]> {
    const grupos = await this.gruposRepo.findPublicos(q);
    return Promise.all(
      grupos.map(async g => ({
        ...g,
        totalMiembros: await this.gruposRepo.countMiembros(g.id),
      })),
    );
  }

  async getMisGrupos(usuarioId: string): Promise<(Grupo & { ultimaLectura: Date; unreadCount: number })[]> {
    const entries = await this.grupoMiembrosRepo.getMisGrupos(usuarioId);
    const grupos = await Promise.all(
      entries.map(async (e) => {
        const g = await this.gruposRepo.findById(e.grupoId);
        if (!g) return null;
        
        // Calcular mensajes directos no leídos
        const unreadDirectosCount = await this.gruposRepo.manager
          .getRepository('Mensaje')
          .createQueryBuilder('m')
          .where('m.grupoId = :grupoId', { grupoId: g.id })
          .andWhere('m.createdAt > :ultimaLectura', { ultimaLectura: e.ultimaLectura })
          .getCount();

        // Calcular mensajes masivos (broadcast) no leídos
        const unreadMasivosCount = await this.gruposRepo.manager.query(`
          SELECT COUNT(m.id) as count
          FROM mensajes_grupales m
          INNER JOIN mensajes_grupales_grupos mg ON mg.mensaje_id = m.id
          WHERE mg.grupo_id = ? AND m.created_at > ?
        `, [g.id, e.ultimaLectura]);

        const totalUnreadCount = unreadDirectosCount + parseInt(unreadMasivosCount[0].count || '0', 10);

        return { ...g, ultimaLectura: e.ultimaLectura, unreadCount: totalUnreadCount };
      })
    );
    return grupos.filter((g): g is (Grupo & { ultimaLectura: Date; unreadCount: number }) => g !== null);
  }

  async unirse(grupoId: number, usuarioId: string): Promise<void> {
    const grupo = await this.gruposRepo.findById(grupoId);
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    if (grupo.tipo === TipoGrupo.PRIVADO) throw new ForbiddenException('Grupo privado');
    if (await this.grupoMiembrosRepo.esBloqueado(grupoId, usuarioId))
      throw new ForbiddenException('Usuario bloqueado del grupo');
    if (await this.grupoMiembrosRepo.esMiembro(grupoId, usuarioId)) return;
    
    await this.grupoMiembrosRepo.saveMiembro({ grupoId, usuarioId, rol: RolGrupo.MIEMBRO, bloqueado: false });
    await this.gruposRepo.saveLog({ grupoId, accion: 'AGREGADO', usuarioObjetivoId: usuarioId, realizadoPorId: usuarioId });

    // Send welcome notification
    const emails = await this.gruposRepo.findEmailsBySecurityUserIds([usuarioId]);
    if (emails.length > 0) {
      void this.notificacionesService.notificarMasivo({
        destinatarios: emails,
        asunto: `¡Bienvenido al grupo ${grupo.nombre}!`,
        mensaje: `
          <h2>¡Bienvenido al grupo!</h2>
          <p>Te has unido exitosamente al grupo <b>${grupo.nombre}</b>.</p>
          ${grupo.descripcion ? `<p><b>Descripción:</b> ${grupo.descripcion}</p>` : ''}
          <p>Ya puedes participar en las conversaciones del grupo.</p>
        `,
        urgente: false,
      });
    }
  }

  async getMiembros(grupoId: number): Promise<(GrupoMiembro & { nombres?: string; apellidos?: string })[]> {
    const miembros = await this.grupoMiembrosRepo.findMiembros(grupoId);
    if (miembros.length === 0) return [];
    const ids = miembros.map(m => m.usuarioId);
    const personas = await this.gruposRepo.getPersonasBySecurityIds(ids);
    const personaMap = new Map(personas.map(p => [p.securityUserId!, p]));
    return miembros.map(m => ({
      ...m,
      nombres: personaMap.get(m.usuarioId)?.nombres,
      apellidos: personaMap.get(m.usuarioId)?.apellidos,
    }));
  }

  async salir(grupoId: number, usuarioId: string): Promise<void> {
    if (!(await this.grupoMiembrosRepo.esMiembro(grupoId, usuarioId))) return;
    const miembros = await this.grupoMiembrosRepo.findMiembros(grupoId);
    const admins = miembros.filter(m => m.rol === RolGrupo.ADMIN);
    if (admins.length === 1 && admins[0].usuarioId === usuarioId)
      throw new BadRequestException('No puedes salir siendo el único administrador del grupo');
    await this.grupoMiembrosRepo.deleteMiembro(grupoId, usuarioId);

    // Add log
    await this.gruposRepo.saveLog({ grupoId, accion: 'SALIO', usuarioObjetivoId: usuarioId, realizadoPorId: usuarioId });

    // Notify admins
    const adminIds = admins.map(a => a.usuarioId);
    if (adminIds.length > 0) {
      const adminEmails = await this.gruposRepo.findEmailsBySecurityUserIds(adminIds);
      if (adminEmails.length > 0) {
        const grupo = await this.gruposRepo.findById(grupoId);
        const userPersona = (await this.gruposRepo.getPersonasBySecurityIds([usuarioId]))[0];
        const userNombre = userPersona ? `${userPersona.nombres} ${userPersona.apellidos}`.trim() : 'Un usuario';
        
        void this.notificacionesService.notificarMasivo({
          destinatarios: adminEmails,
          asunto: `Miembro salió del grupo "${grupo?.nombre}"`,
          mensaje: `
            <h2>Aviso de Membresía</h2>
            <p>El usuario <b>${userNombre}</b> ha abandonado el grupo <b>${grupo?.nombre}</b>.</p>
          `,
          urgente: false,
        });
      }
    }
  }

  async removerMiembro(grupoId: number, adminId: string, usuarioId: string): Promise<void> {
    if ((await this.grupoMiembrosRepo.getRolMiembro(grupoId, adminId)) !== RolGrupo.ADMIN)
      throw new ForbiddenException('Solo los administradores pueden remover miembros');
    if (!(await this.grupoMiembrosRepo.esMiembro(grupoId, usuarioId)))
      throw new NotFoundException('El usuario no es miembro del grupo');
    
    await this.grupoMiembrosRepo.deleteMiembro(grupoId, usuarioId);
    await this.gruposRepo.saveLog({ grupoId, accion: 'REMOVIDO', usuarioObjetivoId: usuarioId, realizadoPorId: adminId });

    const grupo = await this.gruposRepo.findById(grupoId);
    if (grupo) {
      const emails = await this.gruposRepo.findEmailsBySecurityUserIds([usuarioId]);
      if (emails.length > 0) {
        void this.notificacionesService.notificarMasivo({
          destinatarios: emails,
          asunto: `Has sido removido del grupo "${grupo.nombre}"`,
          mensaje: `
            <h2>Notificación del grupo</h2>
            <p>Un administrador te ha removido del grupo <b>${grupo.nombre}</b>.</p>
            <p>Ya no podrás participar ni ver los mensajes de este grupo.</p>
          `,
          urgente: false,
        });
      }
      this.mensajesGateway.emitirRemovidoGrupo(grupoId, usuarioId);
    }
  }

  async promoverMiembro(grupoId: number, adminId: string, usuarioId: string): Promise<void> {
    if ((await this.grupoMiembrosRepo.getRolMiembro(grupoId, adminId)) !== RolGrupo.ADMIN)
      throw new ForbiddenException('Solo los administradores pueden promover miembros');
    if (!(await this.grupoMiembrosRepo.esMiembro(grupoId, usuarioId)))
      throw new NotFoundException('El usuario no es miembro del grupo');
    await this.grupoMiembrosRepo.updateRol(grupoId, usuarioId, RolGrupo.ADMIN);
    await this.gruposRepo.saveLog({ grupoId, accion: 'PROMOVIDO', usuarioObjetivoId: usuarioId, realizadoPorId: adminId });
  }

  async bloquearMiembro(grupoId: number, adminId: string, usuarioId: string): Promise<void> {
    if ((await this.grupoMiembrosRepo.getRolMiembro(grupoId, adminId)) !== RolGrupo.ADMIN)
      throw new ForbiddenException('Solo los administradores pueden bloquear miembros');
    if (!(await this.grupoMiembrosRepo.esMiembro(grupoId, usuarioId)))
      throw new NotFoundException('El usuario no es miembro del grupo');
    await this.grupoMiembrosRepo.updateBloqueado(grupoId, usuarioId, true);
    await this.gruposRepo.saveLog({ grupoId, accion: 'BLOQUEADO', usuarioObjetivoId: usuarioId, realizadoPorId: adminId });
  }

  async getLogs(grupoId: number) {
    return this.gruposRepo.getLogs(grupoId);
  }

  async actualizarUltimaLectura(grupoId: number, usuarioId: string): Promise<void> {
    await this.grupoMiembrosRepo.actualizarUltimaLectura(grupoId, usuarioId);
  }
}
