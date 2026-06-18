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
  selector: 'app-complete-profile',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './complete-profile.component.html',
  styleUrl: './complete-profile.component.scss',
})
export class CompleteProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly securityApi = inject(SecurityApiService);
  private readonly notify = inject(NotificationService);
  private readonly auth = inject(AuthService);

  userId = '';

  readonly form = this.fb.nonNullable.group({
    address: ['', [Validators.required, Validators.minLength(5)]],
    phone: ['', [Validators.required, Validators.minLength(7)]],
  });

  busy = false;

  ngOnInit(): void {
    this.userId = this.route.snapshot.queryParamMap.get('userId') ?? '';
    if (!this.userId) {
      this.notify.error('Falta userId en la URL (?userId=...)');
    }
  }

  async submit(): Promise<void> {
    if (!this.userId) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy = true;
    try {
      const v = this.form.getRawValue();
      const res = await firstValueFrom(
        this.securityApi.completeProfile({ userId: this.userId, address: v.address, phone: v.phone }),
      );
      if (res.token) {
        this.auth.setToken(res.token);
      }
      this.notify.success(res.message ?? 'Perfil completado');
      void this.router.navigate([res.token ? '/dashboard' : '/login']);
    } catch {
      /* global */
    } finally {
      this.busy = false;
    }
  }
}
