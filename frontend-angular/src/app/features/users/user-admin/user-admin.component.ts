import { Component, inject, OnDestroy, OnInit, signal, computed } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import {
  debounceTime,
  distinctUntilChanged,
  Subject,
  takeUntil,
  finalize,
  catchError,
  firstValueFrom,
  map,
  of,
} from 'rxjs';
import { UserWithRolesResponse } from '../../../core/models/api.models';
import { Role } from '../../../core/models/role.model';
import { UserRoleApiService } from '../../../core/services/user-role-api.service';
import { UsersApiService } from '../../../core/services/users-api.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  UserRolesDialogComponent,
  UserRolesSavedResult,
} from '../user-roles-dialog/user-roles-dialog.component';
import { CreateUserDialogComponent } from '../create-user-dialog/create-user-dialog.component';
import { UserEditDialogComponent } from '../user-edit-dialog/user-edit-dialog.component';
import { PermissionService } from '../../../core/services/permission.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-user-admin',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule,
    MatMenuModule,
    MatProgressBarModule,
    MatDialogModule,
  ],
  templateUrl: './user-admin.component.html',
  styleUrl: './user-admin.component.scss',
})
export class UserAdminComponent implements OnInit, OnDestroy {
  private readonly userRoleApi = inject(UserRoleApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);
  readonly permissionService = inject(PermissionService);
  private readonly destroy$ = new Subject<void>();

  search = new FormControl('', { nonNullable: true });
  statusFilter = new FormControl<'Todos' | 'Activo' | 'Inactivo'>('Todos', { nonNullable: true });
  searchTerm = signal('');
  statusFilterValue = signal<'Todos' | 'Activo' | 'Inactivo'>('Todos');

  allUsers = signal<UserWithRolesResponse[]>([]);
  displayedColumns = ['name', 'email', 'role', 'status', 'actions'];

  isLoading = signal(false);
  isSaving = signal(false);

  rows = computed(() => {
    const q = this.searchTerm().toLowerCase().trim();
    const status = this.statusFilterValue();
    return this.allUsers().filter((u) => {
      if (status === 'Activo' && u.active !== true) return false;
      if (status === 'Inactivo' && u.active !== false) return false;
      if (!q) return true;
      const blob = `${u.name || ''} ${u.lastname || ''} ${u.email || ''}`.toLowerCase();
      return blob.includes(q);
    });
  });

