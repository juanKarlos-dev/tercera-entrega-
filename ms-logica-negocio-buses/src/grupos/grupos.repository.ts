import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { RolGrupo } from 'src/common/enums/rol-grupo.enum';
import { TipoGrupo } from 'src/common/enums/tipo-grupo.enum';
import { Mensaje } from 'src/mensajes/entities/mensaje.entity';
import { Persona } from 'src/personas/entities/persona.entity';
import { GrupoMiembro } from './entities/grupo-miembro.entity';
import { Grupo } from './entities/grupo.entity';

import { GrupoMembresiaLog } from './entities/grupo-membresia-log.entity';

@Injectable()
export class GruposRepository extends Repository<Grupo> {
  constructor(private dataSource: DataSource) {
    super(Grupo, dataSource.createEntityManager());
  }

  saveLog(log: Partial<GrupoMembresiaLog>): Promise<GrupoMembresiaLog> {
    return this.dataSource.getRepository(GrupoMembresiaLog).save(log);
  }

  async getLogs(grupoId: number): Promise<(GrupoMembresiaLog & { objetivoNombres?: string; objetivoApellidos?: string; actorNombres?: string; actorApellidos?: string })[]> {
    const logs = await this.dataSource.getRepository(GrupoMembresiaLog).find({
      where: { grupoId },
      order: { fecha: 'DESC' },
    });
    
    if (logs.length === 0) return [];
    
    const ids = new Set<string>();
    logs.forEach(l => {
      ids.add(l.usuarioObjetivoId);
      if (l.realizadoPorId) ids.add(l.realizadoPorId);
    });
    
    const personas = await this.getPersonasBySecurityIds(Array.from(ids));
    const pMap = new Map(personas.map(p => [p.securityUserId, p]));
    
    return logs.map(l => ({
      ...l,
      objetivoNombres: pMap.get(l.usuarioObjetivoId)?.nombres,
      objetivoApellidos: pMap.get(l.usuarioObjetivoId)?.apellidos,
      actorNombres: l.realizadoPorId ? pMap.get(l.realizadoPorId)?.nombres : undefined,
      actorApellidos: l.realizadoPorId ? pMap.get(l.realizadoPorId)?.apellidos : undefined,
    }));
  }

  findPublicos(q?: string): Promise<Grupo[]> {
    const qb = this.createQueryBuilder('g')
      .where('g.tipo = :tipo', { tipo: TipoGrupo.PUBLICO });
      
    if (q) {
      qb.andWhere('(LOWER(g.nombre) LIKE LOWER(:q) OR LOWER(g.descripcion) LIKE LOWER(:q))', { q: `%${q}%` });
    }
    
    return qb.orderBy('g.createdAt', 'DESC').getMany();
  }

  findById(id: number): Promise<Grupo | null> {
    return this.findOne({ where: { id } });
  }

  saveGrupo(g: Partial<Grupo>): Promise<Grupo> {
    return this.save(g);
  }

  async countMiembros(grupoId: number): Promise<number> {
    const result = await this.dataSource
      .getRepository(GrupoMiembro)
      .createQueryBuilder('gm')
      .where('gm.grupoId = :grupoId', { grupoId })
      .getCount();
    return result;
  }

  buscarPersonasPorNombre(q: string, excludeId: string): Promise<Persona[]> {
    const term = `%${q}%`;
    return this.dataSource
      .getRepository(Persona)
      .createQueryBuilder('p')
      .where('p.activo = :activo', { activo: true })
      .andWhere('(p.nombres LIKE :term OR p.apellidos LIKE :term OR p.email LIKE :term)', { term })
      .andWhere('p.securityUserId != :excludeId', { excludeId })
      .andWhere('p.securityUserId IS NOT NULL')
      .select(['p.securityUserId', 'p.nombres', 'p.apellidos', 'p.email'])
      .limit(10)
      .getMany();
  }

  async findEmailsBySecurityUserIds(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const personas = await this.dataSource
      .getRepository(Persona)
      .createQueryBuilder('p')
      .where('p.securityUserId IN (:...ids)', { ids })
      .andWhere('p.activo = :activo', { activo: true })
      .select(['p.email'])
      .getMany();
    return personas.map(p => p.email);
  }

