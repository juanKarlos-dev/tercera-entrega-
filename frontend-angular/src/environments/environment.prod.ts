export const environment = {
  production: true,
  /** Backend ms-security (Spring Boot) — reemplaza con la URL real antes de desplegar */
  apiUrl: 'https://TU_DOMINIO_MS_SECURITY/api',
  /** Backend ms-logica-negocio (NestJS) — reemplaza con la URL real antes de desplegar */
  apiUrlLogica: 'https://TU_DOMINIO_MS_LOGICA/api/v1',
  /** URL base del servidor NestJS para archivos estáticos (fotos, etc.) */
  serverUrl: 'https://TU_DOMINIO_MS_LOGICA',
  /** Clave pública reCAPTCHA v3 de producción */
  recaptchaSiteKey: 'TU_CLAVE_PUBLICA_RECAPTCHA_PRODUCCION',
  /** URL del frontend de operaciones (conductores y admins empresa) */
  operationsAppUrl: 'https://TU_DOMINIO_FRONTEND_OPERACIONES',
};
