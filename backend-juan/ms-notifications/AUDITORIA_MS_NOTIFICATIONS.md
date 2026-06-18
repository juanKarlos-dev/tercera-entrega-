# Auditoría ms-notifications
**Fecha:** 2026-05-21  
**Auditor:** Claude Code (análisis estático completo)  
**Archivo analizado:** `main.py` (48 líneas) + `requeriments.txt` + `.gitignore`

---

## Resultado General

> ### ⚠️ APTO CON CONDICIONES — 68 / 100
>
> El microservicio cumple su función: enviar emails via Gmail API de forma correcta. El código es limpio, cohesivo y simple. Sin embargo, el endpoint crítico que envía emails está **completamente sin proteger**: cualquier proceso en la red (o en el host) puede enviar correos desde la cuenta del remitente sin presentar ninguna credencial. Para un entorno de producción o entrega académica esto debe corregirse.

---

## Funcionalidad

| Criterio | Estado | Detalle |
|---|---|---|
| `POST /send-email` existe y acepta `{ to, subject, body, html }` | ✅ | `EmailRequest` Pydantic model con los 4 campos. `html` es opcional, default `False`. |
| `GET /health` existe | ✅ | Retorna `{"status": "ok"}` en línea 46-47. |
| Envío usa Gmail API con `token.pickle` (no SMTP) | ✅ | `get_service()` carga credenciales via `pickle.load`, auto-refresca el token si expiró, construye cliente con `build('gmail', 'v1', ...)`. |
| Soporte texto plano | ✅ | `html=False` → `MIMEText(req.body)` con content-type `text/plain` por defecto. |
| Soporte HTML | ⚠️ Parcial | `html=True` → `MIMEMultipart("alternative")` con un único part `text/html`. Falta el **fallback `text/plain`**; los clientes de email que no renderizan HTML reciben un mensaje vacío. |
| Remitente hardcodeado como constante `SENDER` | ✅ | Línea 13: `SENDER = "juan.alegria22503@ucaldas.edu.co"`. |
| Ruta del token usa `os.path.join` relativo al directorio padre | ✅ | Línea 22: `os.path.join(os.path.dirname(__file__), '..', 'confidencial', 'token.pickle')` → resuelve a `backend-juan/confidencial/token.pickle`. |

### Detalle del problema con email HTML (líneas 33-35)

```python
# Actual — solo tiene la parte HTML, sin fallback de texto plano
msg = MIMEMultipart("alternative") if req.html else MIMEText(req.body)
if req.html:
    msg.attach(MIMEText(req.body, "html"))

# Correcto — debería incluir ambas partes
if req.html:
    msg = MIMEMultipart("alternative")
    msg.attach(MIMEText(req.body, "plain"))   # fallback
    msg.attach(MIMEText(req.body, "html"))    # parte principal
```

---

## Problemas de seguridad y configuración

### [CRÍTICO] Sin autenticación en el endpoint

**Archivo:** `main.py:11, 29`

```python
# No hay ningún middleware de autenticación
@app.post("/send-email")
def send_email(req: EmailRequest):
    ...
```

Cualquier proceso que conozca el host y puerto puede llamar a `POST /send-email` y enviar correos desde la cuenta Gmail del remitente. En el contexto del sistema esto significa que:
- Un atacante en la misma red puede enviar correos masivos (spam) suplantando el sistema.
- No se puede auditar quién envió qué correo.
- El endpoint puede usarse para phishing usando una dirección institucional.

**Solución:** Agregar validación de `X-API-Key` header con una clave almacenada en variable de entorno:
```python
from fastapi import Header, HTTPException
import os

def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != os.environ.get("NOTIFICATIONS_API_KEY"):
        raise HTTPException(status_code=401, detail="API Key inválida")
```

---

### [ALTO] CORS completamente abierto

**Archivo:** `main.py:11`

```python
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
```

Para un microservicio interno que solo recibe llamadas de `ms-logica-negocio` (NestJS en `localhost:3001`), abrir CORS a todos los orígenes no tiene justificación técnica. Aunque el CORS no protege APIs llamadas por el backend (es una protección del navegador), usar `*` en un servicio que envía emails desde una cuenta institucional expone el endpoint a peticiones desde cualquier origen web.

**Solución:**
```python
allow_origins=["http://localhost:3001", "http://localhost:3000"]
```

---

### [ALTO] `token.pickle` accesible fuera del repositorio pero en carpeta compartida

**Evidencia:** El archivo `backend-juan/confidencial/token.pickle` existe en disco. El `.gitignore` del repo (`confidencial/*`) ignora correctamente una carpeta `confidencial/` dentro de `ms-notifications/`, **pero la carpeta real está un nivel arriba** (`backend-juan/confidencial/`) — fuera del alcance del gitignore de este repo.

