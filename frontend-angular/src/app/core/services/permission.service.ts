import { Injectable, inject, signal, computed } from '@angular/core';
import { UserRoleApiService } from './user-role-api.service';
import { firstValueFrom } from 'rxjs';
import { EffectivePermissionResponse } from '../models/api.models';

const PERMS_CACHE_KEY = 'ms_security_effective_perms_v1';

interface PermissionsCacheEntry {
  userId: string;
  permissions: EffectivePermissionResponse[];
  cachedAt?: number;
}

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly userRoleApi = inject(UserRoleApiService);

  private readonly permissions = signal<EffectivePermissionResponse[]>([]);
  private readonly loaded = signal(false);

  /** True tras el primer intento de hidratación (red incluida). El menú no debe ocultarse antes. */
  private readonly hydrated = signal(false);

  /** Promesa de la hidratación en curso (para guards tras F5). */
  private inflightHydration: Promise<void> | null = null;

  private cacheTimestamp = 0;
  private static readonly CACHE_TTL_MS = 60_000;

  /** List of all effective permissions (method:url) */
  readonly effectiveList = computed(() => 
    this.permissions().map(p => `${p.method?.toUpperCase()}:${p.url}`)
  );

  readonly isHydrated = this.hydrated.asReadonly();

  /**
   * Espera a que termine la hidratación actual (o resuelve si no hay proceso).
   * Los guards usan esto antes de comprobar permisos.
   */
  async waitForHydration(): Promise<void> {
    await (this.inflightHydration ?? Promise.resolve());
  }

  loadPermissions(userId: string): Promise<void> {
    if (!userId) {
      this.clear();
      return Promise.resolve();
    }

    const run = this.executeLoad(userId);
    this.inflightHydration = run;
    return run;
  }

  private async executeLoad(userId: string): Promise<void> {
    const cacheHit = this.restoreFromStorage(userId);
    if (cacheHit) {
      // Caché válido en esta sesión — no repetir llamada de red hasta el próximo login.
      this.hydrated.set(true);
      return;
    }

    try {
      const perms = await firstValueFrom(this.userRoleApi.effectivePermissions(userId));
      const list = Array.isArray(perms) ? perms : [];
      this.permissions.set(list);
      this.loaded.set(list.length > 0);
      this.persistStorage(userId, list);
    } catch {
      const fallback = this.permissions();
      this.loaded.set(fallback.length > 0);
    } finally {
      this.hydrated.set(true);
    }
  }

  private restoreFromStorage(userId: string): boolean {
    try {
      const raw = localStorage.getItem(PERMS_CACHE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as PermissionsCacheEntry;
      if (parsed?.userId !== userId || !Array.isArray(parsed.permissions)) return false;
      this.permissions.set(parsed.permissions);
      this.loaded.set(parsed.permissions.length > 0);
      this.cacheTimestamp = parsed.cachedAt ?? Date.now();
      return true;
    } catch {
      return false;
    }
  }

  private persistStorage(userId: string, list: EffectivePermissionResponse[]): void {
    try {
      this.cacheTimestamp = Date.now();
      const entry: PermissionsCacheEntry = { userId, permissions: list, cachedAt: this.cacheTimestamp };
      localStorage.setItem(PERMS_CACHE_KEY, JSON.stringify(entry));
    } catch {
      /* ignore */
    }
  }

  /**
   * Si el caché tiene más de 60 s, descarta y recarga desde la red.
   * Llamado por canActivateModule antes de verificar permisos.
   */
  async revalidateIfStale(userId: string | undefined): Promise<void> {
    if (!userId) return;
    const age = Date.now() - this.cacheTimestamp;
    if (age < PermissionService.CACHE_TTL_MS) return;
    try {
      localStorage.removeItem(PERMS_CACHE_KEY);
    } catch { /* ignore */ }
    this.cacheTimestamp = 0;
    await this.loadPermissions(userId);
  }

  hasPermission(method: string, url: string): boolean {
    const m = method.toUpperCase();
    const wanted = url.replace(/\*/g, '?').trim();
    return this.permissions().some((p) => {
      if ((p.method || '').toUpperCase() !== m) return false;
      return this.samePermissionUrl(wanted, (p.url || '').replace(/\*/g, '?').trim());
    });
  }

  /** Coincide plantillas tipo `/api/users/?` (wildcard `?` = un segmento) o rutas concretas */
  private samePermissionUrl(a: string, b: string): boolean {
    if (!a || !b) return a === b;
    if (a === b) return true;
    const aTpl = this.isUrlTemplate(a);
    const bTpl = this.isUrlTemplate(b);
    if (aTpl && !bTpl) return this.templateToRegex(a).test(b);
    if (!aTpl && bTpl) return this.templateToRegex(b).test(a);
    return false;
  }

  private isUrlTemplate(path: string): boolean {
    return path.split('/').some((seg) => seg === '?');
  }

  private templateToRegex(template: string): RegExp {
    const parts = template.split('/');
    const body = parts
      .map((seg) => {
        if (seg === '?') return '[^/]+';
        return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    return new RegExp(`^${body}$`);
  }

  hasModuleAccess(model: string): boolean {
    return this.permissions().some(p => p.model === model);
  }

  /**
   * Verifica si el usuario tiene permiso para llamar a un endpoint concreto.
   * Usar antes de cualquier llamada HTTP secundaria en los componentes.
   * urlPattern acepta segmentos {id} igual que los permisos almacenados.
   * Ejemplo: canCall('GET', '/api/role-permission/role/{id}')
   */
  canCall(method: string, urlPattern: string): boolean {
    return this.hasPermission(method, urlPattern);
  }

  /**
   * Verifica permiso acumulativo por módulo + acción de negocio.
   * action soporta: view|create|edit|delete|assign|manage|all.
   */
  hasPermissionForModelAction(model: string, action: string): boolean {
    const methods = this.methodsForAction(action);
    if (methods.length === 0) return false;
    const wanted = this.normalizeModel(model);
    if (!wanted) return false;

    return this.permissions().some((p) => {
      const pm = this.normalizeModel(p.model);
      if (!pm || pm !== wanted) return false;
      const method = (p.method || '').toUpperCase();
      return methods.includes(method);
    });
  }

  private methodsForAction(action: string): string[] {
    const a = (action || '').trim().toLowerCase();
    if (!a) return [];
    if (a === 'view' || a === 'read') return ['GET'];
    if (a === 'create') return ['POST'];
    if (a === 'edit' || a === 'update') return ['PUT', 'PATCH'];
    if (a === 'delete' || a === 'remove') return ['DELETE'];
    if (a === 'assign') return ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (a === 'manage' || a === 'all') return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    return [];
  }

  private normalizeModel(model: string | null | undefined): string {
    const value = (model || '').trim();
    if (!value) return '';
    return value.toLowerCase().replace(/[\s_-]+/g, '');
  }

  clear(): void {
    this.permissions.set([]);
    this.loaded.set(false);
    this.hydrated.set(false);
    this.inflightHydration = null;
    this.cacheTimestamp = 0;
    try {
      localStorage.removeItem(PERMS_CACHE_KEY);
    } catch {
      /* ignore */
    }
  }
}
