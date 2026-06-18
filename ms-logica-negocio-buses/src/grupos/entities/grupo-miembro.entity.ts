import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { RolGrupo } from 'src/common/enums/rol-grupo.enum';

@Entity('grupo_miembros')
export class GrupoMiembro {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'grupo_id', type: 'int', nullable: false })
  grupoId!: number;

  @Column({ name: 'usuario_id', type: 'varchar', length: 50, nullable: false })
  usuarioId!: string;

  @Column({
    name: 'rol',
    type: 'enum',
    enum: RolGrupo,
    default: RolGrupo.MIEMBRO,
  })
  rol!: RolGrupo;

  @Column({
    name: 'fecha_union',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaUnion!: Date;

  @Column({ name: 'bloqueado', type: 'boolean', default: false })
  bloqueado!: boolean;

  @Column({
    name: 'ultima_lectura',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  ultimaLectura!: Date;
}
