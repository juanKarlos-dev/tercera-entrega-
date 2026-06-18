import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

function extractMessage(err: HttpErrorResponse): string {
  const body = err.error;
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as { message?: string };
      if (parsed?.message) return parsed.message;
    } catch {
      return body || err.message;
    }
    return body || err.message;
  }
  if (body && typeof body === 'object' && 'message' in body) {
    return String((body as { message: unknown }).message);
  }
  return err.message || 'Error de red';
}

export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const notify = inject(NotificationService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        const url = req.url.toLowerCase();
        const silent =
          url.includes('/security/login') ||
          url.includes('/security/2fa/') ||
          url.includes('/users/register') ||
          url.includes('/security/forgot-password') ||
          url.includes('/security/reset-password');
        if (!silent) {
          notify.error('Sesión expirada o inválida.');
          auth.logout(true);
        }
        return throwError(() => err);
      }

      if (err.status === 403) {
        notify.error('Acceso denegado. No tienes permisos para realizar esta acción.');
        if (!router.url.includes('/forbidden')) {
          void router.navigate(['/forbidden']);
        }
        return throwError(() => err);
      }

      if (err.status === 0) {
        notify.error('No hay conexión con el servidor. Verifica que el backend esté en ejecución.');
        return throwError(() => err);
      }

      // Errores de login: el mensaje lo muestra LoginComponent leyendo el cuerpo (401, 502, 400 captcha, etc.)
      if (req.url.toLowerCase().includes('/security/login')) {
        return throwError(() => err);
      }

      if (!req.headers.get('X-Silent-Error')) {
        notify.error(extractMessage(err));
      }

      return throwError(() => err);
    }),
  );
};
