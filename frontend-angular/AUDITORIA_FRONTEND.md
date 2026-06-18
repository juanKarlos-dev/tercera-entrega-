# Auditoría Frontend Angular — TransporteYA

> Fecha: 2026-05-22  
> Auditor: análisis estático exhaustivo del código fuente  
> Versión Angular: 19 (standalone components, signals API)

---

## Resultado General

**APTO — 80 / 100**

El frontend está bien estructurado y cubre la gran mayoría de las historias de usuario de ambas entregas. La arquitectura Angular moderna (signals, standalone, lazy loading) es consistente. Los puntos que bajan la calificación son: un `environment.prod.ts` incompleto que rompería la segunda entrega en producción, nueve `console.log` de depuración sin eliminar, y dos URLs de desarrollo hardcodeadas fuera del archivo de entorno.

---

## HU Primera Entrega — Módulo de Seguridad

| HU | Descripción | Estado | Detalle |
|----|-------------|--------|---------|
| HU-ENTR-1-001 | Creación de roles del sistema | ✅ Completo | `role-list.component.ts` lista, crea y elimina roles. `assign-permissions-dialog` agrupa permisos por módulo con checkboxes. Los 5 roles predeterminados están en `protectedRoleNames` y se muestran protegidos contra eliminación. Confirmación nativa antes de borrar; bloqueo si hay usuarios asignados. |
| HU-ENTR-1-002 | Asignación de roles a usuarios | ✅ Completo | `user-admin.component.ts` lista usuarios con roles, busca por nombre/email (debounce 300 ms), abre `user-roles-dialog` para asignar múltiples roles. |
| HU-ENTR-1-003 | Gestión de permisos específicos por rol | ✅ Completo | `assign-permissions-dialog` usa `forkJoin` para agregar/quitar permisos en una sola operación; los cambios se reflejan sin recargar página gracias a signals. |
| HU-ENTR-1-004 | Autenticación con Google | ✅ Completo | Botón "Continuar con Google" con logo oficial de gstatic. Redirige a `/oauth2/authorization/google`. `oauth-success.component` recibe el token y autentica. |
| HU-ENTR-1-005 | Autenticación con Microsoft | ✅ Completo | Botón "Continuar con Microsoft" con logo SVG de Wikipedia. Mismo flujo OAuth. |
| HU-ENTR-1-006 | Autenticación con GitHub | ✅ Completo | Botón con SVG inline del logo GitHub. Flujo OAuth + componente `complete-github-email` para usuarios sin email público. |
| HU-ENTR-1-007 | Registro con email y contraseña | ✅ Completo | Formulario con nombre, apellido, email, contraseña, confirmación. Medidor de fortaleza visual (débil/media/fuerte con score 0-5). Validación de coincidencia de contraseñas. Errores del backend mostrados vía interceptor global. |
| HU-ENTR-1-008 | Inicio de sesión con email y contraseña | ⚠️ Parcial | Formulario correcto y redirección al dashboard. **Falta:** el método `handleLoginError` reenvía el mensaje literal del backend (`String(msg)`). Si el backend devuelve "Email no encontrado" o "Contraseña incorrecta" por separado, se revelaría cuál es incorrecto. El mensaje debería ser siempre genérico en el frontend, independientemente de la respuesta del servidor. |
| HU-ENTR-1-009 | Control de sesión | ✅ Completo | `jwt.interceptor.ts` añade el header `Authorization: Bearer`. `api-error.interceptor.ts` captura 401 → logout + mensaje "Sesión expirada". `auth.guard.ts` protege rutas privadas verificando `isAuthenticated()` y expiración del token. |
| HU-ENTR-1-010 | reCAPTCHA v3 en login | ✅ Completo | `recaptcha.service.ts` carga el script v3 y ejecuta `execute('login')`. Si no está configurado, muestra aviso visible al usuario. |
| HU-ENTR-1-011 | reCAPTCHA v3 en recuperación | ✅ Completo | `forgot-password.component.ts` llama `recaptcha.execute('forgot_password')` antes del submit. |
| HU-ENTR-1-012 | Verificación 2FA | ✅ Completo | 6 inputs individuales con navegación automática, validación `/^\d{6}$/`, cuenta regresiva mm:ss, contador de intentos restantes, botón de reenvío, cancelación con `sendBeacon` al backend. |
| HU-ENTR-1-013 | Recuperación de contraseña | ✅ Completo | `forgot-password.component` accesible desde login (enlace `routerLink="/forgot-password"`). Solo campo email. Respuesta genérica sin revelar existencia. `reset-password.component` recibe el token de la URL y valida coincidencia de contraseñas. |

