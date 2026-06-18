import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { EstadoPqrs } from 'src/common/enums/estado-pqrs.enum';
import { Pqrs } from './entities/pqrs.entity';

@Injectable()
export class PqrsRepository extends Repository<Pqrs> {
  constructor(private dataSource: DataSource) {
    super(Pqrs, dataSource.createEntityManager());
  }

  guardar(p: Partial<Pqrs>): Promise<Pqrs> {
    return this.save(p as Pqrs);
  }

  findByRadicado(radicado: string): Promise<Pqrs | null> {
    return this.findOne({ where: { radicado } });
  }

  findById(id: number): Promise<Pqrs | null> {
    return this.findOne({ where: { id } });
  }

  async actualizarEstado(id: number, estado: EstadoPqrs, respuesta?: string): Promise<void> {
    const updates: Partial<Pqrs> = { id, estado };
    if (respuesta !== undefined) updates.respuesta = respuesta;
    await this.save(updates as Pqrs);
  }
}
