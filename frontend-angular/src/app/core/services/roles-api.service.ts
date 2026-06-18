import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MessageResponse } from '../models/api.models';
import { Role } from '../models/role.model';

@Injectable({ providedIn: 'root' })
export class RolesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/roles`;
  private listCache$?: Observable<Role[]>;

  list(): Observable<Role[]> {
    if (!this.listCache$) {
      this.listCache$ = this.http.get<Role[]>(`${this.base}`).pipe(
        shareReplay(1)
      );
    }
    return this.listCache$;
  }

  create(role: Role): Observable<Role> {
    return this.http.post<Role>(`${this.base}`, role).pipe(
      tap(() => this.clearCache())
    );
  }

  update(id: string, role: Role): Observable<Role> {
    return this.http.put<Role>(`${this.base}/${id}`, role).pipe(
      tap(() => this.clearCache())
    );
  }

  delete(id: string): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.base}/${id}`).pipe(
      tap(() => this.clearCache())
    );
  }

  clearCache(): void {
    this.listCache$ = undefined;
  }
}
