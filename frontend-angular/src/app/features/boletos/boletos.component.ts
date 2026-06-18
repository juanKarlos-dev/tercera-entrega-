import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { BoletosService } from '../../core/services/boletos.service';
import { BusesService } from '../../core/services/buses.service';
import { ParaderosService } from '../../core/services/paraderos.service';
import { CiudadanosService } from '../../core/services/ciudadanos.service';
import { MetodosPagoService } from '../../core/services/metodos-pago.service';
import { ProgramacionesService } from '../../core/services/programaciones.service';
import { TurnosService } from '../../core/services/turnos.service';
import { RutasService } from '../../core/services/rutas.service';
import { NotificationService } from '../../core/services/notification.service';
import { Boleto, AbordajeResponse, Bus, Paradero, Ciudadano, MetodoPagoCiudadano, RecorridoBoleto, Programacion, Turno, ParaderoEnRuta } from '../../core/models/negocio.models';
import { EstadoBadgePipe } from '../../shared/pipes/estado-badge.pipe';

@Component({
  selector: 'app-boletos',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatSelectModule, MatTabsModule, MatTableModule, MatTooltipModule,
    EstadoBadgePipe,
  ],
  templateUrl: './boletos.component.html',
  styleUrls: ['./boletos.component.scss'],
})
export class BoletosComponent implements OnInit {
  private readonly auth              = inject(AuthService);
  private readonly svc               = inject(BoletosService);
  private readonly busesSvc          = inject(BusesService);
  private readonly paraderosSvc      = inject(ParaderosService);
  private readonly ciudadanosSvc     = inject(CiudadanosService);
  private readonly metodosPagoSvc    = inject(MetodosPagoService);
  private readonly programacionesSvc = inject(ProgramacionesService);
  private readonly turnosSvc         = inject(TurnosService);
  private readonly rutasSvc          = inject(RutasService);
  private readonly notify            = inject(NotificationService);
  private readonly fb                = inject(FormBuilder);

  readonly esCiudadano = computed(() =>
    this.auth.roleDisplayNames().some(r => r.toLowerCase().includes('ciudadano'))
  );
  readonly esSupervisor = computed(() =>
    this.auth.roleDisplayNames().some(r => r.toLowerCase().includes('supervisor'))
  );
  readonly esSoloLectura = computed(() => this.esSupervisor());

  buses = signal<Bus[]>([]);
  paraderos = signal<Paradero[]>([]);
  ciudadanos = signal<Ciudadano[]>([]);
  metodosPago = signal<MetodoPagoCiudadano[]>([]);
  programaciones = signal<Programacion[]>([]);
  turnosEnCurso  = signal<Turno[]>([]);
  historial = signal<Boleto[]>([]);
  confirmacion = signal<AbordajeResponse | null>(null);

  historialCiudadanoId = signal<number | null>(null);
  ciudadanoDescensoId = signal<number | null>(null);
  paraderoDescensoId = signal<number | null>(null);
  recorrido = signal<RecorridoBoleto | null>(null);

  ciudadanoPropio          = signal<Ciudadano | null>(null);
  paraderosDeTurno         = signal<ParaderoEnRuta[]>([]);
  paraderosDeTurnoDescenso = signal<ParaderoEnRuta[]>([]);

  histColumns = ['estado', 'abordaje', 'descenso', 'ruta', 'bus', 'duracion', 'tarifa', 'acciones'];

  abordajeForm = this.fb.group({
    ciudadanoId:           [null as number | null, Validators.required],
    busId:                 [null as number | null, Validators.required],
    paraderoAbordajeId:    [null as number | null, Validators.required],
    metodoPagoCiudadanoId: [null as number | null, Validators.required],
  });

  ngOnInit(): void {
    this.busesSvc.list().subscribe(d => this.buses.set(d));
    this.paraderosSvc.list().subscribe(d => this.paraderos.set(d));
    this.programacionesSvc.list().subscribe(d => this.programaciones.set(d));

    this.cargarTurnosActivos();
    this.ciudadanosSvc.list().subscribe(d => {
      this.ciudadanos.set(d);
      if (this.esCiudadano()) {
        const email = this.auth.payload()?.email;
        const ciudadano = d.find(c => c.email?.toLowerCase() === email?.toLowerCase()) ?? null;
        if (ciudadano?.id != null) {
          this.ciudadanoPropio.set(ciudadano);
          this.historialCiudadanoId.set(ciudadano.id);
          this.ciudadanoDescensoId.set(ciudadano.id);
          this.abordajeForm.get('ciudadanoId')!.setValue(ciudadano.id);
          this.cargarHistorialCiudadano();
        }
      }
    });

    this.abordajeForm.get('ciudadanoId')!.valueChanges.subscribe(id => {
      this.metodosPago.set([]);
      this.abordajeForm.get('metodoPagoCiudadanoId')!.setValue(null);
      if (id) this.metodosPagoSvc.getByciudadano(id).subscribe(d => this.metodosPago.set(d));
    });

  }

