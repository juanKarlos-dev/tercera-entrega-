export interface JwtPayload {
  id?: string;
  name?: string;
  email?: string;
  /** Login de GitHub u otro proveedor cuando aplica */
  username?: string;
  /** Claim legacy: un solo rol principal */
  role?: string;
  /** Claim actual: lista de roles del usuario */
  roles?: string[];
  empresaId?: string;
  empresaNombre?: string;
  sub?: string;
  exp?: number;
  iat?: number;
}
