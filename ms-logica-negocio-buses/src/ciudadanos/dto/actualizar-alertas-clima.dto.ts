import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class ActualizarAlertasClimaDto {
  @IsBoolean()
  alertaClima!: boolean;

  @IsOptional()
  @IsEmail()
  emailAlerta?: string;

  @IsOptional()
  @IsString()
  horarioViaje?: string;
}