**Subtotal primera entrega: 12/13 ✅ — 1 parcial**

---

## HU Segunda Entrega — Módulo de Negocio

| HU | Descripción | Estado | Detalle |
|----|-------------|--------|---------|
| HU-ENTR-2-001 | Consulta de rutas disponibles | ⚠️ Parcial | Listado con nombre, descripción y tarifa. Detalle de paraderos en orden secuencial. Tiempo estimado calculado con fórmula de Haversine. **Falta:** no existe campo de búsqueda/filtro por nombre de ruta en el componente (`rutas.component.ts` no tiene `searchControl` ni lógica de filtrado). La pantalla solo muestra el total de rutas sin opción de búsqueda. |
| HU-ENTR-2-002 | Búsqueda de paraderos cercanos | ✅ Completo | `paraderos.component.ts` tiene `buscarCercanos()` con geolocalización del navegador y `buscarPorNombre()`. Muestra en mapa con `MapPickerComponent`. |
| HU-ENTR-2-003 | Abordaje de bus | ⚠️ Parcial | `boletos.component.ts` tiene formulario de abordaje funcional. **Falta:** el formulario incluye `ciudadanoId, busId, paraderoAbordajeId, metodoPagoCiudadanoId`, pero la HU especifica seleccionar también **programación**. El campo `programacionId` no está en el formulario. |
| HU-ENTR-2-004 | Descenso de bus | ✅ Completo | Método `registrarDescenso()` con selección de ciudadano y paradero de descenso. |
| HU-ENTR-2-005 | Visualización de recorrido | ✅ Completo | `verRecorrido(b)` llama a `boletos.recorrido(id)` y muestra el detalle del viaje con paraderos y tiempos. |
| HU-ENTR-2-006 | Inicio de turno de conductor | ✅ Completo | `turnos.component.ts`: `abrirInicioTurno()` muestra panel con selector de estado del bus y `observacionesCierre` opcional. `confirmarInicio()` envía al backend. |
| HU-ENTR-2-007 | Reporte de incidentes | ✅ Completo | `incidentes.component.ts` tiene formulario con tipo, gravedad, descripción y captura GPS automática. Sube hasta 5 fotografías. |
| HU-ENTR-2-008 | Gestión de incidentes | ✅ Completo | `buscarPorBus()` filtra historial por bus. `guardarComentario()` permite cambiar estado y agregar comentario en una sola operación. Lightbox para visualizar fotografías. |
| HU-ENTR-2-009 | Creación de rutas con paraderos | ✅ Completo | Selección secuencial de paraderos con drag-and-drop (`DragDropModule`), recálculo automático de distancias Haversine y tiempo estimado al reordenar. Mínimo 3 paraderos validado. |
| HU-ENTR-2-010 | Registro de paraderos con GPS | ✅ Completo | `paraderos.component.ts` con `MapPickerComponent` para elegir coordenadas visualmente. Redondeo a 7 decimales. Tipos PARADERO / ESTACION / TERMINAL. |
| HU-ENTR-2-011 | Programaciones | ✅ Completo | `programaciones.component.ts`: crea con ruta, bus, fecha/hora. Tipos de recurrencia (NINGUNA, LUNES_A_VIERNES, FINES_DE_SEMANA, DIARIA). Flag `recurrente` automático según tipo. |
| HU-ENTR-2-012 | Registro de bus en flota | ✅ Completo | `buses.component.ts`: placa, modelo, año, capacidades (máxima, sentados, parados), estado. `BusQrDialogComponent` genera QR con librería `qrcode` y permite descargarlo. |
| HU-ENTR-2-013 | Recarga ePayco | ✅ Completo | `metodos-pago.component.ts` con montos predefinidos (`[10000, 20000, 50000, 100000]`). Integración completa con widget ePayco, MutationObserver para detectar cierre, postMessage listener y webhook de confirmación. |
| HU-ENTR-2-014 | Reporte ingresos por método de pago | ✅ Completo | `reportes.component.ts` con Chart.js tipo `bar`, eje de total y porcentaje. |
| HU-ENTR-2-015 | Reporte distribución etaria | ⚠️ Parcial | Implementado y funcional. **Observación menor:** la HU especifica "gráfico de torta" pero se usa `doughnut` (dona). Funcionalmente equivalente pero no es exactamente un `pie`. |
| HU-ENTR-2-016 | Reporte tendencia de incidentes | ✅ Completo | Chart.js tipo `line` con fill y tension, datos por fecha/mes. |

