import { Permission } from '../models/api.models';

export const TECHNICAL_MODELS = new Set([
  'Session',
  'UserProfile',
  'UserSession',
  'OAuthAccount',
  'OAuthProfile',
  'SecurityValidation',
  'RolePermission',
  'UserRole',
  'Profile',
  'Perfil',
  'Validación de seguridad',
]);

export const MODULE_TRANSLATIONS: Record<string, string> = {
  Route: 'Rutas',
  Ruta: 'Rutas',
  Routes: 'Rutas',
  Rutas: 'Rutas',
  Schedule: 'Programaciones',
  Schedules: 'Programaciones',
  Programacion: 'Programaciones',
  Programaciones: 'Programaciones',
  Incident: 'Incidentes',
  Incidente: 'Incidentes',
  Incidents: 'Incidentes',
  Incidentes: 'Incidentes',
  Report: 'Reportes',
  Reporte: 'Reportes',
  Reports: 'Reportes',
  Reportes: 'Reportes',
  Informe: 'Reportes',
  Informes: 'Reportes',
  MassMessage: 'Mensajes masivos',
  MassMessages: 'Mensajes masivos',
  MensajeMasivo: 'Mensajes masivos',
  MensajesMasivos: 'Mensajes masivos',
  'Mensajería Masiva': 'Mensajes masivos',
  User: 'Usuarios',
  Role: 'Roles',
  Permission: 'Permisos',
  Bus: 'Buses',
  Buses: 'Buses',
};

/** Orden estable para vista matriz funcional */
export const MATRIX_MODULES_ORDER = [
  'Usuarios',
  'Roles',
  'Permisos',
  'Buses',
  'Rutas',
  'Programaciones',
  'Reportes',
  'Incidentes',
  'Mensajes masivos',
] as const;

export function normalizeModuleKey(model?: string): string {
  const raw = (model || 'General').trim();
  return MODULE_TRANSLATIONS[raw] || raw;
}

/**
 * Agrupa etiqueta amigable; no muestra PATCH como texto principal.
 */
export function friendlyPermissionLabel(perm: Permission, moduleHint?: string): string {
  const method = (perm.method || '').toUpperCase();
  const url = perm.url || '';
  const moduleName = normalizeModuleKey(moduleHint || perm.model);
  const singular = moduleName.endsWith('s') ? moduleName.slice(0, -1) : moduleName;

  if (method === 'GET') {
    // es detalle si la URL termina en /{id} o /?
    if (url.match(/\/(\{[^}]+\}|\?)$/)) {
      return `Consultar ${singular.toLowerCase()}`;
    }
    return `Listar y buscar ${moduleName.toLowerCase()}`;
  }
  if (method === 'POST') {
    return `Crear ${singular.toLowerCase()}`;
  }
  if (method === 'PUT' || method === 'PATCH') {
    return `Actualizar ${singular.toLowerCase()}`;
  }
  if (method === 'DELETE') {
    return `Eliminar ${singular.toLowerCase()}`;
  }

  return perm.method || '';
}
