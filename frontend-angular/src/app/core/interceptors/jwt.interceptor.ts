import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

const EMPRESA_KEY   = 'negocio_empresa_activa';
const CONDUCTOR_KEY = 'negocio_conductor_activo';

/** Extrae el origen (protocolo + host) de la URL del backend de lógica de negocio. */
function logicaOrigin(): string {
  try {
    return new URL(environment.apiUrlLogica).origin;
  } catch {
    return environment.apiUrlLogica;
  }
}

function shouldAttachAuth(url: string): boolean {
  const u = url.toLowerCase();

  // Rutas públicas que no deben llevar token (basado en SecurityConfig.java del backend)
  const publicEndpoints = [
    '/api/security/login',
    '/api/security/2fa/verify',
    '/api/security/2fa/resend',
    '/api/security/2fa/cancel',
    '/api/security/forgot-password',
    '/api/security/reset-password',
    '/api/security/oauth2/',
    '/api/users/register',
    '/api/users/password-strength',
    '/oauth2/',
    '/login/oauth2/',
  ];

  if (publicEndpoints.some((endpoint) => u.includes(endpoint))) {
    return false;
  }

  return true;
}

function readId(storageKey: string): string | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const obj = JSON.parse(raw) as { id?: unknown };
    return obj?.id != null ? String(obj.id) : null;
  } catch {
    return null;
  }
}

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();

  if (!token || !auth.isTokenValid(token) || !shouldAttachAuth(req.url)) {
    return next(req);
  }

  let headers = req.headers.set('Authorization', `Bearer ${token}`);

  // Para peticiones al backend de lógica de negocio, agrega los headers de contexto
  if (req.url.startsWith(logicaOrigin())) {
    const esCiudadano = auth.roleDisplayNames().some(r => r.toLowerCase().includes('ciudadano'));
    const conductorId = readId(CONDUCTOR_KEY);
    if (!esCiudadano) {
      const empresaId = readId(EMPRESA_KEY);
      if (empresaId != null) headers = headers.set('x-empresa-id', empresaId);
    }
    if (conductorId != null) headers = headers.set('x-conductor-id', conductorId);
  }

  return next(req.clone({ headers }));
};
