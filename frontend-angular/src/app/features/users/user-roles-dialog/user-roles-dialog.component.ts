import { Component, computed, Inject, inject, OnInit, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { CommonModule } from '@angular/common';
import { firstValueFrom, forkJoin } from 'rxjs';
import {
  RoleAvailabilityResponse,
  UserWithRolesResponse,
} from '../../../core/models/api.models';
import { Role } from '../../../core/models/role.model';
import { Empresa } from '../../../core/models/negocio.models';
import { NotificationService } from '../../../core/services/notification.service';
import { UserRoleApiService } from '../../../core/services/user-role-api.service';
import { EmpresasService } from '../../../core/services/empresas.service';
import { UsersApiService } from '../../../core/services/users-api.service';

export interface UserRolesDialogData {
  user: UserWithRolesResponse;
}

export interface UserRolesSavedResult {
  userId: string;
  roles: Role[];
  empresaId?: string;
  empresaNombre?: string;
}

@Component({
  selector: 'app-user-roles-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatListModule,
    MatButtonModule,
    MatDividerModule,
    MatCheckboxModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
  templateUrl: './user-roles-dialog.component.html',
  styleUrl: './user-roles-dialog.component.scss',
})
export class UserRolesDialogComponent implements OnInit {
  private readonly api = inject(UserRoleApiService);
  private readonly notify = inject(NotificationService);
  private readonly empresasSvc = inject(EmpresasService);
  private readonly usersApi = inject(UsersApiService);
  readonly dialogRef = inject(MatDialogRef<UserRolesDialogComponent, UserRolesSavedResult | undefined>);

  availableRoles = signal<RoleAvailabilityResponse[]>([]);
  initialRoleIds = new Set<string>();
  selectedRoleIds = signal<string[]>([]);
  isLoading = signal(false);
  isSaving = signal(false);

  empresas = signal<Empresa[]>([]);
  selectedEmpresaId = signal<number | null>(null);

  readonly mostrarSelectorEmpresa = computed(() => {
    const adminEmpresaRole = this.availableRoles()
      .find(r => r.name?.toLowerCase().includes('administrador empresa'));
    return !!adminEmpresaRole?.id && this.selectedRoleIds().includes(adminEmpresaRole.id);
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: UserRolesDialogData) {}

  async ngOnInit(): Promise<void> {
    this.empresasSvc.list().subscribe(e => this.empresas.set(e));
    await this.loadData();
    if (this.data.user.empresaId) {
      const id = Number(this.data.user.empresaId);
      if (!isNaN(id)) this.selectedEmpresaId.set(id);
    }
  }

  private async loadData(): Promise<void> {
    const userId = this.data.user.id;
    if (!userId) return;

    this.isLoading.set(true);
    try {
      const res = await firstValueFrom(this.api.availableRoles(userId));
      const roles = res.availableRoles || [];
      this.availableRoles.set(roles);

      this.initialRoleIds.clear();
      const assigned: string[] = [];
      roles.forEach(r => {
        if (r.assigned && r.id) {
          this.initialRoleIds.add(r.id);
          assigned.push(r.id);
        }
      });
      this.selectedRoleIds.set(assigned);
    } catch {
      this.notify.error('Error al cargar roles disponibles');
    } finally {
      this.isLoading.set(false);
    }
  }

  toggleRole(roleId?: string): void {
    if (!roleId) return;
    const current = this.selectedRoleIds();
    if (current.includes(roleId)) {
      this.selectedRoleIds.set(current.filter(id => id !== roleId));
    } else {
      this.selectedRoleIds.set([...current, roleId]);
    }
  }

  isSelected(roleId?: string): boolean {
    return !!roleId && this.selectedRoleIds().includes(roleId);
  }

  isChanged(): boolean {
    const selected = this.selectedRoleIds();
    if (this.initialRoleIds.size !== selected.length) return true;
    return selected.some(id => !this.initialRoleIds.has(id));
  }

  async save(): Promise<void> {
    const userId = this.data.user.id;
    if (!userId) return;

    const selected = this.selectedRoleIds();
    const toAdd = selected.filter(id => !this.initialRoleIds.has(id));
    const toRemove = Array.from(this.initialRoleIds).filter(id => !selected.includes(id));

    if (toAdd.length === 0 && toRemove.length === 0) {
      this.dialogRef.close(undefined);
      return;
    }

    this.isSaving.set(true);
    try {
      const requests = [
        ...toAdd.map(roleId => this.api.assign(userId, roleId)),
        ...toRemove.map(roleId => this.api.removeRole(userId, roleId)),
      ];

      if (requests.length > 0) {
        await firstValueFrom(forkJoin(requests));

        let empresaId: string | undefined;
        let empresaNombre: string | undefined;
        if (this.mostrarSelectorEmpresa() && this.selectedEmpresaId() != null) {
          const empresa = this.empresas().find(e => e.id === this.selectedEmpresaId());
          if (empresa?.id != null) {
            empresaId = String(empresa.id);
            empresaNombre = empresa.nombre ?? '';
            await firstValueFrom(this.usersApi.asignarEmpresa(userId, empresaId, empresaNombre));
          }
        }

        this.notify.success('Roles actualizados correctamente');
        const rolesPayload: Role[] = this.availableRoles()
          .filter(r => r.id && selected.includes(r.id))
          .map(r => ({ id: r.id, name: r.name, description: r.description }));
        this.dialogRef.close({ userId, roles: rolesPayload, empresaId, empresaNombre });
      }
    } catch {
      this.notify.error('Error al actualizar algunos roles');
    } finally {
      this.isSaving.set(false);
    }
  }
}
