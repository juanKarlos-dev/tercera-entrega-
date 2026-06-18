import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snack = inject(MatSnackBar);

  success(message: string): void {
    this.snack.open(message, 'Cerrar', { duration: 3500 });
  }

  error(message: string): void {
    this.snack.open(message, 'Cerrar', {
      duration: 6000,
      panelClass: ['snackbar-error'],
    });
  }

  info(message: string): void {
    this.snack.open(message, 'Cerrar', { duration: 4500 });
  }

  warning(message: string): void {
    this.snack.open(message, 'Cerrar', {
      duration: 5000,
      panelClass: ['snackbar-warning'],
    });
  }
}