  ngOnInit(): void {
    this.loadUsers();
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((v) => this.searchTerm.set(v));
    this.statusFilter.valueChanges
      .pipe(distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((v) => this.statusFilterValue.set(v ?? 'Todos'));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadUsers(): void {
    this.isLoading.set(true);

    const canSeeRoles = this.permissionService.hasModuleAccess('UserRole');

    // Ajustar columnas según el nivel de acceso del usuario.
    this.displayedColumns = canSeeRoles
      ? ['name', 'email', 'role', 'empresa', 'status', 'actions']
      : ['name', 'email', 'status', 'actions'];

    // Seleccionar endpoint según permisos: con UserRole → users-with-roles (incluye roles);
    // sin UserRole → GET /api/users (lista básica, sin columna de roles).
    const source$ = canSeeRoles
      ? this.userRoleApi.usersWithRoles()
      : this.usersApi.list().pipe(
          map((users) => users.map((u) => ({ ...u, roles: [] }) as UserWithRolesResponse)),
        );

    source$
      .pipe(
        catchError(() => {
          this.notify.error('Error al cargar usuarios');
          return of([] as UserWithRolesResponse[]);
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe((list) => this.allUsers.set(list));
  }

  roleLabel(role: Role | Record<string, unknown> | string | undefined): string {
    if (role == null) return '';
    if (typeof role === 'string') return role;
    const r = role as Role;
    return (r.name || '').trim();
  }

  trackByUserId(index: number, user: UserWithRolesResponse): string {
    return user.id || String(index);
  }

  getInitials(name?: string, lastname?: string): string {
    const n = name || '';
    const l = lastname || '';
    return `${n[0] || ''}${l[0] || ''}`.toUpperCase() || 'US';
  }

  hasAdminEmpresaRole(user: UserWithRolesResponse): boolean {
    return user.roles?.some(r => r.name?.toLowerCase().includes('administrador empresa')) ?? false;
  }

  canAssignRoles(): boolean {
    return this.auth.hasPermission('UserRole', 'assign');
  }

  canCreateUsers(): boolean {
    return this.auth.hasPermission('User', 'create');
  }

  canEditUsers(): boolean {
    return this.auth.hasPermission('User', 'edit');
  }

  canDeleteUsers(): boolean {
    return this.auth.hasPermission('User', 'delete');
  }

  openCreateUser(): void {
    const ref = this.dialog.open(CreateUserDialogComponent, {
      width: 'min(480px, calc(100vw - 32px))',
      maxWidth: '95vw',
      autoFocus: false,
    });
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.userRoleApi.invalidateUsersSnapshot();
      this.loadUsers();
    });
  }

  openEdit(user: UserWithRolesResponse): void {
    const ref = this.dialog.open(UserEditDialogComponent, {
      width: 'min(440px, calc(100vw - 32px))',
      data: { user },
      autoFocus: false,
    });
    ref.afterClosed().subscribe((saved) => {
      if (!saved || !user.id) return;
      void firstValueFrom(this.usersApi.findById(user.id))
        .then((u) => {
          this.userRoleApi.invalidateUsersSnapshot();
          this.allUsers.update((list) =>
            list.map((row) =>
              row.id === user.id
                ? {
                    ...row,
                    name: u.name,
                    lastname: u.lastname,
                    email: u.email ?? row.email,
                    active: u.active ?? row.active,
                  }
                : row,
            ),
          );
        })
        .catch(() => {
          this.userRoleApi.invalidateUsersSnapshot();
          this.loadUsers();
        });
    });
  }

  openRolesDialog(user: UserWithRolesResponse): void {
    const dialogRef = this.dialog.open(UserRolesDialogComponent, {
      width: '600px',
      maxWidth: '95vw',
      data: { user },
      panelClass: 'premium-dialog',
      autoFocus: false,
    });

    dialogRef.afterClosed().subscribe((result: UserRolesSavedResult | undefined) => {
      if (!result?.userId) return;
      this.allUsers.update((users) =>
        users.map((u) =>
          u.id === result.userId
            ? {
                ...u,
                roles: result.roles || [],
                empresaId: result.empresaId ?? u.empresaId,
                empresaNombre: result.empresaNombre ?? u.empresaNombre,
              }
            : u,
        ),
      );
      this.userRoleApi.invalidateUsersSnapshot();
      if (result.userId === this.auth.payload()?.id) {
        void this.auth.refreshRoleAssignments();
      }
    });
  }

  async toggleStatus(user: UserWithRolesResponse): Promise<void> {
    if (!user.id) return;
    const newStatus = user.active !== true;
    this.isSaving.set(true);
    try {
      await firstValueFrom(this.usersApi.update(user.id, { active: newStatus }));
      this.allUsers.update((users) =>
        users.map((u) => (u.id === user.id ? { ...u, active: newStatus } : u)),
      );
      this.userRoleApi.invalidateUsersSnapshot();
      this.notify.success(newStatus ? 'Usuario activado correctamente' : 'Usuario desactivado correctamente');
    } catch {
      this.notify.error('No se pudo actualizar el estado del usuario');
    } finally {
      this.isSaving.set(false);
    }
  }

  async removeUser(user: UserWithRolesResponse): Promise<void> {
    if (!user.id) return;
    if (!confirm(`¿Eliminar permanentemente al usuario "${user.name} ${user.lastname ?? ''}"?`)) return;
    this.isSaving.set(true);
    try {
      await firstValueFrom(this.usersApi.delete(user.id));
      this.allUsers.update((list) => list.filter((u) => u.id !== user.id));
      this.userRoleApi.invalidateUsersSnapshot();
      this.notify.success('Usuario eliminado correctamente');
    } catch {
      /* mensaje servidor */
    } finally {
      this.isSaving.set(false);
    }
  }
}
