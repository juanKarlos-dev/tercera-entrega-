// Sub-objeto persona (usado en Conductor y Ciudadano)
export interface PersonaData {
  nombres?: string;
  apellidos?: string;
  tipoDocumento?: string;
  numeroDocumento?: string;
  email?: string;
}

// ────────── Empresas ──────────
export interface Empresa {
  id?: number;
  nombre?: string;
  nit?: string;
}

// ────────── Buses ──────────
export interface Bus {
  id?: number;
  placa?: string;
  modelo?: string;
  anio?: number;
  capacidadMaximaPasajeros?: number;
  capacidadSentados?: number;
  capacidadParados?: number;
  estado?: EstadoBus;
  fotoUrl?: string;
  codigo?: string;
  empresa?: Empresa;
  empresaId?: number;
}

export type EstadoBus = 'OPERATIVO' | 'MANTENIMIENTO' | 'FUERA_DE_SERVICIO';

// ────────── Conductores ──────────
export interface Conductor {
  id?: number;
  persona?: PersonaData;
  numeroLicencia?: string;
  fechaVencimientoLicencia?: string;
  email?: string;
  activo?: boolean;
  empresa?: Empresa;
  empresaId?: number;
}

// ────────── Paraderos ──────────
export interface Paradero {
  id?: number;
  nombre?: string;
  tipo?: string;
  latitud?: number;
  longitud?: number;
  descripcion?: string;
  activo?: boolean;
  distancia?: number;
}

// ────────── Rutas ──────────
export interface Ruta {
  id?: number;
  nombre?: string;
  descripcion?: string;
  tarifa?: number;
  activo?: boolean;
  paraderos?: ParaderoEnRuta[];
}

export interface ParaderoEnRuta {
  paraderoId?: number;
  nombre?: string;
  latitud?: number;
  longitud?: number;
  orden?: number;
  distanciaDesdeAnteriorMetros?: number;
  tiempoEstimadoDesdeAnteriorMinutos?: number;
}

export interface RutaMapa {
  rutaId?: number;
  nombre?: string;
  paraderos?: ParaderoEnRuta[];
}

// ────────── Turnos ──────────
export interface Turno {
  id?: number;
  fechaInicioProgramada?: string;
  fechaFinProgramada?: string;
  estado?: EstadoTurno;
  latitudInicio?: number;
  longitudInicio?: number;
  horaInicio?: string;
  bus?: Bus;
  busId?: number;
  conductor?: Conductor;
  conductorId?: number;
  ruta?: Ruta;
  rutaId?: number;
  empresa?: Empresa;
  empresaId?: number;
}

export type EstadoTurno = 'PENDIENTE' | 'EN_CURSO' | 'FINALIZADO' | 'CANCELADO';

// ────────── Programaciones ──────────
export interface Programacion {
  id?: number;
  fechaHoraSalida?: string;
  tipoRecurrencia?: string;
  recurrente?: boolean;
  margenToleranciaMinutos?: number;
  estado?: string;
  activo?: boolean;
  ruta?: Ruta;
  rutaId?: number;
  bus?: Bus;
  busId?: number;
  empresa?: Empresa;
  empresaId?: number;
}

// ────────── Boletos ──────────
export interface Boleto {
  id?: number;
  codigo?: string;
  estado?: EstadoBoleto;
  tarifaAplicada?: number;
  tarifaCobrada?: number;
  fechaHoraAbordaje?: string;
  fechaHoraDescenso?: string | null;
  tiempoViajeMinutos?: number | null;
  paraderoAbordaje?: Paradero;
  paraderoDescenso?: Paradero;
  ruta?: { id?: number; nombre?: string };
  bus?: { placa?: string };
  ciudadano?: Ciudadano;
  ciudadanoId?: number;
  turno?: Turno;
  turnoId?: number;
}

export type EstadoBoleto = 'ACTIVO' | 'COMPLETADO' | 'CANCELADO';

export interface AbordajeRequest {
  ciudadanoId: number;
  busId: number;
  paraderoAbordajeId: number;
  metodoPagoCiudadanoId: number;
}

