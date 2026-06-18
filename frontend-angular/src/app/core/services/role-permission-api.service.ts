import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RolePermissionResponse, RolePermissionChangeResponse } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class RolePermissionApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/role-permission`;

  /** GET /api/role-permission/role/{roleId} — returns FLAT response objects */
  byRole(roleId: string): Observable<RolePermissionResponse[]> {
    return this.http.get<RolePermissionResponse[]>(`${this.base}/role/${roleId}`);
  }

  /** POST /api/role-permission/role/{roleId}/permission/{permissionId} */
  assign(roleId: string, permissionId: string): Observable<RolePermissionChangeResponse> {
    return this.http.post<RolePermissionChangeResponse>(
      `${this.base}/role/${roleId}/permission/${permissionId}`, {}
    );
  }

  /** DELETE /api/role-permission/{rolePermissionId} */
  remove(rolePermissionId: string): Observable<RolePermissionChangeResponse> {
    return this.http.delete<RolePermissionChangeResponse>(`${this.base}/${rolePermissionId}`);
  }

  /** GET /api/role-permission/role/{roleId}/summary */
  summary(roleId: string): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${this.base}/role/${roleId}/summary`);
  }
}
