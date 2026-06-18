import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('grupo_membresia_log')
export class GrupoMembresiaLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'grupo_id', type: 'int', nullable: false })
  grupoId!: number;

  @Column({ name: 'accion', type: 'varchar', length: 50, nullable: false })
  accion!: string; // 'AGREGADO' | 'REMOVIDO' | 'PROMOVIDO' | 'BLOQUEADO'

  @Column({ name: 'usuario_objetivo_id', type: 'varchar', length: 50, nullable: false })
  usuarioObjetivoId!: string;

  @Column({ name: 'realizado_por_id', type: 'varchar', length: 50, nullable: true })
  realizadoPorId!: string | null;

  @Column({ name: 'fecha', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  fecha!: Date;
}
