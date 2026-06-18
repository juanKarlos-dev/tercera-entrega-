import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthResponse,
  CompleteProfileResponse,
  GithubAlternateEmailRequest,
  Login2FAResponse,
  LoginRequest,
  MessageResponse,
  TwoFactorResponse,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class SecurityApiService {
  private readonly http = inject(HttpClient);
  private readonly publicBase = `${environment.apiUrl}/security`;
  private readonly protectedBase = `${environment.apiUrl}/security`;
  private readonly silentHeaders = new HttpHeaders({ 'X-Skip-Loading': 'true' });

  login(body: LoginRequest): Observable<Login2FAResponse & Record<string, unknown>> {
    return this.http.post<Login2FAResponse & Record<string, unknown>>(`${this.publicBase}/login`, body);
  }

  verify2FA(body: { sessionId: string; code: string }): Observable<TwoFactorResponse> {
    return this.http.post<TwoFactorResponse>(`${this.publicBase}/2fa/verify`, body, {
      headers: this.silentHeaders,
    });
  }

  resend2FA(body: { sessionId: string }): Observable<TwoFactorResponse> {
    return this.http.post<TwoFactorResponse>(`${this.publicBase}/2fa/resend`, body, {
      headers: this.silentHeaders,
    });
  }

  cancel2FA(body: { sessionId: string }): Observable<TwoFactorResponse> {
    return this.http.post<TwoFactorResponse>(`${this.publicBase}/2fa/cancel`, body, {
      headers: this.silentHeaders,
    });
  }

  forgotPassword(body: { email: string; recaptchaToken: string }): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.publicBase}/forgot-password`, body);
  }

  resetPassword(body: {
    token: string;
    newPassword: string;
    confirmPassword: string;
  }): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.publicBase}/reset-password`, body);
  }

  completeProfile(body: { userId: string; address: string; phone: string }): Observable<CompleteProfileResponse> {
    return this.http.put<CompleteProfileResponse>(`${this.protectedBase}/complete-profile`, body);
  }

  unlinkGoogle(): Observable<MessageResponse> {
    return this.http.put<MessageResponse>(`${this.protectedBase}/unlink/google`, {});
  }

  unlinkGithub(): Observable<MessageResponse> {
    return this.http.put<MessageResponse>(`${this.protectedBase}/unlink/github`, {});
  }

  completeGithubEmail(email: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.protectedBase}/github/complete-email`, { email });
  }

  registerGithubAlternateEmail(body: GithubAlternateEmailRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.publicBase}/github/register-alternate-email`, body);
  }

  oauthAuthorizationUrl(provider: 'google' | 'microsoft' | 'github'): string {
    // Spring Security default OAuth2 entry point is NOT under /api
    const base = environment.apiUrl.replace('/api', '');
    return `${base}/oauth2/authorization/${provider}`;
  }
}
