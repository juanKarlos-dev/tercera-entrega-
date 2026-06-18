import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum AlcanceAlerta {
  TODOS = 'TODOS',
  RUTA = 'RUTA',
  ZONA = 'ZONA',
}

export enum EstadoAlerta {
  PENDIENTE = 'PENDIENTE',
  ENVIADA = 'ENVIADA',
}

@Entity('alertas_masivas')
export class Alerta {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'asunto', type: 'varchar', length: 150 })
  asunto!: string;

  @Column({ name: 'mensaje', type: 'text' })
  mensaje!: string;

  @Column({ name: 'urgente', type: 'boolean', default: false })
  urgente!: boolean;

  @Column({ name: 'alcance', type: 'enum', enum: AlcanceAlerta, default: AlcanceAlerta.TODOS })
  alcance!: AlcanceAlerta;

  @Column({ name: 'ruta_id', type: 'int', nullable: true })
  rutaId?: number | null;

  @Column({ name: 'zona_id', type: 'int', nullable: true })
  zonaId?: number | null;

  @Column({ name: 'scheduled_at', type: 'datetime', nullable: true })
  scheduledAt?: Date | null;

  @Column({ name: 'estado', type: 'enum', enum: EstadoAlerta, default: EstadoAlerta.PENDIENTE })
  estado!: EstadoAlerta;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'mensaje_grupal_id', type: 'int', nullable: true })
  mensajeGrupalId?: number | null;

  @Column({ name: 'total_enviados', type: 'int', default: 0 })
  totalEnviados!: number;

  @Column({ name: 'total_leidos', type: 'int', default: 0 })
  totalLeidos!: number;
}
