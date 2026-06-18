import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SecurityApiService } from '../../../core/services/security-api.service';

@Component({
  selector: 'app-complete-github-email',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './complete-github-email.component.html',
  styleUrl: './complete-github-email.component.scss',
})
export class CompleteGithubEmailComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly securityApi = inject(SecurityApiService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  busy = false;

  /** Flujo nuevo: sin usuario en BD; se completa con POST público */
  pendingRegistration = false;
  pendingProviderId = '';
  pendingUsername = '';
  pendingName = '';
  pendingPicture = '';

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    const token = q.get('token');
    if (q.get('requiresEmailCompletion') === '1' && q.get('providerId')) {
      this.pendingRegistration = true;
      this.pendingProviderId = q.get('providerId') ?? '';
      this.pendingUsername = q.get('username') ?? '';
      this.pendingName = q.get('name') ?? '';
      this.pendingPicture = q.get('picture') ?? '';
      return;
    }
    if (token) {
      this.auth.setToken(token);
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const email = this.form.controls.email.value.trim();
    this.busy = true;
    try {
      if (this.pendingRegistration) {
        if (!this.pendingProviderId) {
          this.notify.error('Falta providerId. Vuelve a iniciar sesión con GitHub.');
          return;
        }
        const res = await firstValueFrom(
          this.securityApi.registerGithubAlternateEmail({
            providerId: this.pendingProviderId,
            username: this.pendingUsername || undefined,
            name: this.pendingName || undefined,
            picture: this.pendingPicture || undefined,
            email,
          }),
        );
        if (res.token) {
          this.auth.setToken(res.token);
        }
        if (res.requiresAdditionalInfo && res.user?.id) {
          this.notify.success('Cuenta creada. Completa tu perfil.');
          void this.router.navigate(['/complete-profile'], { queryParams: { userId: res.user.id } });
          return;
        }
        this.notify.success('Cuenta creada correctamente');
        void this.router.navigate(['/dashboard']);
        return;
      }

      if (!this.auth.token()) {
        this.notify.error('Necesitas un token JWT (inicia OAuth con GitHub o pega el JSON en login).');
        return;
      }
      const res = await firstValueFrom(this.securityApi.completeGithubEmail(email));
      if (res.token) {
        this.auth.setToken(res.token);
      }
      if (res.requiresAdditionalInfo && res.user?.id) {
        this.notify.success('Email registrado. Completa tu perfil.');
        void this.router.navigate(['/complete-profile'], { queryParams: { userId: res.user.id } });
        return;
      }
      this.notify.success('Email registrado correctamente');
      void this.router.navigate(['/dashboard']);
    } catch {
      /* global */
    } finally {
      this.busy = false;
    }
  }
}
