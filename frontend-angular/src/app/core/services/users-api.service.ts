import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MessageResponse, RegisterRequest, RegisterResponse, User } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http = inject(HttpClient);
  private readonly publicBase = `${environment.apiUrl}/users`;
  private readonly protectedBase = `${environment.apiUrl}/users`;

  list(): Observable<User[]> {
    return this.http.get<User[]>(`${this.protectedBase}`);
  }

  findById(id: string): Observable<User> {
    return this.http.get<User>(`${this.protectedBase}/${id}`);
  }

  /** POST /api/users — alta por administrador (mismo body que registro público). */
  create(body: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.protectedBase}`, body);
  }

  update(id: string, user: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.protectedBase}/${id}`, user);
  }

  delete(id: string): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.protectedBase}/${id}`);
  }

  register(body: RegisterRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.publicBase}/register`, body);
  }

  asignarEmpresa(userId: string, empresaId: string, empresaNombre: string): Observable<any> {
    return this.http.patch<any>(`${this.protectedBase}/${userId}/empresa`, { empresaId, empresaNombre });
  }
}