**Subtotal segunda entrega: 13/16 ✅ — 3 parciales**

---

## Arquitectura y conexión con backends

| Verificación | Estado | Detalle |
|---|---|---|
| `environment.ts` define URLs de ambos backends | ✅ | `apiUrl: 'http://localhost:8383/api'` y `apiUrlLogica: 'http://localhost:3001/api/v1'` correctamente definidos. |
| JWT interceptor agrega token a ambos backends | ✅ | `jwt.interceptor.ts` añade `Authorization: Bearer` a todas las peticiones autenticadas. Para peticiones a `localhost:3001` agrega además `x-empresa-id` y `x-conductor-id` del contexto. |
| Servicios separados por dominio | ✅ | Separación correcta: `security-api.service`, `users-api.service`, `roles-api.service`, `permissions-api.service`, `user-role-api.service` (ms-security); `buses.service`, `rutas.service`, `paraderos.service`, `turnos.service`, `programaciones.service`, `boletos.service`, `incidentes.service`, `ciudadanos.service`, `metodos-pago.service`, `reportes.service`, `empresas.service`, `conductores.service` (ms-logica). |
| Interceptor maneja 401 y 403 | ✅ | `api-error.interceptor.ts`: 401 → `auth.logout(true)` + notificación "Sesión expirada". 403 → notificación + navega a `/forbidden`. 0 (sin conexión) → aviso de servidor caído. |
| `auth.guard.ts` verifica token | ✅ | Comprueba `auth.isAuthenticated()` que internamente valida estructura JWT, claim `exp` y expiración. Si el token es inválido pero existe, hace logout. |
| `module-access.guard.ts` verifica permisos | ✅ | Dos guards: `canActivateModule` (verifica effective-permissions por módulo) y `canActivateRole` (verifica por nombre de rol desde JWT). Estrategia permisiva mientras hidrata para no bloquear navegación. |
| `permission.service.ts` almacena y verifica permisos | ✅ | Caché en localStorage con invalidación por `userId`. Métodos `hasPermission`, `hasModuleAccess`, `hasPermissionForModelAction`, `canCall`. Lógica de wildcard (`?` = un segmento de ruta). |

**Subtotal arquitectura: 7/7 ✅**

---

## Calidad del código

### Componentes grandes (> 300 líneas)

| Archivo | Líneas | Problema |
|---|---|---|
| `src/app/features/auth/two-factor/two-factor.component.ts` | **348** | Mezcla lógica de temporizador, manipulación directa del DOM (múltiples `document.querySelector`), HTTP y gestión de estado 2FA. Debería separar la lógica del input de 6 dígitos en un componente o directiva independiente. |
| `src/app/features/metodos-pago/metodos-pago.component.ts` | **295** | Contiene lógica de integración ePayco (MutationObserver, postMessage, sendBeacon) mezclada con lógica de formularios. La integración ePayco podría extraerse a un servicio `EpaycoService`. |

### Lógica en templates

Los templates son mayormente limpios. Se usan señales (`signal`, `computed`) correctamente. No se detectó lógica compleja en `.html` que deba moverse a pipes.

### Servicios con múltiples responsabilidades

| Archivo | Observación |
|---|---|
| `src/app/core/services/auth.service.ts` | Mezcla gestión de token (localStorage), decodificación JWT, bootstrapping de sesión (carga de permisos y nombres de rol) y navegación post-login. Aceptable para el tamaño del proyecto, pero podría separarse el bootstrapping en un `SessionService`. |

### console.log de depuración — **ACCIÓN REQUERIDA**

