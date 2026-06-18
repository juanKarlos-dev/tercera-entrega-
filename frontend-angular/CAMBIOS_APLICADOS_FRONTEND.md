# Cambios Aplicados — Frontend Angular

Fecha de aplicación: 2026-05-22  
Basado en: `AUDITORIA_FRONTEND.md`

---

## Archivos modificados

| # | Archivo | Cambio aplicado |
|---|---------|----------------|
| 1 | `src/environments/environment.prod.ts` | CAMBIO 1 — Se completaron todas las propiedades faltantes con valores descriptivos de placeholder |
| 2 | `src/environments/environment.ts` | CAMBIO 4 — Se agregó `operationsAppUrl: 'http://localhost:4201'` |
| 3 | `src/app/core/interceptors/jwt.interceptor.ts` | CAMBIO 3 — Se eliminó el host hardcodeado `'localhost:3001'`; ahora se deriva de `environment.apiUrlLogica` |
| 4 | `src/app/core/services/auth.service.ts` | CAMBIO 4 — Se reemplazó `'http://localhost:4201'` por `environment.operationsAppUrl` |
| 5 | `src/app/features/metodos-pago/metodos-pago.component.ts` | CAMBIO 2 — Se eliminaron 2 `console.log` (email del JWT y lista de ciudadanos) |
| 6 | `src/app/layout/components/sidebar/sidebar.component.ts` | CAMBIO 2 — Se eliminaron 9 `console.log` (payload JWT, empresaId, empresaNombre, flags de rol, conductores) |
| 7 | `src/app/features/auth/login/login.component.ts` | CAMBIO 5 — Mensaje de error genérico: `'Email o contraseña incorrectos.'` para cualquier HTTP 4xx |
| 8 | `src/app/features/rutas/rutas.component.ts` | CAMBIO 6 — Se agregó `searchControl: FormControl` y señal computada `rutasFiltradas` |
| 9 | `src/app/features/rutas/rutas.component.html` | CAMBIO 6 — Se agregó campo de búsqueda y se actualizó `dataSource` de la tabla a `rutasFiltradas()` |
| 10 | `src/app/core/models/negocio.models.ts` | CAMBIO 7 — Se agregó `programacionId?: number` (opcional) a `AbordajeRequest` |
| 11 | `src/app/features/boletos/boletos.component.ts` | CAMBIO 7 — Se agregó selector de programación con filtro por bus y envío condicional al backend |
| 12 | `src/app/features/boletos/boletos.component.html` | CAMBIO 7 — Se agregó `<mat-select>` de programación entre los campos de bus y paradero |
| 13 | `src/app/features/reportes/reportes.component.ts` | CAMBIO 8 — Se cambió `type: 'doughnut'` a `type: 'pie'` en `buildEtariaChart()` |

---

## Decisiones diferentes a lo indicado

### CAMBIO 7 — Filtrado de programaciones por bus

**Lo indicado:** Agregar campo `programacionId` al formulario de abordaje.

**Lo implementado:** Se cargaron todas las programaciones desde `ProgramacionesService.list()` y se filtran **en el cliente** según el `busId` seleccionado, excluyendo las de estado `'CANCELADA'`. El campo es **opcional** (sin `Validators.required`).

**Por qué:**  
- `ProgramacionesService` no expone un endpoint para filtrar por `busId`; solo dispone de `list()`. Agregar un nuevo endpoint en el frontend está fuera del alcance de este cambio.  
- El filtrado cliente es consistente con otros patrones ya existentes en el componente (p. ej., búsqueda del ciudadano propio por email dentro de la lista completa).  
- El campo se marcó como opcional porque el backend acepta abordajes sin `programacionId` (campo ya era `optional` en la interfaz anterior al cambio) y forzarlo como requerido rompería flujos de abordaje donde no hay programación activa para el bus seleccionado.

---

## Resultado del build

```
npm run build
```

**Estado: EXITOSO — sin errores TypeScript**

```
Application bundle generation complete. [~28 s]
```

### Advertencias preexistentes (no introducidas por estos cambios)

| Tipo | Detalle |
|------|---------|
| CSS budget | `login.component.scss` supera el límite de 4 kB |
| CSS budget | `two-factor.component.scss` supera el límite de 4 kB |
| CSS budget | `forgot-password.component.scss` supera el límite de 4 kB |
| CSS budget | `register.component.scss` supera el límite de 4 kB |
| CommonJS | `qrcode` — módulo CommonJS puede causar bundle más grande |
| CommonJS | `leaflet` — módulo CommonJS puede causar bundle más grande |

Ninguna advertencia fue introducida por los cambios aplicados. Los 13 archivos modificados compilaron sin errores ni advertencias nuevas.
