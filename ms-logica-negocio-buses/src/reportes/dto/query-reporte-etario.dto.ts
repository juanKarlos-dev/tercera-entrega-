import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class QueryReporteEtarioDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El rutaId debe ser un número entero.' })
  @Min(1, { message: 'El rutaId debe ser mayor a 0.' })
  rutaId?: number;

  @IsOptional()
  @IsDateString({}, { message: 'fechaDesde debe ser una fecha válida (YYYY-MM-DD).' })
  fechaDesde?: string;

  @IsOptional()
  @IsDateString({}, { message: 'fechaHasta debe ser una fecha válida (YYYY-MM-DD).' })
  fechaHasta?: string;
}
