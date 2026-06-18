import { IsArray, IsBoolean, IsEmail, IsString, ArrayMinSize } from 'class-validator';

export class AlertaMasivaDto {
  @IsString()
  asunto!: string;

  @IsString()
  mensaje!: string;

  @IsBoolean()
  urgente!: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @IsEmail({}, { each: true })
  destinatarios!: string[];
}