| Archivo | Línea | Contenido |
|---|---|---|
| `src/app/features/metodos-pago/metodos-pago.component.ts` | 88 | `console.log('Email JWT:', email)` |
| `src/app/features/metodos-pago/metodos-pago.component.ts` | 89 | `console.log('Ciudadanos disponibles:', d)` — expone lista completa de ciudadanos en consola |
| `src/app/layout/components/sidebar/sidebar.component.ts` | 48 | `console.log('JWT payload completo:', payload)` — expone el payload JWT completo |
| `src/app/layout/components/sidebar/sidebar.component.ts` | 49 | `console.log('empresaId del JWT:', payload?.empresaId)` |
| `src/app/layout/components/sidebar/sidebar.component.ts` | 50 | `console.log('empresaNombre del JWT:', payload?.empresaNombre)` |
| `src/app/layout/components/sidebar/sidebar.component.ts` | 51 | `console.log('esAdminEmpresa (signal):', this.esAdminEmpresa())` |
| `src/app/layout/components/sidebar/sidebar.component.ts` | 52 | `console.log('roleDisplayNames:', this.auth.roleDisplayNames())` |
| `src/app/layout/components/sidebar/sidebar.component.ts` | 60 | `console.log('esAdmin (combinado):', esAdmin)` |
| `src/app/layout/components/sidebar/sidebar.component.ts` | 66 | `console.log('Intentando setEmpresa con:', ...)` |
| `src/app/layout/components/sidebar/sidebar.component.ts` | 84 | `console.log('Empresa activa al cargar conductores:', empresaId)` |
| `src/app/layout/components/sidebar/sidebar.component.ts` | 87 | `console.log('Conductores cargados:', c)` |

**Total: 11 console.log a eliminar antes de la entrega.**

### Manejo de suscripciones a observables

| Componente | Estado |
|---|---|
| `user-admin.component.ts` | ✅ Usa `Subject<void>` + `takeUntil` en `ngOnDestroy` |
| `reportes.component.ts` | ✅ `ngOnDestroy` destruye los tres gráficos Chart.js |
| `metodos-pago.component.ts` | ✅ `ngOnDestroy` desconecta MutationObserver y postMessage listener |
| `rutas.component.ts`, `buses.component.ts`, `turnos.component.ts`, `boletos.component.ts`, `incidentes.component.ts`, `paraderos.component.ts`, `programaciones.component.ts` | ⚠️ Suscriben a observables HTTP sin `takeUntilDestroyed` ni `ngOnDestroy`. Para observables HTTP que completan solos no es crítico, pero si el usuario navega antes de que complete la respuesta podría intentar mutar una señal de un componente destruido. Recomendable añadir `takeUntilDestroyed()` o el patrón Subject. |

### URLs hardcodeadas

| Archivo | Línea | URL | Problema |
|---|---|---|---|
| `src/app/core/services/auth.service.ts` | 183 | `http://localhost:4201` | URL del segundo frontend (operaciones) hardcodeada. Debería estar en `environment.ts` como `operationsUrl`. |
| `src/app/core/interceptors/jwt.interceptor.ts` | 55 | `localhost:3001` | El host del backend de lógica está hardcodeado en el interceptor para decidir si añadir headers de contexto. Debería derivarse de `environment.apiUrlLogica`. |

---

## Problemas de configuración

### 1. `environment.prod.ts` — CRÍTICO

```typescript
// Estado actual (INCOMPLETO):
export const environment = {
  production: true,
  apiUrl: 'http://localhost:8383/api',  // Sigue apuntando a localhost
  recaptchaSiteKey: '',                  // reCAPTCHA desactivado en producción
  // FALTAN: apiUrlLogica, serverUrl
};
```

**Impacto:** Toda la segunda entrega (buses, rutas, paraderos, turnos, programaciones, boletos, incidentes, ciudadanos, métodos de pago, reportes) fallaría en producción porque `environment.apiUrlLogica` sería `undefined`. Las imágenes de buses tampoco cargarían (`serverUrl` ausente).

**Corrección requerida:**
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.tudominio.com/api',           // URL real de ms-security
  apiUrlLogica: 'https://api.tudominio.com/api/v1',  // URL real de ms-logica
  serverUrl: 'https://api.tudominio.com',
  recaptchaSiteKey: 'CLAVE_PUBLICA_RECAPTCHA_PROD',
};
```

### 2. URL de segundo frontend hardcodeada

`auth.service.ts:183` contiene `http://localhost:4201` para redirigir conductores y admins de empresa. En producción, esta URL debe ser configurable vía entorno.

### 3. Clave reCAPTCHA en environment.ts

`recaptchaSiteKey: '6Ldvp5EsAAAAAKZwizt0IvHq36UErlrxnITP0cqb'` es la clave **pública** del site y es seguro que esté en el frontend (es visible en el HTML de cualquier forma). Sin embargo, la clave en `environment.prod.ts` está vacía (`''`), lo que deshabilita reCAPTCHA en producción. Debe configurarse la clave de producción.

### 4. Webhook de ePayco con URL dinámica

