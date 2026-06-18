import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from '../services/permission.service';
import { AuthService } from '../services/auth.service';

/**
 * Comprueba si el usuario es Administrador Sistema.
 * Usa comparación case-insensitive porque:
 *   - roleDisplayNames() puede venir de la API ("Administrador Sistema") o del JWT ("Administrador Sistema")
 *   - roles() (claim JWT) trae el nombre exacto de MongoDB: "Administrador Sistema" (con espacio, no guion bajo)
 * JWT emitido por JwtService.java: claim "roles" = ["Administrador Sistema", ...] — nunca "ADMINISTRADOR_SISTEMA".
 */
function isAdminSistema(auth: AuthService): boolean {
  const isAdmin = (r: string) => r.trim().toLowerCase() === 'administrador sistema';
  return auth.roleDisplayNames().some(isAdmin) || auth.roles().some(isAdmin);
}

/**
 * Comprueba effective-permissions si ya están en memoria; mientras cargan en
 * background (primer login, sin caché localStorage), deja pasar la ruta.
 * El backend valida cada llamada HTTP de forma independiente.
 *
 * Antes usaba `await perm.waitForHydration()` que bloqueaba TODA la navegación
 * durante los ~27 s que tardaba el endpoint — ahora es completamente síncrono.
 */
export function canActivateModule(models: string[]): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const perm = inject(PermissionService);
    const router = inject(Router);
    // Administrador Sistema tiene acceso irrestricto: salta toda verificación de permisos.
    if (isAdminSistema(auth)) return true;
    // Revalida el caché si tiene más de 60 s para reflejar cambios de permisos recientes.
    await perm.revalidateIfStale(auth.payload()?.id);
    // Permisos aún no cargados → dejar pasar; se verificarán en la próxima navegación.
    if (!perm.isHydrated()) return true;
    if (models.some((m) => perm.hasModuleAccess(m))) return true;
    // Lista vacía = endpoint denegado (403) por falta de permiso UserRole; el backend valida.
    if (perm.effectiveList().length === 0) return true;
    return router.createUrlTree(['/forbidden']);
  };
}

/**
 * Usa los claims del JWT (disponibles inmediatamente tras login) para comprobar
 * el rol. roleDisplayNames() tiene fallback al claim JWT, así que no necesita esperar
 * la hidratación de effective-permissions.
 */
export function canActivateRole(allowedRoles: string[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    // Administrador Sistema tiene acceso irrestricto a todas las rutas.
    if (isAdminSistema(auth)) return true;
    const userRoles = auth.roleDisplayNames().map((r) => r.trim().toLowerCase());
    const allowed = allowedRoles.map((r) => r.toLowerCase());
    if (allowed.some((r) => userRoles.includes(r))) return true;
    // Sin roles en JWT todavía (JWT acabado de emitir) → dejar pasar mientras cargan.
    const perm = inject(PermissionService);
    if (!perm.isHydrated()) return true;
    return router.createUrlTree(['/forbidden']);
  };
}
