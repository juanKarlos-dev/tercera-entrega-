import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CategoriaPqrs } from 'src/common/enums/categoria-pqrs.enum';
import { EstadoPqrs } from 'src/common/enums/estado-pqrs.enum';
import { TipoPqrs } from 'src/common/enums/tipo-pqrs.enum';

@Entity('pqrs')
export class Pqrs {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'radicado', type: 'varchar', length: 20, unique: true, nullable: true })
  radicado!: string;

  @Column({ name: 'tipo', type: 'enum', enum: TipoPqrs })
  tipo!: TipoPqrs;

  @Column({ name: 'categoria', type: 'enum', enum: CategoriaPqrs })
  categoria!: CategoriaPqrs;

  @Column({ name: 'descripcion', type: 'varchar', length: 500 })
  descripcion!: string;

  @Column({ name: 'email', type: 'varchar', length: 150 })
  email!: string;

  @Column({ name: 'estado', type: 'enum', enum: EstadoPqrs, default: EstadoPqrs.PENDIENTE })
  estado!: EstadoPqrs;

  @Column({ name: 'respuesta', type: 'varchar', length: 1000, nullable: true })
  respuesta?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
