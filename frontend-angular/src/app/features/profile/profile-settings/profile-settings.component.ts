import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SecurityApiService } from '../../../core/services/security-api.service';
import { UsersApiService } from '../../../core/services/users-api.service';
import { CiudadanosService } from '../../../core/services/ciudadanos.service';
import { User } from '../../../core/models/api.models';
import { Ciudadano } from '../../../core/models/negocio.models';
import { FormsModule } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatDividerModule,
    MatListModule,
    MatChipsModule,
    MatIconModule,
    MatProgressBarModule,
    FormsModule,
    MatSlideToggleModule,
    MatInputModule,
    MatFormFieldModule,
  ],
  templateUrl: './profile-settings.component.html',
  styleUrl: './profile-settings.component.scss',
})
export class ProfileSettingsComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly securityApi = inject(SecurityApiService);
  private readonly notify = inject(NotificationService);
  private readonly usersApi = inject(UsersApiService);
  private readonly ciudadanosApi = inject(CiudadanosService);

  readonly payload = computed(() => this.auth.payload());
  readonly roles = computed(() => this.auth.roleDisplayNames());
  readonly userRecord = signal<User | null>(null);
  readonly ciudadanoRecord = signal<Ciudadano | null>(null);
  
  alertaClima = signal(false);
  emailAlerta = signal('');
  horarioViaje = signal('07:00');
  
  loadingUser = signal(false);

  readonly estadoLabel = computed(() => {
    const u = this.userRecord();
    if (u?.active === undefined) return '—';
    return u.active ? 'Activo' : 'Inactivo';
  });

  busy = false;

  ngOnInit(): void {
    const id = this.auth.payload()?.id;
    if (!id) return;
    this.loadingUser.set(true);
    
    // Obtener User
    void firstValueFrom(this.usersApi.findById(id))
      .then((u) => {
        this.userRecord.set(u);
        return firstValueFrom(this.ciudadanosApi.findBySecurityUserId(id));
      })
      .then((c) => {
        this.ciudadanoRecord.set(c);
        this.alertaClima.set(c.alertaClima || false);
        this.emailAlerta.set(c.emailAlerta || c.email || '');
        this.horarioViaje.set(c.horarioViaje || '07:00');
      })
      .catch(() => {
        // En caso de que no tenga ciudadano (ej. es super admin) no falla
      })
      .finally(() => this.loadingUser.set(false));
  }

  guardarAlertasClima(): void {
    const c = this.ciudadanoRecord();
    if (!c) return;
    
    this.busy = true;
    this.ciudadanosApi.actualizarAlertasClima(c.id!, {
      alertaClima: this.alertaClima(),
      emailAlerta: this.emailAlerta() || undefined,
      horarioViaje: this.horarioViaje() || undefined
    }).subscribe({
      next: () => {
        this.notify.success('Preferencias de alertas guardadas');
        this.busy = false;
      },
      error: () => {
        this.notify.error('Error al guardar preferencias de clima');
        this.busy = false;
      }
    });
  }

  async unlinkGoogle(): Promise<void> {
    const ok = confirm(
      '¿Desvincular Google? Necesitas tener contraseña local configurada en el backend.',
    );
    if (!ok) return;
    this.busy = true;
    try {
      const res = await firstValueFrom(this.securityApi.unlinkGoogle());
      this.notify.success(res.message ?? 'Listo');
    } catch {
      /* ignore */
    } finally {
      this.busy = false;
    }
  }

  async unlinkGithub(): Promise<void> {
    const ok = confirm(
      '¿Desvincular GitHub? Necesitas tener contraseña local configurada en el backend.',
    );
    if (!ok) return;
    this.busy = true;
    try {
      const res = await firstValueFrom(this.securityApi.unlinkGithub());
      this.notify.success(res.message ?? 'Listo');
    } catch {
      /* ignore */
    } finally {
      this.busy = false;
    }
  }
}
