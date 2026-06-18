import { Component, computed, effect, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ContextService } from '../../../core/services/context.service';
import { EmpresasService } from '../../../core/services/empresas.service';
import { ConductoresService } from '../../../core/services/conductores.service';
import { MensajesService } from '../../../core/services/mensajes.service';
import { Empresa, Conductor } from '../../../core/models/negocio.models';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MatIconModule, MatTooltipModule, MatButtonModule, MatBadgeModule, MatSelectModule, MatFormFieldModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly permissionService = inject(PermissionService);
  readonly ctx = inject(ContextService);
  private readonly empresasSvc = inject(EmpresasService);
  private readonly conductoresSvc = inject(ConductoresService);
  private readonly mensajesSvc = inject(MensajesService);

  mensajesNoLeidos = signal<number>(0);
  private badgeInterval: ReturnType<typeof setInterval> | null = null;

  private normalize(s: string): string {
    return s.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  readonly esConductor = computed(() =>
    this.auth.roleDisplayNames().some(r => this.normalize(r).includes('conductor'))
  );
  readonly esAdminEmpresa = computed(() =>
    this.auth.roleDisplayNames().some(r => this.normalize(r).includes('administrador empresa'))
  );
  // Shortcut explícito: Administrador Sistema tiene acceso total sin verificar permisos individuales.
  private readonly isAdminSistema = computed(() =>
    this.auth.roleDisplayNames().some(r => this.normalize(r) === 'administrador sistema')
  );
  readonly showOrgContext = computed(() =>
    this.isAdminSistema() || this.hasAnyRole('administrador empresa', 'supervisor', 'conductor')
  );

  empresas = signal<Empresa[]>([]);
  conductores = signal<Conductor[]>([]);
  selectedEmpresaId = signal<number | null>(this.ctx.empresaId());
  selectedConductorId = signal<number | null>(this.ctx.conductorId());

  constructor() {
    // Doble verificación: signal reactivo + claims crudos del JWT
    // (el signal puede estar vacío si la API de roles aún no respondió)
    const payload = this.auth.payload();
    const rolesJwt = [...(payload?.roles ?? []), payload?.role ?? ''].map(r => r.trim().toLowerCase());
    const needsOrgContext = rolesJwt.some(r =>
      r.includes('administrador sistema') ||
      r.includes('administrador empresa') || r.includes('supervisor') || r.includes('conductor')
    );

    if (needsOrgContext) {
      this.empresasSvc.list().subscribe(e => {
        this.empresas.set(e);

        const esAdminPorJwt = rolesJwt.some(r => r.includes('administrador empresa'));
        const esAdmin = this.esAdminEmpresa() || esAdminPorJwt;

        if (esAdmin && this.ctx.empresaId() == null) {
          const empresaId = payload?.empresaId ? Number(payload.empresaId) : null;
          const empresaNombre = payload?.empresaNombre ?? null;

          if (empresaId && empresaNombre) {
            this.ctx.setEmpresa({ id: empresaId, nombre: empresaNombre });
            this.selectedEmpresaId.set(empresaId);
          } else {
            // Fallback: si hay una sola empresa en la lista, auto-seleccionarla
            const unica = e.length === 1 ? e[0] : null;
            if (unica?.id != null) {
              this.ctx.setEmpresa(unica);
              this.selectedEmpresaId.set(unica.id);
            }
          }
        }
      });
    }

    effect(() => {
      const empresaId = this.ctx.empresaId();
      if (empresaId && needsOrgContext) {
        this.ctx.setConductor(null);
        this.selectedConductorId.set(null);
        this.conductoresSvc.list().subscribe(c => {
          this.conductores.set(c);
          if (this.esConductor()) {
            const email = this.auth.currentUserSnapshot()?.email;
            const miConductor = c.find(cond =>
              cond.persona?.email === email || cond.email === email
            );
            if (miConductor?.id != null) {
              this.onConductorChange(miConductor.id);
            }
          }
        });
      }
    });
  }

  ngOnInit(): void {
    console.log('Cargando empresas para rol:', this.auth.roleDisplayNames());
    console.log('URL empresas:', environment.apiUrlLogica + '/empresas');

    const userId = this.auth.payload()?.id ?? '';
    if (userId) {
      this.actualizarBadge(userId);
      this.badgeInterval = setInterval(() => this.actualizarBadge(userId), 60_000);
    }
  }

  ngOnDestroy(): void {
    if (this.badgeInterval) clearInterval(this.badgeInterval);
  }

  private actualizarBadge(userId: string): void {
    this.mensajesSvc.getBandeja(userId).subscribe({
      next: msgs => this.mensajesNoLeidos.set(msgs.filter(m => !m.leido).length),
      error: () => {},
    });
  }

  onEmpresaChange(id: number | null): void {
    const empresa = this.empresas().find(e => e.id === id) ?? null;
    this.ctx.setEmpresa(empresa);
    this.selectedEmpresaId.set(id);
  }

  onConductorChange(id: number | null): void {
    const conductor = this.conductores().find(c => c.id === id) ?? null;
    this.ctx.setConductor(conductor);
    this.selectedConductorId.set(id);
  }

  readonly userLabel = computed(() => {
    const user = this.auth.currentUserSnapshot();
    return user ? user.username || user.name || '' : 'Usuario';
  });

  readonly userRoles = computed(() => this.auth.roleDisplayNames());

  readonly userRoleDisplay = computed(() => {
    const roles = this.userRoles();
    if (roles.length === 0) return 'Sin rol';
    if (roles.length <= 3) return roles.join(', ');
    const visible = roles.slice(0, 3).join(', ');
    return `${visible} +${roles.length - 3}`;
  });

  readonly userRoleTooltip = computed(() => {
    const roles = this.userRoles();
    return roles.length > 0 ? roles.join(', ') : 'Sin rol asignado';
  });

  readonly userInitials = computed(() => {
    const label = this.userLabel().trim();
    if (!label) return 'US';
    const parts = label.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] || label[0] || '?';
    const b = parts.length > 1 ? parts[1]?.[0] || '' : label[1] || '';
    return `${a}${b}`.toUpperCase().slice(0, 3);
  });

  /** Visible mientras no se haya hidratado (evita menú vacío tras F5). */
  readonly showUsers = computed(() => {
    if (this.isAdminSistema()) return true;
    if (!this.permissionService.isHydrated()) return true;
    return (
      this.permissionService.hasModuleAccess('User') ||
      this.permissionService.hasModuleAccess('UserRole') ||
      this.permissionService.hasModuleAccess('Usuarios - Lectura')
    );
  });

  readonly showRoles = computed(() => {
    if (this.isAdminSistema()) return true;
    if (!this.permissionService.isHydrated()) return true;
    return (
      this.permissionService.hasModuleAccess('Role') ||
      this.permissionService.hasModuleAccess('Roles - Lectura')
    );
  });

  readonly showPermissions = computed(() => {
    if (this.isAdminSistema()) return true;
    if (!this.permissionService.isHydrated()) return true;
    return (
      this.permissionService.hasModuleAccess('Permission') ||
      this.permissionService.hasModuleAccess('RolePermission') ||
      this.permissionService.hasModuleAccess('Permisos - Lectura')
    );
  });

  // --- Módulos de negocio: visibilidad basada en nombres de rol (case-insensitive) ---
  // hasAnyRole verifica la UNIÓN: muestra el ítem si el usuario tiene ALGUNO de los roles listados.
  // isAdminSistema actúa como cortocircuito: acceso total sin verificar roles individuales.

  private hasAnyRole(...names: string[]): boolean {
    const lower = this.auth.roleDisplayNames().map((r) => this.normalize(r));
    return names.map((n) => this.normalize(n)).some((n) => lower.some(r => r === n));
  }

  readonly showEmpresas = computed(() =>
    this.isAdminSistema() || this.hasAnyRole('administrador empresa')
  );
  readonly showBuses = computed(() =>
    this.isAdminSistema() || this.hasAnyRole('administrador empresa')
  );
  readonly showConductores = computed(() =>
    this.isAdminSistema() || this.hasAnyRole('administrador empresa')
  );
  readonly showParaderos = computed(() =>
    this.isAdminSistema() || this.hasAnyRole('administrador empresa', 'ciudadano')
  );
  readonly showRutas = computed(() =>
    this.isAdminSistema() || this.hasAnyRole('administrador empresa', 'ciudadano')
  );
  readonly showTurnos = computed(() =>
    this.isAdminSistema() || this.hasAnyRole('administrador empresa', 'supervisor', 'conductor')
  );
  readonly showProgramaciones = computed(() =>
    this.isAdminSistema() || this.hasAnyRole('administrador empresa', 'supervisor', 'conductor', 'ciudadano')
  );
  readonly showBoletos = computed(() =>
    this.isAdminSistema() || this.hasAnyRole('administrador empresa', 'supervisor', 'ciudadano')
  );
  readonly showIncidentes = computed(() =>
    this.isAdminSistema() || this.hasAnyRole('administrador empresa', 'supervisor', 'conductor')
  );
  readonly showCiudadanos = computed(() => this.isAdminSistema());
  readonly showMetodosPago = computed(() =>
    this.isAdminSistema() || this.hasAnyRole('ciudadano')
  );
  readonly showReportes = computed(() =>
    this.isAdminSistema() || this.hasAnyRole('administrador empresa', 'supervisor')
  );
  readonly showTracking = computed(() =>
    this.isAdminSistema() || this.hasAnyRole('administrador empresa', 'supervisor', 'ciudadano')
  );
  readonly showPanelControl = computed(() =>
    this.isAdminSistema() || this.hasAnyRole('administrador empresa', 'supervisor')
  );
  readonly showMensajes = computed(() => true);
  readonly showGrupos   = computed(() => true);
  readonly showPqrs     = computed(() => true);
  readonly showPqrsAdmin= computed(() =>
    this.isAdminSistema() || this.hasAnyRole('administrador empresa', 'supervisor')
  );
  readonly showCitas    = computed(() => true);

  logout(): void {
    this.auth.logout(true);
  }
}
