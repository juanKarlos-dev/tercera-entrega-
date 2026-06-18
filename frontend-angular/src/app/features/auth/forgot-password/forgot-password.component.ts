import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { RecaptchaService } from '../../../core/services/recaptcha.service';
import { SecurityApiService } from '../../../core/services/security-api.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly securityApi = inject(SecurityApiService);
  private readonly recaptcha = inject(RecaptchaService);
  private readonly notify = inject(NotificationService);

  readonly recaptchaConfigured = this.recaptcha.isConfigured();

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submitting = false;
  submitted = false;

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.recaptchaConfigured) {
      this.notify.error('Configura recaptchaSiteKey en environment.ts');
      return;
    }
    this.submitting = true;
    try {
      const recaptchaToken = await this.recaptcha.execute('forgot_password');
      const res = await firstValueFrom(
        this.securityApi.forgotPassword({
          email: this.form.controls.email.value,
          recaptchaToken,
        }),
      );
      this.submitted = true;
      this.notify.success(res.message ?? 'Si el email existe, recibirá instrucciones de recuperación');
    } catch (err: unknown) {
      if (err instanceof HttpErrorResponse) {
        const body = err.error as { message?: string } | undefined;
        this.notify.error(body?.message ?? 'No se pudo procesar la solicitud de recuperación.');
      } else if (err instanceof Error) {
        this.notify.error(err.message || 'No se pudo ejecutar reCAPTCHA. Intenta nuevamente.');
      } else {
        this.notify.error('No se pudo ejecutar la verificación reCAPTCHA.');
      }
    } finally {
      this.submitting = false;
    }
  }
}
