import { Role } from './role.model';

export interface LoginRequest {
  email: string;
  password: string;
  recaptchaToken: string;
}

export interface Login2FAResponse {
  success?: boolean;
  errorType?: string;
  requires2FA?: boolean;
  sessionId?: string;
  maskedEmail?: string;
  message?: string;
  expiresAt?: string;
  expiresInSeconds?: number;
  attemptsRemaining?: number;
}

export interface TwoFactorVerifyBody {
  sessionId: string;
  code: string;
}

export interface TwoFactorResponse {
  authenticated?: boolean;
  message?: string;
  token?: string;
  sessionId?: string;
  expiresAt?: string;
  expiresInSeconds?: number;
  attemptsRemaining?: number;
  sessionInvalidated?: boolean;
  resent?: boolean;
  cancelled?: boolean;
}

export interface RegisterRequest {
  name: string;
  lastname: string;
  email: string;
  password: string;
  confirmPassword: string;
  recaptchaToken: string;
}

export interface MessageResponse {
  message?: string;
}

export interface RegisterResponse {
  message?: string;
  userId?: string;
  name?: string;
  lastname?: string;
  email?: string;
  authProvider?: string;
  active?: boolean;
  emailVerified?: boolean;
}

export interface User {
  id?: string;
  name?: string;
  lastname?: string;
  email?: string;
  password?: string;
  authProvider?: string;
  providerId?: string;
  picture?: string;
  emailVerified?: boolean;
  active?: boolean;
  username?: string;
  address?: string;
  phone?: string;
  empresaId?: string;
  empresaNombre?: string;
}

export interface AuthResponse {
  success?: boolean;
  token?: string;
  user?: User;
  userId?: string;
  email?: string;
  name?: string;
  lastname?: string;
  authProvider?: string;
  message?: string;
  newUser?: boolean;
  isNewUser?: boolean;
  requiresAdditionalInfo?: boolean;
  requiresCompleteProfile?: boolean;
  emailRequired?: boolean;
  /** GitHub sin email en BD: pedir email alternativo (OAuth redirect o JSON manual) */
  requiresEmailCompletion?: boolean;
  providerId?: string;
  username?: string;
  picture?: string;
}

export interface GithubAlternateEmailRequest {
  providerId: string;
  username?: string;
  name?: string;
  picture?: string;
  email: string;
}

export interface CompleteProfileResponse extends MessageResponse {
  success?: boolean;
  token?: string;
  userId?: string;
  email?: string;
}

export interface Permission {
  id?: string;
  url?: string;
  method?: string;
  model?: string;
  name?: string;
}

// ──────────────────────────────────────────────
// LEGACY: Kept for backward compat but no longer
// returned by the backend. Use RolePermissionResponse instead.
// ──────────────────────────────────────────────
export interface RolePermission {
  id?: string;
  role?: Role;
  permission?: Permission;
}

// ──────────────────────────────────────────────
// ACTUAL backend response (flat fields)
// GET /api/role-permission/role/{roleId}
// ──────────────────────────────────────────────
export interface RolePermissionResponse {
  rolePermissionId?: string;
  roleId?: string;
  roleName?: string;
  roleDescription?: string;
  permissionId?: string;
  permissionUrl?: string;
  permissionMethod?: string;
  permissionModel?: string;
}

// POST /api/role-permission/role/{roleId}/permission/{permissionId}
// DELETE /api/role-permission/{rolePermissionId}
export interface RolePermissionChangeResponse {
  message?: string;
  rolePermissionId?: string;
  roleId?: string;
  roleName?: string;
  permissionId?: string;
  permissionUrl?: string;
  permissionMethod?: string;
}

// ──────────────────────────────────────────────
// User-Role responses (from backend as-is)
// ──────────────────────────────────────────────
export interface UserRoleByUserResponse {
  userRoleId?: string;
  userId?: string;
  userName?: string;
  userLastname?: string;
  userEmail?: string;
  roleId?: string;
  roleName?: string;
  roleDescription?: string;
}

export interface RoleAvailabilityResponse {
  id?: string;
  name?: string;
  description?: string;
  assigned?: boolean;
}

export interface UserAvailableRolesResponse {
  id?: string;
  name?: string;
  lastname?: string;
  email?: string;
  availableRoles?: RoleAvailabilityResponse[];
  assignedRoles?: Role[];
  effectivePermissions?: EffectivePermissionResponse[];
}

export interface EffectivePermissionResponse {
  permissionId?: string;
  url?: string;
  method?: string;
  model?: string;
  grantedByRoles?: string[];
}

export interface UserWithRolesResponse {
  id?: string;
  name?: string;
  lastname?: string;
  email?: string;
  active?: boolean;
  roles?: Role[];
  effectivePermissions?: EffectivePermissionResponse[];
  empresaId?: string;
  empresaNombre?: string;
}

export interface UserRoleChangeResponse {
  message?: string;
  userRoleId?: string;
  userId?: string;
  roleId?: string;
  roleName?: string;
}