  async getPersonasBySecurityIds(ids: string[]): Promise<Persona[]> {
    if (ids.length === 0) return [];
    return this.dataSource
      .getRepository(Persona)
      .createQueryBuilder('p')
      .select(['p.securityUserId', 'p.nombres', 'p.apellidos'])
      .where('p.securityUserId IN (:...ids)', { ids })
      .getMany();
  }

  async updateImagen(id: number, url: string): Promise<void> {
    await this.createQueryBuilder()
      .update(Grupo)
      .set({ imagen: url })
      .where('id = :id', { id })
      .execute();
  }

  async findMensajeEnGrupo(mensajeId: number, grupoId: number): Promise<Mensaje | null> {
    return this.dataSource
      .getRepository(Mensaje)
      .findOne({ where: { id: mensajeId, grupoId } });
  }

  async eliminarMensajePorAdmin(mensajeId: number, adminId: string): Promise<void> {
    await this.dataSource
      .getRepository(Mensaje)
      .update(mensajeId, {
        deletedByAdmin: true,
        deletedAt: new Date(),
        deletedByUserId: adminId,
      });
  }
}

@Injectable()
export class GrupoMiembrosRepository extends Repository<GrupoMiembro> {
  constructor(private dataSource: DataSource) {
    super(GrupoMiembro, dataSource.createEntityManager());
  }

  findMiembros(grupoId: number): Promise<GrupoMiembro[]> {
    return this.createQueryBuilder('gm')
      .where('gm.grupoId = :grupoId', { grupoId })
      .orderBy('gm.fechaUnion', 'ASC')
      .getMany();
  }

  findMiembro(grupoId: number, usuarioId: string): Promise<GrupoMiembro | null> {
    return this.findOne({ where: { grupoId, usuarioId } });
  }

  async esMiembro(grupoId: number, usuarioId: string): Promise<boolean> {
    return (await this.findMiembro(grupoId, usuarioId)) !== null;
  }

  async esBloqueado(grupoId: number, usuarioId: string): Promise<boolean> {
    const m = await this.findMiembro(grupoId, usuarioId);
    return m?.bloqueado === true;
  }

  saveMiembro(m: Partial<GrupoMiembro>): Promise<GrupoMiembro> {
    return this.save(m);
  }

  async deleteMiembro(grupoId: number, usuarioId: string): Promise<void> {
    await this.createQueryBuilder()
      .delete()
      .from(GrupoMiembro)
      .where('grupo_id = :grupoId AND usuario_id = :usuarioId', { grupoId, usuarioId })
      .execute();
  }

  getMisGrupos(usuarioId: string): Promise<GrupoMiembro[]> {
    return this.createQueryBuilder('gm')
      .where('gm.usuarioId = :usuarioId', { usuarioId })
      .andWhere('gm.bloqueado = :bloqueado', { bloqueado: false })
      .getMany();
  }

  async updateRol(grupoId: number, usuarioId: string, rol: RolGrupo): Promise<void> {
    await this.createQueryBuilder()
      .update(GrupoMiembro)
      .set({ rol })
      .where('grupo_id = :grupoId AND usuario_id = :usuarioId', { grupoId, usuarioId })
      .execute();
  }

  async updateBloqueado(grupoId: number, usuarioId: string, bloqueado: boolean): Promise<void> {
    await this.createQueryBuilder()
      .update(GrupoMiembro)
      .set({ bloqueado })
      .where('grupo_id = :grupoId AND usuario_id = :usuarioId', { grupoId, usuarioId })
      .execute();
  }

  async getRolMiembro(grupoId: number, usuarioId: string): Promise<RolGrupo | null> {
    const m = await this.findMiembro(grupoId, usuarioId);
    return m?.rol ?? null;
  }

  async actualizarUltimaLectura(grupoId: number, usuarioId: string): Promise<void> {
    await this.createQueryBuilder()
      .update(GrupoMiembro)
      .set({ ultimaLectura: new Date() })
      .where('grupo_id = :grupoId AND usuario_id = :usuarioId', { grupoId, usuarioId })
      .execute();
  }
}
