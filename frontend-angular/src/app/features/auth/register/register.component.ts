import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { RecaptchaService } from '../../../core/services/recaptcha.service';
import { UsersApiService } from '../../../core/services/users-api.service';

type PasswordStrengthLevel = 'weak' | 'medium' | 'strong';

@Component({
  selector: 'app-register',
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
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly usersApi = inject(UsersApiService);
  private readonly recaptcha = inject(RecaptchaService);
  private readonly notify = inject(NotificationService);

  readonly recaptchaConfigured = this.recaptcha.isConfigured();

  readonly form = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2)]],
      lastname: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      recaptchaToken: [''], // Manual token
    },
    { validators: [RegisterComponent.passwordsMatch] },
  );

  submitting = false;
  showPassword = false;
  showConfirmPassword = false;

  get hasUpperCase(): boolean {
    return /[A-Z]/.test(this.form.controls.password.value);
  }

  get hasLowerCase(): boolean {
    return /[a-z]/.test(this.form.controls.password.value);
  }

  get hasNumber(): boolean {
    return /\d/.test(this.form.controls.password.value);
  }

  get hasSpecialChar(): boolean {
    return /[^A-Za-z0-9]/.test(this.form.controls.password.value);
  }

  get passwordStrength(): PasswordStrengthLevel | null {
    const password = this.form.controls.password.value;
    if (!password) {
      return null;
    }

    let score = 0;

    if (password.length >= 8) {
      score++;
    }
    if (/[A-Z]/.test(password)) {
      score++;
    }
    if (/[a-z]/.test(password)) {
      score++;
    }
    if (/\d/.test(password)) {
      score++;
    }
    if (/[^A-Za-z0-9]/.test(password)) {
      score++;
    }

    if (score >= 5) {
      return 'strong';
    }
    if (score >= 3) {
      return 'medium';
    }
    return 'weak';
  }

  get passwordStrengthLabel(): string {
    switch (this.passwordStrength) {
      case 'strong':
        return 'Fuerte';
      case 'medium':
        return 'Media';
      case 'weak':
        return 'Débil';
      default:
        return '';
    }
  }

  private static passwordsMatch(control: AbstractControl): ValidationErrors | null {
    const p = control.get('password')?.value;
    const c = control.get('confirmPassword')?.value;
    if (p && c && p !== c) {
      return { mismatch: true };
    }
    return null;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const manualToken = v.recaptchaToken;

    if (!this.recaptchaConfigured && !manualToken) {
      this.notify.error('Configura recaptchaSiteKey en environment.ts o pega un token manual.');
      return;
    }

    this.submitting = true;
    try {
      let token = manualToken;
      if (!token && this.recaptchaConfigured) {
        token = await this.recaptcha.execute('register');
      }
      
      const res = await firstValueFrom(
        this.usersApi.register({
          name: v.name,
          lastname: v.lastname,
          email: v.email,
          password: v.password,
          confirmPassword: v.confirmPassword,
          recaptchaToken: token || '',
        }),
      );
      this.notify.success(res.message ?? 'Registro exitoso');
    } catch {
      /* interceptor / error */
    } finally {
      this.submitting = false;
    }
  }
}
