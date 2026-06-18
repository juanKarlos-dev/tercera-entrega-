import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class QueryReporteIngresosDto {
  @Type(() => Number)
  @IsIn([3, 6, 12], { message: 'El valor de meses debe ser 3, 6 o 12.' })
  meses!: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'El empresaId debe ser un número entero.' })
  @Min(1, { message: 'El empresaId debe ser mayor a 0.' })
  empresaId?: number;
}
