import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import { Permission, RolePermissionResponse } from '../../core/models/api.models';
import { Role } from '../../core/models/role.model';
import { PermissionsApiService } from '../../core/services/permissions-api.service';
import { RolePermissionApiService } from '../../core/services/role-permission-api.service';
import { RolesApiService } from '../../core/services/roles-api.service';
import { NotificationService } from '../../core/services/notification.service';
import { PermissionService } from '../../core/services/permission.service';
import {
  MATRIX_MODULES_ORDER,
  TECHNICAL_MODELS,
  friendlyPermissionLabel,
  normalizeModuleKey,
} from '../../core/utils/permission-presenter';

interface PermissionGroup {
  module: string;
  permissions: Permission[];
}

@Component({
  selector: 'app-role-permissions',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatCheckboxModule,
    MatProgressBarModule,
    MatDividerModule,
    MatTooltipModule,
    MatTabsModule,
    MatSlideToggleModule,
  ],
  templateUrl: './role-permissions.component.html',
  styleUrl: './role-permissions.component.scss',
})
export class RolePermissionsComponent implements OnInit {
  private readonly rolesApi = inject(RolesApiService);
  private readonly permissionsApi = inject(PermissionsApiService);
  private readonly rpApi = inject(RolePermissionApiService);
  private readonly notify = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);

  roles = signal<Role[]>([]);
  allPermissions = signal<Permission[]>([]);
  groups = signal<PermissionGroup[]>([]);

  isLoading = signal(false);
  showTechnical = signal(false);

  readonly canManageRolePermissions = computed(() => {
    if (!this.permissionService.isHydrated()) return true;
    return (
      this.permissionService.canCall('POST', '/api/role-permission/role/{id}/permission/{id}') ||
      (this.permissionService.hasModuleAccess('Role') && this.permissionService.hasModuleAccess('Permission'))
    );
  });

  matrixMarks = signal<Set<string>>(new Set());

  matrixRoles = computed(() => this.roles().slice(0, 8));
  matrixModules = computed(() =>
    (MATRIX_MODULES_ORDER as readonly string[]).filter((m) => this.groups().some((g) => g.module === m)),
  );

  ngOnInit(): void {
    void this.loadData();
  }

  async loadData(): Promise<void> {
    this.isLoading.set(true);
    try {
      const [rolesList, perms] = await firstValueFrom(forkJoin([this.rolesApi.list(), this.permissionsApi.list()]));
      this.roles.set(rolesList);
      this.allPermissions.set(perms);
      this.groupPermissions(perms);
      if (this.permissionService.canCall('GET', '/api/role-permission/role/{id}')) {
        await this.loadMatrixMarks();
      }
    } catch {
      this.notify.error('Error al cargar catálogo de permisos');
    } finally {
      this.isLoading.set(false);
    }
  }

  private groupPermissions(perms: Permission[]): void {
    const grouped = new Map<string, Permission[]>();

    perms.forEach((p) => {
      const raw = (p.model || 'General').trim();
      if (TECHNICAL_MODELS.has(raw)) return;
      const mod = normalizeModuleKey(raw);
      if (!grouped.has(mod)) grouped.set(mod, []);
      const list = grouped.get(mod)!;
      if (p.id && list.some((x) => x.id === p.id)) return;
      list.push(p);
    });

    const groupArray = [...grouped.entries()]
      .map(([module, permissions]) => ({
        module,
        permissions: [...permissions].sort((a, b) =>
          friendlyPermissionLabel(a, module).localeCompare(friendlyPermissionLabel(b, module)),
        ),
      }))
      .sort((a, b) => a.module.localeCompare(b.module));

    this.groups.set(groupArray);
  }

  private async loadMatrixMarks(): Promise<void> {
    const slice = this.roles().slice(0, 8);
    if (!slice.length) {
      this.matrixMarks.set(new Set());
      return;
    }

    const modulesInPlay = new Set(
      (MATRIX_MODULES_ORDER as readonly string[]).filter((m) => this.groups().some((g) => g.module === m)),
    );
    if (!modulesInPlay.size) {
      this.matrixMarks.set(new Set());
      return;
    }

    const permsById = new Map(this.allPermissions().filter((p) => p.id).map((p) => [p.id!, p]));

    try {
      const blocks: RolePermissionResponse[][] = await firstValueFrom(
        forkJoin(slice.map((r) => this.rpApi.byRole(r.id!))),
      );

      const marks = new Set<string>();
      blocks.forEach((assignments, idx) => {
        const roleId = slice[idx].id!;
        assignments.forEach((a) => {
          const p = a.permissionId ? permsById.get(a.permissionId) : undefined;
          const mod =
            (p ? normalizeModuleKey(p.model) : undefined) ?? normalizeModuleKey(a.permissionModel);
          if (!mod || !modulesInPlay.has(mod)) return;
          marks.add(`${roleId}|${mod}`);
        });
      });
      this.matrixMarks.set(marks);
    } catch {
      this.matrixMarks.set(new Set());
    }
  }

  matrixHit(module: string, roleId?: string): boolean {
    if (!roleId) return false;
    return this.matrixMarks().has(`${roleId}|${module}`);
  }

  catalogLabel(perm: Permission, module: string): string {
    return friendlyPermissionLabel(perm, module);
  }

  getIcon(mod: string): string {
    const icons: Record<string, string> = {
      Usuarios: 'person',
      Roles: 'shield',
      Permisos: 'key',
      Buses: 'directions_bus',
      Rutas: 'map',
      Programaciones: 'schedule',
      Reportes: 'assessment',
      Incidentes: 'report_problem',
      'Mensajes masivos': 'email',
      'Mensajería Masiva': 'email',
      General: 'folder',
    };
    return icons[mod] || 'folder';
  }

  getLabel(mod: string): string {
    const labels: Record<string, string> = {
      Usuarios: 'Usuarios',
      Roles: 'Roles',
      Permisos: 'Permisos',
      Buses: 'Buses',
      Rutas: 'Rutas',
      Programaciones: 'Programaciones',
      Reportes: 'Reportes',
      Incidentes: 'Incidentes',
      'Mensajes masivos': 'Mensajes masivos',
      General: 'Otros',
    };
    return labels[mod] || mod;
  }
}
