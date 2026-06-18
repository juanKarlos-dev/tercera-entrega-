import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Permission } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class PermissionsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/permissions`;
  private listCache$?: Observable<Permission[]>;

  list(): Observable<Permission[]> {
    if (!this.listCache$) {
      this.listCache$ = this.http.get<Permission[]>(`${this.base}`).pipe(
        shareReplay(1)
      );
    }
    return this.listCache$;
  }

  /** Clears cache if needed (e.g. after an admin update) */
  clearCache(): void {
    this.listCache$ = undefined;
  }
}
