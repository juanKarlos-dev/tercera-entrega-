import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, NgZone, OnDestroy, OnInit, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { TwoFactorResponse } from '../../../core/models/api.models';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SecurityApiService } from '../../../core/services/security-api.service';
import { environment } from '../../../../environments/environment';

interface Pending2FAState {
  sessionId?: string;
  maskedEmail?: string;
  codeExpiresAtMs?: number;
  attemptsRemaining?: number;
}

@Component({
  selector: 'app-two-factor',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './two-factor.component.html',
  styleUrl: './two-factor.component.scss',
})
export class TwoFactorComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly securityApi = inject(SecurityApiService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);

  sessionId = '';
  maskedEmail = '';

  // Timer Signals
  private codeExpiresAtMs = signal<number | null>(null);
  readonly remainingSeconds = signal<number>(120);
  readonly codeExpired = computed(() => this.remainingSeconds() <= 0);
  readonly attemptsRemaining = signal<number>(3);

  private countdownId: any = null;
  private cleanExit = false;

  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  busy = false;

  readonly remainingTimeStr = computed(() => {
    const total = this.remainingSeconds();
    if (total <= 0) return '00:00';
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  });

  ngOnInit(): void {
    let st = history.state as Pending2FAState | undefined;
    if (!st?.sessionId) {
      try {
        const raw = sessionStorage.getItem('pending2fa');
        if (raw) st = JSON.parse(raw) as Pending2FAState;
      } catch { /* ignore */ }
    }
    
    const sid = st?.sessionId;
    if (!sid) {
      this.notify.info('Inicia sesión de nuevo para recibir un código 2FA.');
      void this.router.navigate(['/login']);
      return;
    }

    this.sessionId = sid;
    this.maskedEmail = st?.maskedEmail ?? '';
    this.attemptsRemaining.set(st?.attemptsRemaining ?? 3);
    
    // Set expiration
    if (st?.codeExpiresAtMs) {
      this.codeExpiresAtMs.set(st.codeExpiresAtMs);
    } else {
      // Default 2 minutes (120s) if not provided
      this.codeExpiresAtMs.set(Date.now() + 120 * 1000);
      this.persistPending2fa();
    }

    this.startCountdown();
  }

  ngOnDestroy(): void {
    this.stopCountdown();
    if (!this.cleanExit && this.sessionId) {
      try {
        const url = `${environment.apiUrl}/security/2fa/cancel`;
        const blob = new Blob([JSON.stringify({ sessionId: this.sessionId })], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      } catch { /* ignore */ }
    }
    sessionStorage.removeItem('pending2fa');
  }

  private persistPending2fa(): void {
    if (!this.sessionId) return;
    sessionStorage.setItem('pending2fa', JSON.stringify({
      sessionId: this.sessionId,
      maskedEmail: this.maskedEmail,
      codeExpiresAtMs: this.codeExpiresAtMs(),
      attemptsRemaining: this.attemptsRemaining(),
    }));
  }

  private startCountdown(): void {
    this.stopCountdown();
    this.ngZone.run(() => this.updateTick());
    this.ngZone.runOutsideAngular(() => {
      this.countdownId = setInterval(() => {
        this.ngZone.run(() => this.updateTick());
      }, 1000);
    });
  }

  private stopCountdown(): void {
    if (this.countdownId) {
      clearInterval(this.countdownId);
      this.countdownId = null;
    }
  }

  private updateTick(): void {
    const expiresAt = this.codeExpiresAtMs();
    if (!expiresAt) {
      this.remainingSeconds.set(0);
      return;
    }

    const diff = Math.ceil((expiresAt - Date.now()) / 1000);
    if (diff <= 0) {
      this.remainingSeconds.set(0);
      this.stopCountdown();
      return;
    }
    this.remainingSeconds.set(diff);
  }

  onPaste(ev: ClipboardEvent): void {
    ev.preventDefault();
    const data = ev.clipboardData?.getData('text') || '';
    const digits = data.replace(/\D/g, '').slice(0, 6);
    
    if (digits.length > 0) {
      this.form.controls.code.setValue(digits);
      const inputs = document.querySelectorAll('.code-input') as NodeListOf<HTMLInputElement>;
      digits.split('').forEach((char, i) => {
        if (inputs[i]) inputs[i].value = char;
      });
      
      if (digits.length === 6) {
        void this.verify();
      } else {
        inputs[digits.length]?.focus();
      }
    }
  }

  onInputDigit(ev: Event, idx: number): void {
    const el = ev.target as HTMLInputElement;
    let val = el.value.replace(/\D/g, '');
    if (val.length > 0) {
      val = val[val.length - 1];
      el.value = val;
      this.updateCodeFromInputs();
      if (idx < 5) {
        const next = document.querySelector(`input[data-index="${idx + 1}"]`) as HTMLInputElement;
        next?.focus();
      }
    } else {
      el.value = '';
      this.updateCodeFromInputs();
    }
  }

  onKeyDownDigit(ev: KeyboardEvent, idx: number): void {
    if (ev.key === 'Backspace') {
      const el = ev.target as HTMLInputElement;
      if (!el.value && idx > 0) {
        const prev = document.querySelector(`input[data-index="${idx - 1}"]`) as HTMLInputElement;
        prev?.focus();
      } else {
        el.value = '';
        this.updateCodeFromInputs();
      }
    }
  }

  private updateCodeFromInputs(): void {
    const inputs = document.querySelectorAll('.code-input') as NodeListOf<HTMLInputElement>;
    let code = '';
    inputs.forEach(i => code += i.value);
    this.form.controls.code.setValue(code);
  }

  async verify(): Promise<void> {
    if (this.codeExpired()) {
      this.notify.error('El código expiró. Solicita uno nuevo.');
      return;
    }
    if (!this.sessionId || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy = true;
    try {
      const res = await firstValueFrom(
        this.securityApi.verify2FA({ sessionId: this.sessionId, code: this.form.controls.code.value }),
      );
      if (res.authenticated && res.token) {
        this.cleanExit = true;
        this.stopCountdown();
        sessionStorage.removeItem('pending2fa');
        this.auth.setToken(res.token);
        this.notify.success(res.message ?? 'Verificación correcta');
        this.auth.navigateAfterLogin();
        return;
      }
      if (res.sessionInvalidated) {
        this.cleanExit = true;
        this.stopCountdown();
        sessionStorage.removeItem('pending2fa');
        this.notify.error(res.message ?? 'Sesión inválida');
        void this.router.navigate(['/login']);
        return;
      }
      if (res.attemptsRemaining !== undefined) {
        this.attemptsRemaining.set(res.attemptsRemaining);
        this.persistPending2fa();
      }
      if (res.message) this.notify.error(res.message);
    } catch (e: unknown) {
      const res = this.parseTwoFactorError(e);
      if (res?.attemptsRemaining !== undefined) {
        this.attemptsRemaining.set(res.attemptsRemaining);
        this.persistPending2fa();
      }
      if (res?.sessionInvalidated) {
        this.cleanExit = true;
        this.stopCountdown();
        sessionStorage.removeItem('pending2fa');
        this.notify.error(res.message ?? 'Sesión inválida');
        void this.router.navigate(['/login']);
        return;
      }
      if (res?.message) this.notify.error(res.message);
    } finally {
      this.busy = false;
    }
  }

  private parseTwoFactorError(e: unknown): TwoFactorResponse | null {
    if (e instanceof HttpErrorResponse && e.error && typeof e.error === 'object') {
      return e.error as TwoFactorResponse;
    }
    return null;
  }

  async resend(): Promise<void> {
    if (!this.sessionId) return;
    this.busy = true;
    try {
      const res = await firstValueFrom(this.securityApi.resend2FA({ sessionId: this.sessionId }));
      if (res.resent) {
        let expiresAtMs: number;
        if (res.expiresAt) {
          const p = Date.parse(res.expiresAt);
          expiresAtMs = !Number.isNaN(p) ? p : Date.now() + (res.expiresInSeconds ?? 120) * 1000;
        } else {
          expiresAtMs = Date.now() + (res.expiresInSeconds ?? 120) * 1000;
        }
        this.codeExpiresAtMs.set(expiresAtMs);
        this.attemptsRemaining.set(res.attemptsRemaining ?? 3);
        this.form.controls.code.setValue('');
        // Clear inputs
        const inputs = document.querySelectorAll('.code-input') as NodeListOf<HTMLInputElement>;
        inputs.forEach(i => i.value = '');
        
        this.persistPending2fa();
        this.startCountdown();
        this.notify.success(res.message ?? 'Código reenviado correctamente');
      } else if (res.sessionInvalidated) {
        this.cleanExit = true;
        this.stopCountdown();
        sessionStorage.removeItem('pending2fa');
        this.notify.error(res.message ?? 'Sesión expirada');
        void this.router.navigate(['/login']);
      } else {
        this.notify.info(res.message ?? 'No se pudo reenviar');
      }
    } catch (e: unknown) {
      const res = this.parseTwoFactorError(e);
      if (res?.sessionInvalidated) {
        this.cleanExit = true;
        this.stopCountdown();
        sessionStorage.removeItem('pending2fa');
        this.notify.error(res.message ?? 'Sesión expirada');
        void this.router.navigate(['/login']);
      } else if (res?.message) {
        this.notify.error(res.message);
      } else {
        this.notify.error('No se pudo reenviar el código');
      }
    } finally {
      this.busy = false;
    }
  }

  async cancel(): Promise<void> {
    if (!this.sessionId) return;
    this.busy = true;
    try {
      await firstValueFrom(this.securityApi.cancel2FA({ sessionId: this.sessionId }));
      this.cleanExit = true;
      this.stopCountdown();
      sessionStorage.removeItem('pending2fa');
      this.notify.info('Verificación cancelada');
      void this.router.navigate(['/login']);
    } catch {
      this.cleanExit = true;
      this.stopCountdown();
      sessionStorage.removeItem('pending2fa');
      void this.router.navigate(['/login']);
    } finally {
      this.busy = false;
    }
  }
}