Riesgo real:
- Si la carpeta `backend-juan/` está bajo otro repositorio git o se comparte (Drive, GitHub), `token.pickle` podría exponerse.
- `token.pickle` contiene credenciales OAuth2 que dan acceso completo a la cuenta Gmail de `juan.alegria22503@ucaldas.edu.co` (scope `gmail.send` o posiblemente mayor según cómo se generó).
- Adicionalmente, se encontró un segundo `token.pickle` en `backend-juan/token.pickle` (raíz del directorio padre) que no está protegido por ningún `.gitignore`.

**Estado del gitignore:** El `.gitignore` actual solo dice:
```
venv
.idea
confidencial/*
```
Protege una carpeta `ms-notifications/confidencial/` que no existe. No protege el archivo real en `../confidencial/token.pickle` ni el archivo `../token.pickle`.

---

### [ALTO] Uso de `pickle` para deserializar credenciales

**Archivo:** `main.py:24`

```python
creds = pickle.load(f)
```

`pickle` en Python puede ejecutar código arbitrario durante la deserialización si el archivo ha sido modificado maliciosamente. Si un atacante con acceso al sistema de archivos reemplaza `token.pickle`, puede lograr ejecución de código en el proceso del servidor. Para credenciales de seguridad, lo recomendable es usar el formato JSON nativo de Google (`google.oauth2.credentials.Credentials.from_authorized_user_file`) con `credentials.json`.

---

### [MEDIO] Remitente (`SENDER`) hardcodeado en código fuente

**Archivo:** `main.py:13`

```python
SENDER = "juan.alegria22503@ucaldas.edu.co"
```

Una dirección de correo personal/institucional hardcodeada en el código fuente:
1. Se filtra a cualquier repositorio git.
2. No puede cambiarse sin modificar el código.

**Solución:** `SENDER = os.environ.get("EMAIL_SENDER", "juan.alegria22503@ucaldas.edu.co")`

---

### [MEDIO] Sin rate limiting — riesgo de abuso como relay de spam

No hay limitación de frecuencia de envíos. Si el endpoint queda expuesto (aunque sea en una red local), un atacante puede hacer miles de peticiones en segundos, lo que podría resultar en que Gmail bloquee la cuenta por comportamiento inusual.

**Solución:** Agregar `slowapi` o un límite simple con un diccionario en memoria para el contexto académico.

---

### [MEDIO] Ruta del token frágil — dependiente de estructura de carpetas

**Archivo:** `main.py:22`

```python
token_path = os.path.join(os.path.dirname(__file__), '..', 'confidencial', 'token.pickle')
```

Esta ruta funciona solo si:
- El archivo se ejecuta desde `ms-notifications/`
- La carpeta `confidencial/` existe exactamente un nivel arriba

Si el servicio se ejecuta desde otro directorio de trabajo (`uvicorn ms_notifications.main:app`) o se dockeriza, la ruta falla con `FileNotFoundError` sin mensaje claro.

**Solución:** Usar variable de entorno: `TOKEN_PATH = os.environ.get("GMAIL_TOKEN_PATH", "confidencial/token.pickle")`

---

### [BAJO] Error handling genérico expone mensajes internos

**Archivo:** `main.py:42-43`

```python
except Exception as e:
    return {"ok": False, "error": str(e)}
```

Si `token.pickle` no existe, retorna algo como:
```json
{"ok": false, "error": "[Errno 2] No such file or directory: '...ruta completa.../token.pickle'"}
```

Esto expone la estructura de directorios del servidor. Para un servicio interno es aceptable, pero en producción debería loguear el error internamente y retornar un mensaje genérico.

---

### [BAJO] `Telethon==1.40.0` en `requeriments.txt` — dependencia sin usar

**Archivo:** `requeriments.txt:4`

```
Telethon==1.40.0
```

`Telethon` es una librería para la API de Telegram (~8 MB con dependencias). No aparece en ninguna línea de `main.py`. Es una dependencia muerta que:
- Aumenta el tiempo de instalación y el tamaño del entorno virtual.
- Aumenta la superficie de ataque (más paquetes = más CVEs potenciales).
- Confunde sobre las capacidades reales del servicio.

**Solución:** Eliminar la línea del archivo.

---

### [BAJO] Nombre del archivo con typo: `requeriments.txt`

El archivo se llama `requeriments.txt` (falta una `e`: debería ser `requirements.txt`). Esto hace que comandos estándar como `pip install -r requirements.txt` fallen, ya que el nombre no coincide con la convención.

---

## Análisis SOLID

### Evaluación general: ✅ Cohesivo para el tamaño del proyecto

Este microservicio tiene exactamente **48 líneas** y una única responsabilidad de dominio: enviar emails via Gmail. El análisis SOLID aplica con matices para proyectos de este tamaño.

---

#### `get_service()` — ¿Función auxiliar o clase `GmailService`?

**Veredicto: Aceptable como función auxiliar.**

