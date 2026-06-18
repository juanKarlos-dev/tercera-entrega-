export const environment = {
  production: false,
  /** Backend ms-security (Spring Boot) */
  apiUrl: 'http://localhost:8383/api',
  /** Backend ms-logica-negocio (NestJS) */
  apiUrlLogica: 'http://localhost:3001/api/v1',
  /** URL base del servidor NestJS para archivos estáticos (fotos, etc.) */
  serverUrl: 'http://localhost:3001',
  /**
   * Clave pública reCAPTCHA v3 (debe coincidir con recaptcha.site-key del backend).
   * Si queda vacía, el login/registro/recuperación mostrarán aviso y no podrán enviar token válido.
   */
  recaptchaSiteKey: '6Ldvp5EsAAAAAKZwizt0IvHq36UErlrxnITP0cqb',
  /** URL del frontend de operaciones (conductores y admins empresa) */
  operationsAppUrl: 'http://localhost:4201',
};
