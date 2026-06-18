import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { SidebarComponent } from '../components/sidebar/sidebar.component';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map, shareReplay } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { ContextService } from '../../core/services/context.service';
import { AuthService } from '../../core/services/auth.service';
import { MensajesService } from '../../core/services/mensajes.service';

@Component({
  selector: 'app-security-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    SidebarComponent
  ],
  templateUrl: './security-layout.component.html',
  styleUrls: ['./security-layout.component.scss']
})
export class SecurityLayoutComponent implements OnInit {
  private breakpointObserver = inject(BreakpointObserver);
  readonly ctx = inject(ContextService);
  private readonly auth = inject(AuthService);
  private readonly mensajesSvc = inject(MensajesService);

  readonly esCiudadano = computed(() =>
    this.auth.roleDisplayNames().some(r => r.toLowerCase().includes('ciudadano'))
  );

  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches),
      shareReplay()
    );

  sidenavOpened = true;
  isLoading = signal(true);

  ngOnInit(): void {
    const roles = this.auth.roleDisplayNames();
    if (roles && roles.length > 0) {
      this.isLoading.set(false);
    } else {
      setTimeout(() => this.isLoading.set(false), 300);
    }

    // Connect to WebSockets and listen to urgent alerts
    const payload = this.auth.payload();
    if (payload?.id) {
      this.mensajesSvc.conectar(payload.id);
      this.mensajesSvc.onAlertaUrgente().subscribe((alerta: any) => {
        import('sweetalert2').then(Swal => {
          Swal.default.fire({
            icon: 'warning',
            title: `¡ALERTA URGENTE!`,
            html: `<b>${alerta.asunto}</b><br/><br/>${alerta.mensaje}`,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#ef4444',
            allowOutsideClick: false,
            allowEscapeKey: false
          });
        });
      });
    }
  }

  toggleSidenav() {
    this.sidenavOpened = !this.sidenavOpened;
  }
}
