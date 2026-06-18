import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { Login2FAResponse } from '../../../core/models/api.models';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RecaptchaService } from '../../../core/services/recaptcha.service';
import { SecurityApiService } from '../../../core/services/security-api.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  readonly environment = environment;

  private readonly fb = inject(FormBuilder);
  private readonly securityApi = inject(SecurityApiService);
  private readonly recaptcha = inject(RecaptchaService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    recaptchaToken: [''], // Opcional manual
  });

  readonly recaptchaConfigured = this.recaptcha.isConfigured();
  submitting = false;
  showPassword = false;

  ngOnInit(): void {
    const oauthError = this.route.snapshot.queryParamMap.get('oauthError');
    if (oauthError) {
      this.notify.error(oauthError);
    }
  }

  oauthGoogle(): void {
    window.location.href = this.securityApi.oauthAuthorizationUrl('google');
  }

  oauthMicrosoft(): void {
    window.location.href = this.securityApi.oauthAuthorizationUrl('microsoft');
  }

  oauthGithub(): void {
    window.location.href = this.securityApi.oauthAuthorizationUrl('github');
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password, recaptchaToken: manualToken } = this.form.getRawValue();

    if (!this.recaptchaConfigured && !manualToken) {
      this.notify.error(
        'Configura recaptchaSiteKey en environment.ts o pega un token manual.',
      );
      return;
    }

    this.submitting = true;

    void (async () => {
      try {
        let recaptchaToken = manualToken;
        if (!recaptchaToken && this.recaptchaConfigured) {
          recaptchaToken = await this.recaptcha.execute('login');
        }
        
        const res = await firstValueFrom(this.securityApi.login({ email, password, recaptchaToken: recaptchaToken || '' }));
        this.onLoginResponse(res);
      } catch (err: unknown) {
        this.handleLoginError(err);
      } finally {
        this.submitting = false;
      }
    })();
  }

  private handleLoginError(err: unknown): void {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        return; // El interceptor global ya muestra el aviso de sin conexión
      }
      this.notify.error('Email o contraseña incorrectos.');
      return;
    }
    if (err instanceof Error) {
      this.notify.error(err.message || 'No se pudo obtener reCAPTCHA. Recarga la página e inténtalo de nuevo.');
      return;
    }
    this.notify.error('No se pudo completar el inicio de sesión.');
  }

  private onLoginResponse(res: Login2FAResponse & { token?: string }): void {
    if (!res) return;

    if (res.success === false) {
      this.notify.error(res.message ?? 'No se pudo iniciar sesión');
      return;
    }

    if (res.requires2FA && res.sessionId) {
      let expiresAtMs: number | undefined;
      const expRaw = res.expiresAt as string | undefined;
      if (expRaw) {
        const parsed = Date.parse(expRaw);
        if (!Number.isNaN(parsed)) expiresAtMs = parsed;
      }
      if (expiresAtMs === undefined) {
        const seconds = res.expiresInSeconds ?? 120;
        expiresAtMs = Date.now() + seconds * 1000;
      }
      const state = {
        sessionId: res.sessionId,
        maskedEmail: res.maskedEmail ?? '',
        codeExpiresAtMs: expiresAtMs,
        attemptsRemaining: res.attemptsRemaining ?? 3,
      };
      
      sessionStorage.setItem('pending2fa', JSON.stringify(state));
      
      void this.router.navigate(['/two-factor'], { state });
      this.notify.info(res.message ?? 'Verifica el código enviado a tu correo.');
      return;
    }

    if (res.token) {
      this.auth.setToken(res.token);
      this.notify.success('Bienvenido');
      this.auth.navigateAfterLogin();
    }
  }

}
