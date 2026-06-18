import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'estadoBadge', standalone: true, pure: true })
export class EstadoBadgePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    switch (value?.toUpperCase()) {
      case 'ACTIVO':
      case 'OPERATIVO':
      case 'COMPLETADO':
      case 'FINALIZADO':
      case 'RESUELTO':
      case 'DESCENDIDO':
        return 'chip-activo';

      case 'PENDIENTE':
      case 'MANTENIMIENTO':
      case 'PROGRAMADO':
        return 'chip-pendiente';

      case 'EN_CURSO':
      case 'EN_REVISION':
      case 'ABORDADO':
        return 'chip-en-curso';

      case 'INACTIVO':
      case 'FUERA_DE_SERVICIO':
      case 'CANCELADO':
      case 'GRAVE':
      case 'CRITICO':
        return 'chip-inactivo';

      default:
        return 'chip-pendiente';
    }
  }
}
