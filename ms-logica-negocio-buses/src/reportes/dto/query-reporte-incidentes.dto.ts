import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class QueryReporteIncidentesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El empresaId debe ser un número entero.' })
  @Min(1, { message: 'El empresaId debe ser mayor a 0.' })
  empresaId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El valor de meses debe ser un número entero.' })
  @Min(3, { message: 'El mínimo de meses para el reporte es 3.' })
  meses?: number;
}
