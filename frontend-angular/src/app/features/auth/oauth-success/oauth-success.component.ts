import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-oauth-success',
  standalone: true,
  imports: [MatCardModule, MatProgressSpinnerModule],
  templateUrl: './oauth-success.component.html',
  styleUrl: './oauth-success.component.scss',
})
export class OauthSuccessComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!token) {
      this.notify.error('No se recibió token OAuth. Intenta nuevamente.');
      void this.router.navigate(['/login']);
      return;
    }

    this.auth.setToken(token);
    this.notify.success('Sesión iniciada correctamente');
    void this.router.navigate(['/dashboard']);
  }
}
