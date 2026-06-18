import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { CommonModule } from '@angular/common';
import { debounceTime, distinctUntilChanged, finalize, firstValueFrom } from 'rxjs';
import { Role } from '../../../core/models/role.model';
import { RolesApiService } from '../../../core/services/roles-api.service';
import { UserRoleApiService } from '../../../core/services/user-role-api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { RoleDialogComponent } from '../role-dialog/role-dialog.component';
import { AssignPermissionsDialogComponent } from '../assign-permissions-dialog/assign-permissions-dialog.component';

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatDialogModule,
    MatTooltipModule,
    MatMenuModule,
    MatDividerModule,
  ],
  templateUrl: './role-list.component.html',
  styleUrl: './role-list.component.scss',
})
export class RoleListComponent implements OnInit {
  private readonly rolesApi = inject(RolesApiService);
  private readonly userRoleApi = inject(UserRoleApiService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);
  private readonly permissionService = inject(PermissionService);

  private readonly protectedRoleNames = [
    'Administrador Sistema',
    'Administrador Empresa',
    'Supervisor',
    'Conductor',
    'Ciudadano',
  ] as const;

  readonly searchControl = new FormControl('', { nonNullable: true });

  allRoles = signal<Role[]>([]);
  userCounts = signal<Map<string, number>>(new Map());
  isLoading = signal(false);
  refreshingCounts = signal(false);

  filteredRoles = computed(() => {
    const query = this.searchControl.value.toLowerCase().trim();
    if (!query) return this.allRoles();
    return this.allRoles().filter(
      (r) =>
        (r.name?.toLowerCase().includes(query) ?? false) ||
        (r.description?.toLowerCase().includes(query) ?? false),
    );
  });

  ngOnInit(): void {
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    await this.reloadRolesQuick();
    this.refreshCountsInBackground();
  }

  /** Solo roles: pantalla lista rápida. */
  private async reloadRolesQuick(): Promise<void> {
    this.isLoading.set(true);
    try {
      const roles = await firstValueFrom(this.rolesApi.list());
      this.allRoles.set(roles);
    } catch {
      this.notify.error('Error al cargar los roles');
    } finally {
      this.isLoading.set(false);
    }
  }

  private refreshCountsInBackground(): void {
    if (!this.permissionService.canCall('GET', '/api/user-role/users-with-roles')) {
      return;
    }
    this.refreshingCounts.set(true);
    this.userRoleApi
      .usersWithRoles()
      .pipe(finalize(() => this.refreshingCounts.set(false)))
      .subscribe({
        next: (users) => this.calculateUserCounts(users),
        error: () => {
          /* listado opcional silencioso */
        },
      });
  }

  private calculateUserCounts(users: UserWithRolesResponseLite[]): void {
    const counts = new Map<string, number>();
    users.forEach((u) => {
      u.roles?.forEach((r: { id?: string }) => {
        if (!r?.id) return;
        counts.set(r.id, (counts.get(r.id) || 0) + 1);
      });
    });
    this.userCounts.set(counts);
  }

  getUserCount(roleId?: string): number {
    return roleId ? this.userCounts().get(roleId) || 0 : 0;
  }

  openRoleDialog(role?: Role): void {
    const dialogRef = this.dialog.open(RoleDialogComponent, {
      width: '500px',
      maxWidth: '95vw',
      data: { role, roles: this.allRoles() },
      autoFocus: false,
    });

    dialogRef.afterClosed().subscribe((result: { name: string; description: string } | undefined) => {
      if (!result) return;
      void this.persistRole(role, result);
    });
  }

  private async persistRole(
    existing: Role | undefined,
    result: { name: string; description: string },
  ): Promise<void> {
    const rolePayload: Role = {
      ...(existing ?? {}),
      id: existing?.id,
      name: result.name,
      description: result.description,
    };

    try {
      if (existing?.id) {
        const updated = await firstValueFrom(this.rolesApi.update(existing.id, rolePayload));
        this.allRoles.update((list) => list.map((r) => (r.id === existing.id ? updated : r)));
        this.notify.success('Rol actualizado');
      } else {
        const created = await firstValueFrom(this.rolesApi.create(rolePayload));
        this.allRoles.update((list) =>
          [...list, created].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
        );
        this.notify.success('Rol creado');
      }
      this.userRoleApi.invalidateUsersSnapshot();
    } catch {
      this.notify.error('No se pudo guardar el rol');
    }
  }

  async removeRole(role: Role): Promise<void> {
    if (!role.id || !this.canDelete(role)) return;

    const count = this.getUserCount(role.id);
    if (count > 0) {
      this.notify.warning(`No puedes eliminar este rol porque tiene ${count} usuarios asignados.`);
      return;
    }

    if (!confirm(`¿Eliminar el rol "${role.name}"?`)) return;

    try {
      await firstValueFrom(this.rolesApi.delete(role.id));
      this.allRoles.update((list) => list.filter((r) => r.id !== role.id));
      this.userRoleApi.invalidateUsersSnapshot();
      this.notify.success('Rol eliminado correctamente');
      this.refreshCountsInBackground();
    } catch {
      this.notify.error('Error al eliminar el rol');
    }
  }

  canDelete(role: Role): boolean {
    const n = role.name?.trim() ?? '';
    return !this.protectedRoleNames.some((p) => p === n);
  }

  canCreateRole(): boolean {
    return this.auth.hasPermission('Role', 'create');
  }

  canEditRole(): boolean {
    return this.auth.hasPermission('Role', 'edit');
  }

  canDeleteRole(): boolean {
    return this.auth.hasPermission('Role', 'delete');
  }

  canManageRolePermissions(): boolean {
    return (
      this.auth.hasPermission('RolePermission', 'manage') ||
      (this.permissionService.hasModuleAccess('Role') && this.permissionService.hasModuleAccess('Permission'))
    );
  }

  assignPermissions(role: Role): void {
    const dialogRef = this.dialog.open(AssignPermissionsDialogComponent, {
      width: 'min(920px, calc(100vw - 32px))',
      maxWidth: '920px',
      maxHeight: 'calc(100vh - 32px)',
      data: { role },
      autoFocus: false,
    });

    dialogRef.afterClosed().subscribe(() => void 0);
  }

  isProtected(role: Role): boolean {
    return !this.canDelete(role);
  }
}

interface UserWithRolesResponseLite {
  roles?: Array<{ id?: string }>;
}
