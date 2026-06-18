import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { SecurityApiService } from '../../../core/services/security-api.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly securityApi = inject(SecurityApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);

  token = this.route.snapshot.queryParamMap.get('token') ?? '';

  readonly form = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [ResetPasswordComponent.match] },
  );

  submitting = false;

  private static match(control: AbstractControl): ValidationErrors | null {
    const a = control.get('newPassword')?.value;
    const b = control.get('confirmPassword')?.value;
    return a && b && a !== b ? { mismatch: true } : null;
  }

  async submit(): Promise<void> {
    if (!this.token) {
      this.notify.error('Falta el token en la URL (?token=...)');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    try {
      const v = this.form.getRawValue();
      const res = await firstValueFrom(
        this.securityApi.resetPassword({
          token: this.token,
          newPassword: v.newPassword,
          confirmPassword: v.confirmPassword,
        }),
      );
      this.notify.success(res.message ?? 'Contraseña actualizada');
      void this.router.navigate(['/login']);
    } catch {
      /* global */
    } finally {
      this.submitting = false;
    }
  }
}