  registrarAbordaje(): void {
    if (this.abordajeForm.invalid) return;
    const v = this.abordajeForm.value;
    const body: import('../../core/models/negocio.models').AbordajeRequest = {
      ciudadanoId:           Number(v.ciudadanoId),
      busId:                 Number(v.busId),
      paraderoAbordajeId:    Number(v.paraderoAbordajeId),
      metodoPagoCiudadanoId: Number(v.metodoPagoCiudadanoId),
    };
    this.svc.abordaje(body).subscribe({
      next: res => {
        this.confirmacion.set(res);
        this.notify.success('Abordaje registrado exitosamente');
        this.abordajeForm.reset();
        this.metodosPago.set([]);
        this.paraderosDeTurno.set([]);
        this.cargarTurnosActivos();
        this.cargarHistorialCiudadano();
      }
    });
  }

  registrarDescenso(): void {
    const ciudadanoId = this.ciudadanoDescensoId();
    const paraderoDescensoId = this.paraderoDescensoId();
    if (!ciudadanoId || !paraderoDescensoId) { this.notify.warning('Completa los campos'); return; }
    this.svc.descenso({ ciudadanoId, paraderoDescensoId }).subscribe({
      next: () => {
        this.notify.success('Descenso registrado');
        this.ciudadanoDescensoId.set(null);
        this.paraderoDescensoId.set(null);
        this.paraderosDeTurnoDescenso.set([]);
        this.cargarHistorialCiudadano();
      }
    });
  }

  cargarHistorialCiudadano(): void {
    const id = this.historialCiudadanoId();
    if (!id) return;
    this.svc.historialCiudadano(id).subscribe(d => {
      this.historial.set(d);
      if (this.esCiudadano()) this.cargarParaderosDescenso(d);
    });
  }

  buscarHistorial(): void { this.cargarHistorialCiudadano(); }

  cargarTurnosActivos(): void {
    this.turnosSvc.list().subscribe(d => {
      this.turnosEnCurso.set(d.filter(t => t.estado === 'EN_CURSO'));
    });
  }

  private cargarParaderosDescenso(boletos: Boleto[]): void {
    const activo = boletos.find(b => b.estado === 'ACTIVO');
    const rutaId = (activo as any)?.ruta?.id ?? null;
    if (rutaId) {
      this.rutasSvc.getMapa(rutaId).subscribe(mapa => {
        const ordenados = [...(mapa.paraderos ?? [])]
          .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
        this.paraderosDeTurnoDescenso.set(ordenados);
      });
    } else {
      this.paraderosDeTurnoDescenso.set([]);
    }
  }

  cerrarConfirmacion(): void { this.confirmacion.set(null); }

  verRecorrido(b: Boleto): void {
    this.svc.recorrido(b.id!).subscribe(d => this.recorrido.set(d));
  }

  cerrarRecorrido(): void { this.recorrido.set(null); }

  onCiudadanoDescensoChange(id: number | null): void {
    this.ciudadanoDescensoId.set(id);
    this.paraderoDescensoId.set(null);
    this.paraderosDeTurnoDescenso.set([]);
    if (id) {
      this.svc.historialCiudadano(id).subscribe(d => this.cargarParaderosDescenso(d));
    }
  }

  onHistorialCiudadanoChange(id: number | null): void {
    this.historialCiudadanoId.set(id);
    this.buscarHistorial();
  }

  nombreCiudadano(c: Ciudadano): string {
    return c.nombre && c.apellido
      ? `${c.nombre} ${c.apellido}`
      : `${c.persona?.nombres ?? ''} ${c.persona?.apellidos ?? ''}`.trim() || `#${c.id}`;
  }

  labelCiudadano(c: Ciudadano): string {
    const nombre = this.nombreCiudadano(c);
    if (c.numeroDocumento) return `${nombre} — ${c.tipoDocumento ?? 'CC'} ${c.numeroDocumento}`;
    if (c.email) return `${nombre} — ${c.email}`;
    return nombre;
  }

  onTurnoChange(turnoId: number | null): void {
    const turno = turnoId != null ? this.turnosEnCurso().find(t => t.id === turnoId) : null;
    this.abordajeForm.get('busId')!.setValue(turno?.bus?.id ?? null);
    this.abordajeForm.get('paraderoAbordajeId')!.setValue(null);
    this.paraderosDeTurno.set([]);

    const rutaId = turno ? this.getRutaIdTurno(turno) : null;
    if (rutaId) {
      this.rutasSvc.getMapa(rutaId).subscribe(mapa => {
        const ordenados = [...(mapa.paraderos ?? [])]
          .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
        this.paraderosDeTurno.set(ordenados);
      });
    }
  }

  private getRutaIdTurno(t: Turno): number | null {
    const busId = t.bus?.id;
    if (busId == null) return null;
    const prog = this.programaciones().find(p => (p.bus?.id ?? p.busId) === busId);
    return prog?.ruta?.id ?? (prog as any)?.rutaId ?? null;
  }

  labelTurno(t: Turno): string {
    const placa   = t.bus?.placa ?? `Bus #${t.bus?.id}`;
    const busId   = t.bus?.id;
    const prog    = busId != null ? this.programaciones().find(p => (p.bus?.id ?? p.busId) === busId) : null;
    const ruta    = prog?.ruta?.nombre ?? '';
    const empresa = t.empresa?.nombre ?? 'Sin empresa';
    return ruta ? `${placa} — ${ruta} — ${empresa}` : `${placa} — ${empresa}`;
  }
}
