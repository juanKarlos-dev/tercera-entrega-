import { Component, computed, Inject, inject, OnInit, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { CommonModule } from '@angular/common';
import { firstValueFrom, forkJoin } from 'rxjs';
import { Permission } from '../../../core/models/api.models';
import { Role } from '../../../core/models/role.model';
import { PermissionsApiService } from '../../../core/services/permissions-api.service';
import { RolePermissionApiService } from '../../../core/services/role-permission-api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { TECHNICAL_MODELS } from '../../../core/utils/permission-presenter';

// Una "entrada" es un label único dentro de un grupo, que puede representar
// múltiples permisos en BD (ej. "Lectura" = GET /api/rutas + GET /api/rutas/{id}).
interface PermissionEntry {
  label: string;
  representative: Permission;  // uno de los permisos (para mostrar datos técnicos)
  ids: string[];               // TODOS los ids con este label en el grupo
}

interface PermissionGroup {
  module: string;
  entries: PermissionEntry[];
}

@Component({
  selector: 'app-assign-permissions-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatDividerModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatExpansionModule,
  ],
  templateUrl: './assign-permissions-dialog.component.html',
  styleUrl: './assign-permissions-dialog.component.scss',
})
export class AssignPermissionsDialogComponent implements OnInit {
  private readonly permissionsApi = inject(PermissionsApiService);
  private readonly rpApi = inject(RolePermissionApiService);
  private readonly notify = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);

  mainGroups = signal<PermissionGroup[]>([]);
  advancedGroups = signal<PermissionGroup[]>([]);

  selectedIds = signal<Set<string>>(new Set());
  originalIds = new Set<string>();
  mapping = new Map<string, string>();

  loading = signal(false);
  saving = signal(false);
  hasChanges = signal(false);
  showTechnical = signal(false);

  readonly canManage = computed(() => {
    if (!this.permissionService.isHydrated()) return true;
    return (
      this.permissionService.canCall('POST', '/api/role-permission/role/{id}/permission/{id}') ||
      (this.permissionService.hasModuleAccess('Role') && this.permissionService.hasModuleAccess('Permission'))
    );
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { role: Role },
    private dialogRef: MatDialogRef<AssignPermissionsDialogComponent, boolean>,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const [all, assigned] = await firstValueFrom(
        forkJoin([this.permissionsApi.list(), this.rpApi.byRole(this.data.role.id!)]),
      );

      // Dos mapas anidados: groupKey → (label → { rep, ids[] })
      // Esto deduplica "Lectura" que aparece en /api/rutas Y /api/rutas/{id}
      type LabelInfo = { rep: Permission; ids: string[] };
      const mainLabelMaps = new Map<string, Map<string, LabelInfo>>();
      const advLabelMaps  = new Map<string, Map<string, LabelInfo>>();

      // Solo permisos en español (formato "Módulo - Acción" en campo model).
      // Los legacy en inglés (Bus, Company, etc.) no tienen " - " y se ocultan.
      all.filter((p) => p.model?.includes(' - ')).forEach((p) => {
        const groupKey = p.model!.split(' - ')[0].trim();
        const label    = p.model!.split(' - ').slice(1).join(' - ');
        const target   = TECHNICAL_MODELS.has(groupKey) ? advLabelMaps : mainLabelMaps;

        if (!target.has(groupKey)) target.set(groupKey, new Map());
        const labelMap = target.get(groupKey)!;

        if (!labelMap.has(label)) labelMap.set(label, { rep: p, ids: [] });
        if (p.id) labelMap.get(label)!.ids.push(p.id);
      });

      this.mainGroups.set(this.buildSortedGroups(mainLabelMaps));
      this.advancedGroups.set(this.buildSortedGroups(advLabelMaps));

      const ids = new Set<string>();
      assigned.forEach((a) => {
        if (a.permissionId) {
          ids.add(a.permissionId);
          if (a.rolePermissionId) this.mapping.set(a.permissionId, a.rolePermissionId);
        }
      });
      this.selectedIds.set(ids);
      this.originalIds = new Set(ids);
    } catch {
      this.notify.error('Error al cargar permisos');
    } finally {
      this.loading.set(false);
    }
  }

  // ── Construcción de grupos ──────────────────────────────────────────────

  private buildSortedGroups(
    labelMaps: Map<string, Map<string, { rep: Permission; ids: string[] }>>,
  ): PermissionGroup[] {
    const LABEL_ORDER: Record<string, number> = {
      Lectura: 1, Escritura: 2, 'Edición': 3, 'Eliminación': 4,
    };
    return [...labelMaps.entries()]
      .map(([module, labelMap]) => ({
        module,
        entries: [...labelMap.entries()]
          .map(([label, { rep, ids }]) => ({ label, representative: rep, ids }))
          .sort(
            (a, b) =>
              (LABEL_ORDER[a.label] ?? 99) - (LABEL_ORDER[b.label] ?? 99) ||
              a.label.localeCompare(b.label),
          ),
      }))
      .sort((a, b) => a.module.localeCompare(b.module));
  }

  // ── Selección de entradas ───────────────────────────────────────────────

  isEntrySelected(entry: PermissionEntry): boolean {
    return entry.ids.length > 0 && entry.ids.every((id) => this.selectedIds().has(id));
  }

  isEntryIndeterminate(entry: PermissionEntry): boolean {
    const count = entry.ids.filter((id) => this.selectedIds().has(id)).length;
    return count > 0 && count < entry.ids.length;
  }

  toggleEntry(entry: PermissionEntry): void {
    const next = new Set(this.selectedIds());
    const allSelected = entry.ids.every((id) => next.has(id));
    entry.ids.forEach((id) => {
      if (allSelected) next.delete(id);
      else next.add(id);
    });
    this.selectedIds.set(next);
    this.checkChanges();
  }

  toggleGroup(group: PermissionGroup): void {
    const next = new Set(this.selectedIds());
    const allSelected = group.entries.every((e) => e.ids.every((id) => next.has(id)));
    group.entries.forEach((e) => {
      e.ids.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
    });
    this.selectedIds.set(next);
    this.checkChanges();
  }

  isGroupAllSelected(group: PermissionGroup): boolean {
    return (
      group.entries.length > 0 &&
      group.entries.every((e) => e.ids.length > 0 && e.ids.every((id) => this.selectedIds().has(id)))
    );
  }

  private checkChanges(): void {
    const current = this.selectedIds();
    const added   = [...current].some((id) => !this.originalIds.has(id));
    const removed = [...this.originalIds].some((id) => !current.has(id));
    this.hasChanges.set(added || removed);
  }

  // ── Guardar ─────────────────────────────────────────────────────────────

  async save(): Promise<void> {
    this.saving.set(true);
    const current = this.selectedIds();
    const roleId  = this.data.role.id!;
    const toAdd   = [...current].filter((id) => !this.originalIds.has(id));
    const toRemove = [...this.originalIds].filter((id) => !current.has(id));

    const adds    = toAdd.map((id) => this.rpApi.assign(roleId, id));
    const removes = toRemove
      .map((id) => this.mapping.get(id))
      .filter((rpId): rpId is string => !!rpId)
      .map((rpId) => this.rpApi.remove(rpId));
    const requests = [...adds, ...removes];

    if (requests.length === 0) {
      this.dialogRef.close();
      this.saving.set(false);
      return;
    }

    try {
      await firstValueFrom(forkJoin(requests));
      this.notify.success('Permisos actualizados correctamente');
      this.dialogRef.close(true);
    } catch {
      this.notify.error('Error al guardar cambios');
    } finally {
      this.saving.set(false);
    }
  }

  // ── Icono por módulo ────────────────────────────────────────────────────

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
      Paraderos: 'place',
      Boletos: 'confirmation_number',
      Conductores: 'drive_eta',
      Ciudadanos: 'group',
      Empresas: 'business',
      Turnos: 'access_time',
      'Métodos de pago': 'payment',
    };
    return icons[mod] || 'folder';
  }
}
