import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, ArrayMinSize } from 'class-validator';
import { TipoGrupo } from 'src/common/enums/tipo-grupo.enum';

export class CrearGrupoDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsEnum(TipoGrupo)
  @IsOptional()
  tipo?: TipoGrupo;

  @IsArray()
  @ArrayMinSize(2, { message: 'Debes agregar al menos 2 miembros además del creador' })
  @IsString({ each: true })
  memberIds!: string[];

  @IsString()
  @IsOptional()
  imagen?: string;
}
