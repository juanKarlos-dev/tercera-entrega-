import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="wrap">
      <mat-card class="card">
        <mat-icon class="ico">block</mat-icon>
        <h1>403 · Acceso denegado</h1>
        <p>No tienes permisos para esta operación según los roles configurados en el backend.</p>
        <div class="actions">
          <button mat-flat-button color="primary" type="button" (click)="home()">Ir al dashboard</button>
          <button mat-button type="button" (click)="logout()">Cerrar sesión e ir al login</button>
        </div>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .wrap {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: #fafafa;
      }
      .card {
        max-width: 480px;
        padding: 32px;
        text-align: center;
      }
      .ico {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #c62828;
      }
      .actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 16px;
      }
    `,
  ],
})
export class ForbiddenComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  home(): void {
    void this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.auth.logout(true);
  }
}
