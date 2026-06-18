import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { AuthService } from '../../core/services/auth.service';

interface Tile { icon: string; label: string; description: string; route: string; }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);

  readonly user        = computed(() => this.auth.payload());
  readonly roles       = computed(() => this.auth.roleDisplayNames());
  readonly esCiudadano  = computed(() =>
    this.auth.roleDisplayNames().some(r => r.toLowerCase().includes('ciudadano'))
  );
  readonly esConductor  = computed(() =>
    this.auth.roleDisplayNames().some(r => r.toLowerCase().includes('conductor'))
  );
  readonly esSupervisor   = computed(() =>
    this.auth.roleDisplayNames().some(r => r.toLowerCase().includes('supervisor'))
  );
  readonly esAdminEmpresa = computed(() =>
    this.auth.roleDisplayNames().some(r =>
      r.toLowerCase().includes('administrador empresa') || r.toLowerCase().includes('admin empresa')
    )
  );
  readonly esAdminSistema = computed(() =>
    this.auth.roleDisplayNames().some(r =>
      r.toLowerCase().includes('administrador sistema') || r.toLowerCase().includes('admin sistema')
    )
  );

  readonly securityTiles: Tile[] = [
    { icon: 'badge',  label: 'Roles',            description: 'CRUD de roles del sistema.',                route: '/roles' },
    { icon: 'rule',   label: 'Permisos por rol',  description: 'Asigna permisos HTTP a cada rol.',         route: '/role-permissions' },
    { icon: 'group',  label: 'Usuarios',          description: 'Visualiza usuarios y gestiona sus roles.', route: '/users' },
    { icon: 'person', label: 'Perfil',            description: 'Configuración y desvinculación OAuth.',    route: '/profile' },
  ];

  readonly negocioTiles: Tile[] = [
    { icon: 'business',            label: 'Empresas',        description: 'Gestión de empresas de transporte.',          route: '/empresas' },
    { icon: 'directions_bus',      label: 'Buses',           description: 'Flota de buses, estados y asignaciones.',     route: '/buses' },
    { icon: 'badge',               label: 'Conductores',     description: 'Registro y control de conductores.',          route: '/conductores' },
    { icon: 'place',               label: 'Paraderos',       description: 'Puntos de parada con ubicación en mapa.',     route: '/paraderos' },
    { icon: 'route',               label: 'Rutas',           description: 'Definición de rutas y secuencia de paradas.', route: '/rutas' },
    { icon: 'schedule',            label: 'Turnos',          description: 'Inicio y fin de turnos con GPS.',             route: '/turnos' },
    { icon: 'calendar_month',      label: 'Programaciones',  description: 'Asignación de buses y conductores a rutas.',  route: '/programaciones' },
    { icon: 'confirmation_number', label: 'Boletos',         description: 'Abordaje, descenso y recorrido.',             route: '/boletos' },
    { icon: 'warning',             label: 'Incidentes',      description: 'Registro de incidentes con fotos y GPS.',     route: '/incidentes' },
    { icon: 'people',              label: 'Ciudadanos',      description: 'Base de ciudadanos del sistema.',             route: '/ciudadanos' },
    { icon: 'payment',             label: 'Métodos de Pago', description: 'Tarjetas prepagadas, QR y recargas ePayco.', route: '/metodos-pago' },
    { icon: 'bar_chart',           label: 'Reportes',        description: 'Gráficas de ingresos y tendencias.',          route: '/reportes' },
  ];
}
