import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { LoadingService } from './core/services/loading.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MatProgressBarModule],
  template: `
    @if (loading.active()) {
      <mat-progress-bar mode="indeterminate" color="primary" class="top-bar" />
    }
    <router-outlet />
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
      }
      .top-bar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 1000;
      }
    `,
  ],
})
export class AppComponent {
  readonly loading = inject(LoadingService);
}
