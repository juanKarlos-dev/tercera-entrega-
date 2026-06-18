import { IsEmail, IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CategoriaPqrs } from 'src/common/enums/categoria-pqrs.enum';
import { TipoPqrs } from 'src/common/enums/tipo-pqrs.enum';

export class CrearPqrsDto {
  @IsEnum(TipoPqrs)
  tipo!: TipoPqrs;

  @IsEnum(CategoriaPqrs)
  categoria!: CategoriaPqrs;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  descripcion!: string;

  @IsEmail()
  email!: string;
}