```python
def get_service():
    token_path = os.path.join(os.path.dirname(__file__), '..', 'confidencial', 'token.pickle')
    with open(token_path, 'rb') as f:
        creds = pickle.load(f)
    if not creds.valid and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    return build('gmail', 'v1', credentials=creds)
```

Tiene una sola responsabilidad (construir el cliente Gmail) y no mezcla nada ajeno. Una clase `GmailService` con método `get_client()` estaría justificada si el proyecto creciera (manejar múltiples cuentas, cachear el cliente entre requests), pero para 48 líneas sería sobre-ingeniería.

**Problema real detectado:** `get_service()` crea un nuevo cliente Gmail en **cada petición**, lo que implica deserializar el pickle, potencialmente hacer un refresh HTTP, y construir el cliente. Con `cachetools` o una variable global, podría reutilizarse.

---

#### `EmailRequest` — Correcto como DTO ✅

```python
class EmailRequest(BaseModel):
    to: str
    subject: str
    body: str
    html: bool = False
```

Correctamente definido como modelo Pydantic separado. Valida tipos automáticamente. Sin lógica de negocio mezclada. El único punto de mejora sería añadir validaciones adicionales:
- `@validator('to')` para verificar formato de email.
- `@validator('body')` para evitar body vacío.

---

#### `send_email()` — ¿Mezcla construcción y envío?

**Veredicto: Aceptable dado el tamaño. Sin violación SRP real.**

```python
@app.post("/send-email")
def send_email(req: EmailRequest):
    service = get_service()
    msg = MIMEMultipart("alternative") if req.html else MIMEText(req.body)
    if req.html:
        msg.attach(MIMEText(req.body, "html"))
    msg['to'] = req.to
    ...
    service.users().messages().send(userId='me', body={'raw': raw}).execute()
    return {"ok": True}
```

Sí mezcla construcción del mensaje MIME y envío al API de Gmail, pero dado que el método completo tiene 12 líneas, separarlo en `_build_message()` y `_send_message()` sería válido pero no urgente. Si el proyecto creciera con soporte para adjuntos, plantillas, múltiples destinatarios, etc., esa separación se volvería necesaria.

---

## Cambios recomendados (ordenados por prioridad)

1. **[CRÍTICO] Agregar validación de `X-API-Key`** — Añadir dependencia FastAPI que valide un header `X-API-Key` contra `os.environ["NOTIFICATIONS_API_KEY"]`. Actualizar `ms-logica-negocio` para enviar esa key en las peticiones.

2. **[ALTO] Agregar variable de entorno `NOTIFICATIONS_API_KEY` en `.env` de ms-logica y ms-notifications** — La key ya fue añadida en el `.env` de ms-logica como preparación (ver `CAMBIOS_APLICADOS.md`).

3. **[ALTO] Verificar y proteger `token.pickle`** — Confirmar que `backend-juan/confidencial/token.pickle` y `backend-juan/token.pickle` no están en ningún repositorio git rastreable. Añadir `*.pickle` y `token.pickle` al `.gitignore` con cobertura más amplia.

4. **[ALTO] Restringir CORS** — Cambiar `allow_origins=["*"]` a `allow_origins=["http://localhost:3001"]` en `main.py:11`.

5. **[MEDIO] Mover `SENDER` a variable de entorno** — `SENDER = os.environ.get("EMAIL_SENDER")` con validación al inicio. Agregar `EMAIL_SENDER=juan.alegria22503@ucaldas.edu.co` a un archivo `.env`.

6. **[MEDIO] Corregir el email HTML para incluir fallback `text/plain`** — Añadir `msg.attach(MIMEText(req.body, "plain"))` antes del part HTML en `send_email()`.

7. **[MEDIO] Mover ruta del token a variable de entorno** — `TOKEN_PATH = os.environ.get("GMAIL_TOKEN_PATH")` para que el servicio sea portable y dockerizable.

8. **[BAJO] Eliminar `Telethon==1.40.0` de `requeriments.txt`** — Una línea, sin impacto en funcionalidad.

9. **[BAJO] Renombrar `requeriments.txt` → `requirements.txt`** — Corrige el typo y permite usar comandos estándar de pip.

10. **[BAJO] Cachear el cliente Gmail entre requests** — Evitar recrear el cliente en cada petición usando una variable de módulo o un singleton.

---

## Resumen de puntuación

| Criterio | Peso | Puntaje | Nota |
|---|---|---|---|
| Funcionalidad correcta | 35 pts | 30/35 | Funciona bien; falta fallback text/plain en HTML |
| Seguridad | 40 pts | 18/40 | Sin autenticación, CORS abierto, pickle sin validación |
| Calidad del código (SOLID, legibilidad) | 15 pts | 13/15 | Código limpio y cohesivo para su tamaño |
| Configuración (env vars, dependencias) | 10 pts | 7/10 | SENDER hardcodeado, Telethon innecesario, typo en requirements |
| **TOTAL** | **100 pts** | **68/100** | |
