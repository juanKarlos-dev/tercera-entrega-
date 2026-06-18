import base64, pickle, os

# Manual fallback para cargar .env si existe
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(BASE_DIR, '.env')
if os.path.exists(env_path):
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                key, val = line.split('=', 1)
                os.environ.setdefault(key.strip(), val.strip())

from datetime import datetime, timedelta
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build

app = FastAPI()

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    body = await request.body()
    print(f"422 Validation Error: {exc.errors()}")
    print(f"Received body: {body.decode('utf-8', errors='ignore')}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": body.decode('utf-8', errors='ignore')},
    )

_cors_raw = os.environ.get("CORS_ORIGINS", "http://localhost:3001")
_cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

SENDER = os.environ.get("EMAIL_SENDER", "juan.alegria22503@ucaldas.edu.co")


class EmailRequest(BaseModel):
    to: str
    subject: str
    body: str
    html: bool = False


class BusProximoRequest(BaseModel):
    to: str
    rutaNombre: str
    paraderoNombre: str
    tiempoMinutos: int
    placaBus: str


def _verify_api_key(x_api_key: str = Header(default=None)):
    expected = os.environ.get("NOTIFICATIONS_API_KEY")
    if not expected or x_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def get_service():
    token_path = os.environ.get("GMAIL_TOKEN_PATH") or os.path.join(
        BASE_DIR, '..', 'confidencial', 'token.pickle'
    )
    with open(token_path, 'rb') as f:
        creds = pickle.load(f)
    if not creds.valid and creds.expired and creds.refresh_token:
        creds.refresh(GoogleRequest())
    return build('gmail', 'v1', credentials=creds)


def _do_send(to: str, subject: str, body: str, html: bool = False) -> dict:
    try:
        service = get_service()
        if html:
            msg = MIMEMultipart("alternative")
            msg.attach(MIMEText(body, "plain"))
            msg.attach(MIMEText(body, "html"))
        else:
            msg = MIMEText(body)
        msg['to'] = to
        msg['from'] = SENDER
        msg['subject'] = subject
        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        service.users().messages().send(userId='me', body={'raw': raw}).execute()
        return {"ok": True}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/send-email", dependencies=[Depends(_verify_api_key)])
def send_email(req: EmailRequest):
    return _do_send(req.to, req.subject, req.body, req.html)


@app.post("/notificar-bus-proximo", dependencies=[Depends(_verify_api_key)])
def notificar_bus_proximo(req: BusProximoRequest):
    hora_llegada = (datetime.now() + timedelta(minutes=req.tiempoMinutos)).strftime("%H:%M")
    subject = f"🚌 Tu bus se acerca — {req.rutaNombre}"
    body = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#1976d2">🚌 Tu bus está a punto de llegar</h2>
      <p>Hola, te avisamos porque tu bus se acerca al paradero que indicaste.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr>
          <td style="padding:8px;font-weight:bold;color:#374151">Ruta:</td>
          <td style="padding:8px">{req.rutaNombre}</td>
        </tr>
        <tr style="background:#f9fafb">
          <td style="padding:8px;font-weight:bold;color:#374151">Paradero:</td>
          <td style="padding:8px">{req.paraderoNombre}</td>
        </tr>
        <tr>
          <td style="padding:8px;font-weight:bold;color:#374151">Bus:</td>
          <td style="padding:8px">{req.placaBus}</td>
        </tr>
        <tr style="background:#f9fafb">
          <td style="padding:8px;font-weight:bold;color:#374151">Tiempo estimado:</td>
          <td style="padding:8px"><strong style="color:#16a34a">{req.tiempoMinutos} minutos</strong></td>
        </tr>
        <tr>
          <td style="padding:8px;font-weight:bold;color:#374151">Hora de llegada:</td>
          <td style="padding:8px">Aprox. a las <strong>{hora_llegada}</strong></td>
        </tr>
      </table>
      <p style="color:#6b7280;font-size:13px">
        Por favor dirígete al paradero con tiempo. Esta alerta se envía una única vez.
      </p>
    </div>
    """
    return _do_send(req.to, subject, body, html=True)


@app.get("/health")
def health():
    return {"status": "ok"}
