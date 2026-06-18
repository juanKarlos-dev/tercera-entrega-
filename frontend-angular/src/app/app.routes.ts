import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { canActivateModule, canActivateRole } from './core/guards/module-access.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },

  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },
  {
    path: 'reset-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },
  {
    path: 'two-factor',
    loadComponent: () =>
      import('./features/auth/two-factor/two-factor.component').then((m) => m.TwoFactorComponent),
  },
  {
    path: 'complete-github-email',
    loadComponent: () =>
      import('./features/auth/complete-github-email/complete-github-email.component').then(
        (m) => m.CompleteGithubEmailComponent,
      ),
  },
  {
    path: 'complete-profile',
    loadComponent: () =>
      import('./features/auth/complete-profile/complete-profile.component').then(
        (m) => m.CompleteProfileComponent,
      ),
  },
  {
    path: 'oauth-success',
    loadComponent: () =>
      import('./features/auth/oauth-success/oauth-success.component').then(
        (m) => m.OauthSuccessComponent,
      ),
  },

  {
    path: '',
    loadComponent: () =>
      import('./layout/security-layout/security-layout.component').then((m) => m.SecurityLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'roles',
        canActivate: [canActivateModule(['Role'])],
        loadComponent: () =>
          import('./features/roles/role-list/role-list.component').then(
            (m) => m.RoleListComponent
          ),
      },
      {
        path: 'role-permissions',
        canActivate: [canActivateModule(['Permission', 'RolePermission'])],
        loadComponent: () =>
          import('./features/role-permissions/role-permissions.component').then(
            (m) => m.RolePermissionsComponent,
          ),
      },
      {
        path: 'users',
        canActivate: [canActivateModule(['User', 'UserRole'])],
        loadComponent: () =>
          import('./features/users/user-admin/user-admin.component').then((m) => m.UserAdminComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile-settings/profile-settings.component').then(
            (m) => m.ProfileSettingsComponent,
          ),
      },
      {
        path: 'empresas',
        canActivate: [canActivateRole(['Administrador Sistema', 'Administrador Empresa'])],
        loadComponent: () =>
          import('./features/empresas/empresas.component').then((m) => m.EmpresasComponent),
      },
      {
        path: 'buses',
        canActivate: [canActivateRole(['Administrador Sistema', 'Administrador Empresa'])],
        loadComponent: () =>
          import('./features/buses/buses.component').then((m) => m.BusesComponent),
      },
      {
        path: 'conductores',
        canActivate: [canActivateRole(['Administrador Sistema', 'Administrador Empresa'])],
        loadComponent: () =>
          import('./features/conductores/conductores.component').then((m) => m.ConductoresComponent),
      },
      {
        path: 'paraderos',
        canActivate: [canActivateRole(['Administrador Sistema', 'Administrador Empresa', 'Ciudadano'])],
        loadComponent: () =>
          import('./features/paraderos/paraderos.component').then((m) => m.ParaderosComponent),
      },
      {
        path: 'rutas',
        canActivate: [canActivateRole(['Administrador Sistema', 'Administrador Empresa', 'Ciudadano'])],
        loadComponent: () =>
          import('./features/rutas/rutas.component').then((m) => m.RutasComponent),
      },
      {
        path: 'turnos',
        canActivate: [canActivateRole(['Administrador Sistema', 'Administrador Empresa', 'Supervisor', 'Conductor'])],
        loadComponent: () =>
          import('./features/turnos/turnos.component').then((m) => m.TurnosComponent),
      },
      {
        path: 'programaciones',
        canActivate: [canActivateRole(['Administrador Sistema', 'Administrador Empresa', 'Supervisor', 'Conductor', 'Ciudadano'])],
        loadComponent: () =>
          import('./features/programaciones/programaciones.component').then((m) => m.ProgramacionesComponent),
      },
      {
        path: 'boletos',
        canActivate: [canActivateRole(['Administrador Sistema', 'Administrador Empresa', 'Supervisor', 'Ciudadano'])],
        loadComponent: () =>
          import('./features/boletos/boletos.component').then((m) => m.BoletosComponent),
      },
      {
        path: 'incidentes',
        canActivate: [canActivateRole(['Administrador Sistema', 'Administrador Empresa', 'Supervisor', 'Conductor'])],
        loadComponent: () =>
          import('./features/incidentes/incidentes.component').then((m) => m.IncidentesComponent),
      },
      {
        path: 'ciudadanos',
        canActivate: [canActivateRole(['Administrador Sistema'])],
        loadComponent: () =>
          import('./features/ciudadanos/ciudadanos.component').then((m) => m.CiudadanosComponent),
      },
      {
        path: 'metodos-pago',
        canActivate: [canActivateRole(['Administrador Sistema', 'Ciudadano'])],
        loadComponent: () =>
          import('./features/metodos-pago/metodos-pago.component').then((m) => m.MetodosPagoComponent),
      },
      {
        path: 'reportes',
        canActivate: [canActivateRole(['Administrador Sistema', 'Administrador Empresa', 'Supervisor'])],
        loadComponent: () =>
          import('./features/reportes/reportes.component').then((m) => m.ReportesComponent),
      },
      {
        path: 'tracking',
        canActivate: [canActivateRole(['Administrador Sistema', 'Administrador Empresa', 'Supervisor', 'Ciudadano'])],
        loadComponent: () =>
          import('./features/tracking/tracking.component').then((m) => m.TrackingComponent),
      },
      {
        path: 'panel-control',
        canActivate: [canActivateRole(['Administrador Sistema', 'Administrador Empresa', 'Supervisor'])],
        loadComponent: () =>
          import('./features/panel-control/panel-control.component').then((m) => m.PanelControlComponent),
      },
      {
        path: 'mensajes',
        loadComponent: () =>
          import('./features/mensajes/mensajes.component').then((m) => m.MensajesComponent),
      },
      {
        path: 'grupos',
        loadComponent: () =>
          import('./features/grupos/grupos.component').then((m) => m.GruposComponent),
      },
      {
        path: 'admin/pqrs',
        canActivate: [canActivateRole(['Administrador Sistema', 'Administrador Empresa', 'Supervisor'])],
        loadComponent: () =>
          import('./features/pqrs/pqrs-admin/pqrs-admin.component').then((m) => m.PqrsAdminComponent),
      },
      {
        path: 'pqrs',
        loadComponent: () =>
          import('./features/pqrs/pqrs.component').then((m) => m.PqrsComponent),
      },
      {
        path: 'citas',
        loadComponent: () =>
          import('./features/citas/citas.component').then((m) => m.CitasComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },

  {
    path: 'forbidden',
    loadComponent: () =>
      import('./features/forbidden/forbidden.component').then((m) => m.ForbiddenComponent),
  },
  {
    path: 'access-denied',
    loadComponent: () =>
      import('./features/forbidden/forbidden.component').then((m) => m.ForbiddenComponent),
  },

  { path: '**', redirectTo: 'login' },
];
