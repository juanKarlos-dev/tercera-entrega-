import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoGrupo } from 'src/common/enums/tipo-grupo.enum';

@Entity('grupos')
export class Grupo {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'nombre', type: 'varchar', length: 100, nullable: false })
  nombre!: string;

  @Column({ name: 'descripcion', type: 'varchar', length: 500, nullable: true })
  descripcion?: string | null;

  @Column({
    name: 'tipo',
    type: 'enum',
    enum: TipoGrupo,
    default: TipoGrupo.PUBLICO,
  })
  tipo!: TipoGrupo;

  @Column({ name: 'creador_id', type: 'varchar', length: 50, nullable: false })
  creadorId!: string;

  @Column({ name: 'imagen', type: 'varchar', length: 255, nullable: true })
  imagen?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
