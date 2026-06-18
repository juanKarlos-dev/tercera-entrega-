import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { firstValueFrom } from 'rxjs';
import { PermissionService } from './permission.service';
import { UserRoleApiService } from './user-role-api.service';
import { JwtPayload } from '../models/jwt-payload.model';
import { User } from '../models/api.models';
import { environment } from '../../../environments/environment';

const TOKEN_KEY = 'ms_security_jwt';
const ROLE_NAMES_CACHE_KEY = 'ms_security_role_names_v1';

interface RoleNamesCacheEntry {
  userId: string;
  names: string[];
}

/** Claves adicionales de sesión en localStorage (extensible sin romper el flujo actual). */
const EXTRA_AUTH_STORAGE_KEYS: readonly string[] = [];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly permissionService = inject(PermissionService);
  private readonly userRoleApi = inject(UserRoleApiService);

  private readonly tokenSignal = signal<string | null>(this.readStoredToken());

  /** Nombres de rol desde backend (acumulativos); vacío hasta hidratar. */
  private readonly assignedRolesFromApi = signal<string[]>([]);

  readonly token = this.tokenSignal.asReadonly();

  constructor() {
    const t = this.tokenSignal();
    if (t) {
      const payload = this.decodePayload(t);
      if (payload?.id) {
        this.restoreRoleNamesFromStorage(payload.id);
        void this.bootstrapSession(payload.id);
      }
    }
  }

  readonly isAuthenticated = computed(() => this.isTokenValid(this.tokenSignal()));

  readonly payload = computed(() => {
    const t = this.tokenSignal();
    return t ? this.decodePayload(t) : null;
  });

  readonly roles = computed(() => {
    const payload = this.payload();
    if (!payload) return [] as string[];

    const fromArray = Array.isArray(payload.roles)
      ? payload.roles.map((x) => String(x).trim()).filter(Boolean)
      : [];

    const fromLegacy = (payload.role || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

    return [...new Set([...fromArray, ...fromLegacy])];
  });

  /** Preferir roles reales por API; fallback al claim JWT (`role`). */
  readonly roleDisplayNames = computed(() => {
    const fromApi = this.assignedRolesFromApi();
    if (fromApi.length > 0) return fromApi;
    return this.roles();
  });

  /**
   * Regla centralizada para UI/guards de acciones por módulo.
   * Un permiso válido en cualquier rol => true.
   */
  hasPermission(model: string, action: string): boolean {
    const roles = this.roleDisplayNames().map((r) => r.trim().toLowerCase());
    if (roles.includes('administrador sistema')) {
      return true;
    }
    return this.permissionService.hasPermissionForModelAction(model, action);
  }

  /** Refresca nombres de rol (p. ej. tras asignar roles en administración). */
  async refreshRoleAssignments(): Promise<void> {
    const id = this.payload()?.id;
    if (!id) {
      this.assignedRolesFromApi.set([]);
      return;
    }
    await this.loadAssignedRoleNames(id);
  }

  private async bootstrapSession(userId: string): Promise<void> {
    await Promise.all([this.permissionService.loadPermissions(userId), this.loadAssignedRoleNames(userId)]);
  }

  private restoreRoleNamesFromStorage(userId: string): void {
    try {
      const raw = localStorage.getItem(ROLE_NAMES_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as RoleNamesCacheEntry;
      if (parsed?.userId !== userId || !Array.isArray(parsed.names)) return;
      this.assignedRolesFromApi.set(parsed.names.filter((n) => typeof n === 'string' && n.trim()));
    } catch {
      /* ignore */
    }
  }

  private persistRoleNames(userId: string, names: string[]): void {
    try {
      const entry: RoleNamesCacheEntry = { userId, names };
      localStorage.setItem(ROLE_NAMES_CACHE_KEY, JSON.stringify(entry));
    } catch {
      /* ignore */
    }
  }

  private async loadAssignedRoleNames(userId: string): Promise<void> {
    // restoreRoleNamesFromStorage ya pobló el signal desde localStorage: no repetir la llamada.
    if (this.assignedRolesFromApi().length > 0) {
      return;
    }
    try {
      const rows = await firstValueFrom(this.userRoleApi.userRoles(userId));
      const names = [
        ...new Map(
          rows
            .filter((r) => r.roleName?.trim())
            .map((r) => [(r.roleId || r.roleName)!.trim(), r.roleName!.trim()]),
        ).values(),
      ];
      this.assignedRolesFromApi.set(names);
      this.persistRoleNames(userId, names);
    } catch {
      if (this.assignedRolesFromApi().length === 0) {
        this.assignedRolesFromApi.set([]);
      }
    }
  }

  setToken(token: string | null): void {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      this.tokenSignal.set(token);
      const payload = this.decodePayload(token);
      if (payload?.id) {
        // Limpiar caché para que el bootstrap post-login siempre traiga datos frescos.
        this.permissionService.clear();
        this.assignedRolesFromApi.set([]);
        void this.bootstrapSession(payload.id);
      }
    } else {
      this.permissionService.clear();
      this.assignedRolesFromApi.set([]);
      this.clearStoredCredentials();
    }
  }

  /**
   * Elimina JWT y cualquier dato de sesión persistido en el cliente (usuario derivaba del token).
   */
  private clearStoredCredentials(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_NAMES_CACHE_KEY);
    for (const key of EXTRA_AUTH_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
    this.tokenSignal.set(null);
  }

  /**
   * Redirige según el rol tras login exitoso.
   * CONDUCTOR y ADMIN_EMPRESA van a la app de operaciones en puerto 4201.
   * El resto (incluido Administrador Sistema) accede al dashboard del módulo de seguridad.
   */
  navigateAfterLogin(): void {
    // Combina claims JWT (disponibles inmediatamente) con nombres de API (si ya cargaron).
    const allUpper = [
      ...this.roles().map((r) => r.trim().toUpperCase()),
      ...this.roleDisplayNames().map((r) => r.trim().toUpperCase()),
    ];
    if (allUpper.includes('CONDUCTOR') || allUpper.includes('ADMIN_EMPRESA')) {
      window.location.href = environment.operationsAppUrl;
    } else {
      void this.router.navigate(['/dashboard']);
    }
  }

  logout(redirect = true): void {
    this.clearStoredCredentials();
    if (redirect) {
      void this.router.navigate(['/login']);
    }
  }

  /**
   * JWT con tres segmentos, payload decodificable, claim exp presente y no vencido.
   * Token corrupto, mal formado, sin exp o expirado → false.
   */
  isTokenValid(token: string | null | undefined): boolean {
    const t = token?.trim();
    if (!t) return false;
    const parts = t.split('.');
    if (parts.length !== 3) return false;
    const payload = this.decodePayload(t);
    if (!payload?.exp) return false;
    return payload.exp * 1000 > Date.now();
  }

  decodePayload(token: string): JwtPayload | null {
    try {
      return jwtDecode<JwtPayload>(token);
    } catch {
      return null;
    }
  }

  currentUserSnapshot(): User | null {
    const p = this.payload();
    if (!p?.id) return null;
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      username: p.username,
    };
  }

  private readStoredToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }
}