export interface AbordajeResponse {
  message?: string;
  data?: {
    boleto?: { id?: number; codigo?: string; estado?: string; tarifaAplicada?: number; fechaHoraAbordaje?: string };
    ciudadano?: { id?: number };
    metodoPago?: { id?: number; codigo?: string; tipo?: string; saldoRestante?: number | null };
    paraderoAbordaje?: { id?: number; nombre?: string };
    ruta?: { id?: number; nombre?: string; tarifa?: number };
    bus?: { id?: number; placa?: string; pasajerosActivos?: number; cuposDisponibles?: number };
  };
}

export interface DescensoRequest {
  ciudadanoId: number;
  paraderoDescensoId: number;
}

export interface RecorridoBoleto {
  boleto?: { id?: number; codigo?: string; estado?: string; tarifaAplicada?: number; fechaHoraAbordaje?: string; fechaHoraDescenso?: string | null; tiempoTotalViajeMinutos?: number | null };
  ruta?: { id?: number; nombre?: string };
  bus?: { id?: number; placa?: string };
  conductor?: { id?: number; nombreCompleto?: string };
  paraderoAbordaje?: { id?: number; nombre?: string; latitud?: number; longitud?: number };
  paraderoDescenso?: { id?: number; nombre?: string; latitud?: number; longitud?: number } | null;
  mapaRuta?: Array<{
    orden?: number;
    distanciaDesdeAnteriorMetros?: number;
    tiempoEstimadoDesdeAnteriorMinutos?: number;
    esParaderoAbordaje?: boolean;
    esParaderoDescenso?: boolean;
    paradero?: { id?: number; nombre?: string };
  }>;
}

// ────────── Incidentes ──────────
export interface Incidente {
  id?: number;
  tipo?: TipoIncidente;
  gravedad?: string;
  descripcion?: string;
  tiempoEstimadoRetrasoMinutos?: number;
  latitud?: number;
  longitud?: number;
  estado?: EstadoIncidente;
  comentarioSeguimiento?: string;
  fotografias?: string[];
  fechaCreacion?: string;
  bus?: Bus;
  busId?: number;
  conductor?: Conductor;
  conductorId?: number;
  turno?: Turno;
  turnoId?: number;
}

export type TipoIncidente = 'ACCIDENTE' | 'MECANICO' | 'RETRASO' | 'SEGURIDAD' | 'OTRO';
export type EstadoIncidente = 'PENDIENTE' | 'EN_REVISION' | 'RESUELTO';

// ────────── Ciudadanos ──────────
export interface Ciudadano {
  id?: number;
  securityUserId?: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  fechaNacimiento?: string;
  activo?: boolean;
  alertaClima?: boolean;
  emailAlerta?: string;
  horarioViaje?: string;
  persona?: PersonaData;
  tipoDocumento?: string;
  numeroDocumento?: string;
  telefono?: string;
}

// ────────── Métodos de Pago ──────────
export interface MetodoPago {
  id?: number;
  codigo?: string;
  nombre?: string;
  tipo?: TipoMetodoPago;
  activo?: boolean;
}

export type TipoMetodoPago = 'TARJETA_PREPAGADA' | 'QR' | 'EFECTIVO';

export interface MetodoPagoCiudadano {
  id?: number;
  codigo?: string;
  saldo?: number;
  activo?: boolean;
  ciudadano?: { id?: number };
  metodoPago?: {
    id?: number;
    codigo?: string;
    nombre?: string;
    tipo?: TipoMetodoPago;
  };
}

export interface RecargaRequest {
  ciudadanoId: number;
  metodoPagoCiudadanoId: number;
  monto: number;
}

export interface RecargaResponse {
  referencia?: string;
  monto?: number;
  descripcion?: string;
  publicKey?: string;
  test?: string;
  saldoActual?: number;
  saldoDespuesDeRecarga?: number;
  email?: string;
  comisionEpayco?: string;
}

// ────────── Reportes ──────────
export interface ReporteIngresosPorMetodo {
  metodo?: string;
  total?: number;
  cantidad?: number;
}

export interface ReporteDistribucionEtaria {
  rango?: string;
  cantidad?: number;
  porcentaje?: number;
}

export interface ReporteTendenciaIncidentes {
  fecha?: string;
  total?: number;
  tipo?: string;
}
