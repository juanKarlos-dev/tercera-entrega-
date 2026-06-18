import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../core/services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDividerModule,
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly breakpoint = inject(BreakpointObserver);

  readonly user = computed(() => this.auth.payload());

  readonly userLabel = computed(() => {
    const p = this.user();
    if (p?.name) return p.name;
    return p?.email ?? 'Admin Demo';
  });

  readonly userInitials = computed(() => {
    const name = this.userLabel();
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'AD';
  });

  readonly userRole = computed(() => {
    const roles = this.auth.roles();
    return roles[0] || 'Administrador';
  });

  readonly isHandset = toSignal(
    this.breakpoint.observe(Breakpoints.Handset).pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  sidenavOpen = true;

  logout(): void {
    this.auth.logout(true);
  }

  toggleSidenav(): void {
    this.sidenavOpen = !this.sidenavOpen;
  }
}
