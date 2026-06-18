import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstadoPqrs } from 'src/common/enums/estado-pqrs.enum';

export class ActualizarEstadoPqrsDto {
  @IsEnum(EstadoPqrs)
  estado!: EstadoPqrs;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  respuesta?: string;
}
