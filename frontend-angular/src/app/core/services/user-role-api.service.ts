import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MessageResponse,
  UserAvailableRolesResponse,
  UserRoleByUserResponse,
  UserWithRolesResponse,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class UserRoleApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/user-role`;
  private readonly silentHeaders = new HttpHeaders({ 'X-Skip-Loading': 'true' });

  /** Listado sin búsqueda en backend; compartido entre pantallas para evitar duplicar llamadas. */
  private usersSnapshot$?: Observable<UserWithRolesResponse[]>;

  invalidateUsersSnapshot(): void {
    this.usersSnapshot$ = undefined;
  }

  usersWithRoles(search?: string): Observable<UserWithRolesResponse[]> {
    const q = search?.trim();
    if (q) {
      let params = new HttpParams().set('search', q);
      return this.http.get<UserWithRolesResponse[]>(`${this.base}/users-with-roles`, { params });
    }
    if (!this.usersSnapshot$) {
      this.usersSnapshot$ = this.http
        .get<UserWithRolesResponse[]>(`${this.base}/users-with-roles`)
        .pipe(shareReplay(1));
    }
    return this.usersSnapshot$;
  }

  userRoles(userId: string): Observable<UserRoleByUserResponse[]> {
    return this.http.get<UserRoleByUserResponse[]>(`${this.base}/user/${userId}/roles`, {
      headers: this.silentHeaders,
    });
  }

  availableRoles(userId: string): Observable<UserAvailableRolesResponse> {
    return this.http.get<UserAvailableRolesResponse>(`${this.base}/user/${userId}/available-roles`);
  }

  assign(userId: string, roleId: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.base}/user/${userId}/role/${roleId}`, {});
  }

  remove(userRoleId: string): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.base}/${userRoleId}`);
  }

  removeRole(userId: string, roleId: string): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.base}/user/${userId}/role/${roleId}`);
  }

  effectivePermissions(userId: string): Observable<any> {
    return this.http.get<any>(`${this.base}/user/${userId}/effective-permissions`, {
      headers: this.silentHeaders,
    });
  }
}