`metodos-pago.component.ts:259`: `confirmation: \`${window.location.origin}/api/v1/metodos-pago/webhook-epayco\`` usa `window.location.origin` para construir la URL del webhook que ePayco debe llamar. Esto es correcto para desarrollo pero en producción `window.location.origin` sería el dominio del frontend, no del backend. El webhook debe apuntar directamente al backend.

### 5. Interceptor de contexto con host hardcodeado

`jwt.interceptor.ts:55`: La comprobación `req.url.includes('localhost:3001')` para añadir los headers `x-empresa-id` y `x-conductor-id` fallará en producción cuando el backend esté en otro host.

---

## Cambios recomendados (ordenados por prioridad)

1. **[CRÍTICO] Completar `environment.prod.ts`** con `apiUrlLogica`, `serverUrl` apuntando a las URLs reales de producción, y la clave de reCAPTCHA de producción. Sin esto la segunda entrega no funciona en producción.

2. **[CRÍTICO] Eliminar los 11 `console.log`** en `metodos-pago.component.ts` y `sidebar.component.ts`. El log de `sidebar.component.ts:48` expone el payload JWT completo (incluye claims sensibles); el de línea 89 expone la lista de ciudadanos.

3. **[ALTO] Corregir el interceptor JWT** para derivar el host del backend de `environment.apiUrlLogica` en lugar de hardcodear `localhost:3001`. Ejemplo:
   ```typescript
   import { environment } from '../../../environments/environment';
   // ...
   if (req.url.startsWith(environment.apiUrlLogica?.replace('/api/v1', '') ?? '')) { ... }
   ```

4. **[ALTO] Mover la URL del segundo frontend a environment.ts**:
   ```typescript
   // environment.ts
   operationsAppUrl: 'http://localhost:4201',
   // environment.prod.ts
   operationsAppUrl: 'https://operaciones.tudominio.com',
   ```
   Y en `auth.service.ts`: `window.location.href = environment.operationsAppUrl`.

5. **[ALTO] Corregir el mensaje de error del login (HU-ENTR-1-008)** para que sea siempre genérico en el frontend. Actualmente `handleLoginError` muestra el mensaje literal del backend. Cambiar a:
   ```typescript
   this.notify.error('Credenciales incorrectas. Verifica tu email y contraseña.');
   ```

6. **[MEDIO] Añadir filtro por nombre a `rutas.component` (HU-ENTR-2-001)** para completar el requerimiento. Un `FormControl` de búsqueda con `computed` similar al de `role-list.component` sería suficiente.

7. **[MEDIO] Añadir campo `programacionId` al formulario de abordaje (HU-ENTR-2-003)**. El formulario en `boletos.component.ts` omite la programación activa, que según la HU debe seleccionarse al abordar.

8. **[MEDIO] Cambiar el gráfico de distribución etaria de `doughnut` a `pie`** en `reportes.component.ts` para cumplir literalmente con la HU-ENTR-2-015 ("gráfico de torta"). Cambio de una línea: `type: 'pie'`.

9. **[BAJO] Añadir `takeUntilDestroyed()` a las suscripciones HTTP en** `rutas.component`, `buses.component`, `turnos.component`, `boletos.component`, `incidentes.component`, `paraderos.component` y `programaciones.component`. Previene posibles errores "Cannot set properties of undefined" en navegaciones rápidas.

10. **[BAJO] Extraer la lógica de integración ePayco** de `metodos-pago.component.ts` a un servicio `EpaycoService` para reducir el componente a <200 líneas y facilitar el testing de la integración de pagos de forma independiente.

11. **[BAJO] Extraer el input de 6 dígitos 2FA** de `two-factor.component.ts` a un componente `CodeInputComponent` reutilizable. Actualmente el componente usa `document.querySelector('.code-input')` directamente en lugar de `@ViewChildren` o `ElementRef`, lo que acopla la lógica al DOM.

---

## Resumen ejecutivo por área

| Área | Puntos posibles | Puntos obtenidos | Nota |
|---|---|---|---|
| HU Primera Entrega (13 HUs) | 30 | 27 | 1 HU parcial (mensaje login) |
| HU Segunda Entrega (16 HUs) | 30 | 24 | 3 HUs parciales (filtro rutas, programación en abordaje, torta vs dona) |
| Arquitectura y backends | 20 | 18 | Interceptor con host hardcodeado |
| Calidad del código | 10 | 5 | 11 console.log, URLs hardcodeadas, suscripciones sin cleanup |
| Configuración | 10 | 6 | environment.prod.ts crítico incompleto |
| **TOTAL** | **100** | **80** | **APTO** |
