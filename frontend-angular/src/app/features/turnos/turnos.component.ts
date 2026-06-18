import { Component, inject, signal, OnInit, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule, ReactiveFormsModule, FormBuilder,
  Validators, AbstractControl, ValidationErrors,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { AuthService } from '../../core/services/auth.service';
import { TurnosService } from '../../core/services/turnos.service';
import { BusesService } from '../../core/services/buses.service';
import { ConductoresService } from '../../core/services/conductores.service';
import { NotificationService } from '../../core/services/notification.service';
import { ContextService } from '../../core/services/context.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { EstadoBadgePipe } from '../../shared/pipes/estado-badge.pipe';
import { Turno, Bus, Conductor } from '../../core/models/negocio.models';

function to24h(h: number, ampm: string): number {
  return ampm === 'AM' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
}

function validarFinDespuesDeInicio(group: AbstractControl): ValidationErrors | null {
  const fi  = group.get('fechaInicio')?.value  as Date | null;
  const hi  = group.get('horaInicio')?.value   as number | null;
  const mi  = group.get('minutoInicio')?.value as number | null;
  const api = group.get('ampmInicio')?.value   as string | null;
  const ff  = group.get('fechaFin')?.value     as Date | null;
  const hf  = group.get('horaFin')?.value      as number | null;
  const mf  = group.get('minutoFin')?.value    as number | null;
  const apf = group.get('ampmFin')?.value      as string | null;
  if (!fi || hi == null || mi == null || !api || !ff || hf == null || mf == null || !apf) return null;
  const inicio = new Date(fi); inicio.setHours(to24h(hi, api), mi, 0, 0);
  const fin    = new Date(ff); fin.setHours(to24h(hf, apf), mf, 0, 0);
  return fin <= inicio ? { finAntesDInicio: true } : null;
}

@Component({
  selector: 'app-turnos',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatSelectModule, MatDialogModule, MatTooltipModule,
    MatDatepickerModule, MatNativeDateModule,
    EstadoBadgePipe,
  ],
  templateUrl: './turnos.component.html',
  styleUrls: ['./turnos.component.scss'],
})
export class TurnosComponent implements OnInit {
  private readonly auth           = inject(AuthService);
  private readonly svc            = inject(TurnosService);
  private readonly busesSvc       = inject(BusesService);
  private readonly conductoresSvc = inject(ConductoresService);
  private readonly notify         = inject(NotificationService);
  private readonly ctx            = inject(ContextService);
  private readonly dialog         = inject(MatDialog);
  private readonly fb             = inject(FormBuilder);

  readonly esConductor   = computed(() => this.auth.roleDisplayNames().some(r => r.toLowerCase().includes('conductor')));
  readonly esSupervisor  = computed(() => this.auth.roleDisplayNames().some(r => r.toLowerCase().includes('supervisor')));
  readonly esSoloLectura = computed(() => this.esSupervisor());

  turnos      = signal<Turno[]>([]);
  buses       = signal<Bus[]>([]);
  conductores = signal<Conductor[]>([]);
  editingId   = signal<number | null>(null);
  showForm    = signal(false);
  iniciando   = signal(false);
  iniciarTarget       = signal<Turno | null>(null);
  estadoConfirmadoBus = signal<string>('OPERATIVO');
  finalizando         = signal(false);
  finalizarTarget     = signal<Turno | null>(null);
  observacionesCierre = '';

  estadosBus = ['OPERATIVO', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO'];
  columns    = ['fechaInicioProgramada', 'fechaFinProgramada', 'estado', 'acciones'];

  // Reportar retraso
  retrasoTarget    = signal<Turno | null>(null);
  reportandoRetraso = signal(false);
  minutosRetrasoInput = 15;
  motivoRetrasoInput  = '';

  readonly DIAS  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  readonly MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  horas12    = Array.from({ length: 12 }, (_, i) => i + 1);
  minutosAll = Array.from({ length: 60 }, (_, i) => i);
  ampmOpts   = ['AM', 'PM'];

  form = this.fb.group(
    {
      busId:        [null as number | null, Validators.required],
      conductorId:  [null as number | null, Validators.required],
      fechaInicio:  [null as Date | null,   Validators.required],
      horaInicio:   [8    as number | null, Validators.required],
      minutoInicio: [0    as number | null, Validators.required],
      ampmInicio:   ['AM' as string | null, Validators.required],
      fechaFin:     [null as Date | null,   Validators.required],
      horaFin:      [5    as number | null, Validators.required],
      minutoFin:    [0    as number | null, Validators.required],
      ampmFin:      ['PM' as string | null, Validators.required],
    },
    { validators: validarFinDespuesDeInicio },
  );

  constructor() {
    effect(() => {
      const empresaId = this.ctx.empresaId();
      if (empresaId) {
        this.load();
      }
    });
  }

  ngOnInit(): void {
    if (!this.ctx.empresaId()) {
      this.load();
    }
    this.busesSvc.list().subscribe(d => this.buses.set(d));
    this.conductoresSvc.list().subscribe(d => this.conductores.set(d));
  }

  load(): void {
    this.svc.list().subscribe(d => {
      if (this.esConductor()) {
        const email = this.auth.payload()?.email;
        this.turnos.set(d.filter(t => t.conductor?.persona?.email === email || t.conductor?.email === email));
      } else {
        this.turnos.set(d);
      }
    });
  }

  openNew(): void {
    this.editingId.set(null);
    const ahora     = new Date();
    const finD      = new Date(ahora.getTime() + 60 * 60 * 1000);
    const h24i      = ahora.getHours();
    const h24f      = finD.getHours();
    this.form.reset({
      busId: null, conductorId: null,
      fechaInicio:  ahora,  horaInicio:  h24i % 12 || 12, minutoInicio: ahora.getMinutes(), ampmInicio: h24i < 12 ? 'AM' : 'PM',
      fechaFin:     finD,   horaFin:     h24f % 12 || 12, minutoFin:    finD.getMinutes(),  ampmFin:    h24f < 12 ? 'AM' : 'PM',
    });
    this.showForm.set(true);
  }

  openEdit(t: Turno): void {
    this.editingId.set(t.id!);
    const parsear = (iso: string | undefined | null) => {
      if (!iso) return { date: null, hora12: 8, minuto: 0, ampm: 'AM' };
      const d   = new Date(iso);
      const h24 = d.getHours();
      return { date: d, hora12: h24 % 12 || 12, minuto: d.getMinutes(), ampm: h24 < 12 ? 'AM' : 'PM' };
    };
    const inicio = parsear(t.fechaInicioProgramada);
    const fin    = parsear(t.fechaFinProgramada);
    this.form.patchValue({
      busId:       t.bus?.id ?? (t as any).busId ?? null,
      conductorId: t.conductor?.id ?? (t as any).conductorId ?? null,
      fechaInicio: inicio.date, horaInicio:   inicio.hora12, minutoInicio: inicio.minuto, ampmInicio: inicio.ampm,
      fechaFin:    fin.date,    horaFin:      fin.hora12,    minutoFin:    fin.minuto,    ampmFin:    fin.ampm,
    });
    this.showForm.set(true);
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      if (this.form.hasError('finAntesDInicio')) {
        this.notify.error('La fecha/hora fin debe ser posterior a la fecha/hora inicio.');
      }
      return;
    }
    const v = this.form.value;
    const combinar = (fecha: Date, hora: number, minuto: number, ampm: string): string => {
      const d   = new Date(fecha);
      const h24 = to24h(hora, ampm);
      d.setHours(h24, minuto, 0, 0);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(h24).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00`;
    };
    const id   = this.editingId();
    const body = {
      conductorId:           Number(v.conductorId),
      busId:                 Number(v.busId),
      fechaInicioProgramada: combinar(v.fechaInicio as Date, v.horaInicio as number, v.minutoInicio as number, v.ampmInicio as string),
      fechaFinProgramada:    combinar(v.fechaFin    as Date, v.horaFin    as number, v.minutoFin    as number, v.ampmFin    as string),
    };
    const op$ = id ? this.svc.update(id, body) : this.svc.create(body);
    op$.subscribe({
      next: () => { this.notify.success(id ? 'Turno actualizado' : 'Turno creado'); this.showForm.set(false); this.load(); },
    });
  }

  // ── Wheel helpers ──────────────────────────────────────────────────────────

  getWheelItems(
    arr: (number | string)[],
    selected: number | string | null | undefined,
    count = 5,
  ): Array<{ value: number | string; label: string; offset: number }> {
    const sv = selected ?? arr[0];
    let idx  = arr.indexOf(sv as number | string);
    if (idx === -1) idx = 0;
    const half = Math.floor(count / 2);
    return Array.from({ length: count }, (_, i) => {
      const offset = i - half;
      const j      = ((idx + offset) % arr.length + arr.length) % arr.length;
      const v      = arr[j];
      return { value: v, label: typeof v === 'number' ? String(v).padStart(2, '0') : String(v), offset };
    });
  }

  wheelOpacity(offset: number): number {
    const a = Math.abs(offset);
    return a === 0 ? 1 : a === 1 ? 0.4 : 0.2;
  }

  wheelFontSize(offset: number): string {
    const a = Math.abs(offset);
    return a === 0 ? '22px' : a === 1 ? '14px' : '11px';
  }

  onWheelScroll(e: WheelEvent, arr: (number | string)[], ctrl: string): void {
    e.preventDefault();
    const cur = this.form.get(ctrl)?.value ?? arr[0];
    let idx   = arr.indexOf(cur as number | string);
    if (idx === -1) idx = 0;
    const newIdx = ((idx + (e.deltaY > 0 ? 1 : -1)) % arr.length + arr.length) % arr.length;
    this.form.get(ctrl)?.setValue(arr[newIdx]);
  }

  onWheelItemClick(arr: (number | string)[], ctrl: string, offset: number): void {
    if (offset === 0) return;
    const cur = this.form.get(ctrl)?.value ?? arr[0];
    let idx   = arr.indexOf(cur as number | string);
    if (idx === -1) idx = 0;
    const newIdx = ((idx + offset) % arr.length + arr.length) % arr.length;
    this.form.get(ctrl)?.setValue(arr[newIdx]);
  }

  // ── Display helpers ────────────────────────────────────────────────────────

  getNombreDia(fecha: Date | null | undefined): string {
    return fecha ? this.DIAS[new Date(fecha).getDay()] : '';
  }

  getNombreFecha(fecha: Date | null | undefined): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    return `${d.getDate()} ${this.MESES[d.getMonth()]} ${d.getFullYear()}`;
  }

  formatDisplay(
    fecha: Date | null | undefined,
    hora: number | null | undefined,
    minuto: number | null | undefined,
    ampm: string | null | undefined,
  ): string {
    if (!fecha || hora == null || minuto == null || !ampm) return '';
    const hh = String(hora).padStart(2, '0');
    const mm = String(minuto).padStart(2, '0');
    return `${this.DIAS[new Date(fecha).getDay()]}, ${this.getNombreFecha(fecha)} ${hh}:${mm} ${ampm}`;
  }

  // ── Turno lifecycle ────────────────────────────────────────────────────────

  abrirInicioTurno(t: Turno): void { this.iniciarTarget.set(t); this.estadoConfirmadoBus.set('OPERATIVO'); }
  cancelarInicio(): void { this.iniciarTarget.set(null); }

  confirmarInicio(): void {
    const t = this.iniciarTarget();
    if (!t) return;
    this.iniciando.set(true);
    this.svc.iniciar(t.id!, { estadoConfirmadoBus: this.estadoConfirmadoBus() }).subscribe({
      next: () => { this.notify.success('Turno iniciado correctamente'); this.iniciarTarget.set(null); this.iniciando.set(false); this.load(); },
      error: () => this.iniciando.set(false),
    });
  }

  abrirFinalizacionTurno(t: Turno): void { this.finalizarTarget.set(t); this.observacionesCierre = ''; }
  cancelarFinalizacion(): void { this.finalizarTarget.set(null); }

  confirmarFinalizacion(): void {
    const t = this.finalizarTarget();
    if (!t) return;
    this.finalizando.set(true);
    this.svc.finalizar(t.id!, { observacionesCierre: this.observacionesCierre || undefined }).subscribe({
      next: () => { this.notify.success('Turno finalizado correctamente'); this.finalizarTarget.set(null); this.finalizando.set(false); this.load(); },
      error: () => this.finalizando.set(false),
    });
  }

  delete(t: Turno): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Eliminar turno', message: `¿Eliminar este turno?`, danger: true },
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.svc.delete(t.id!).subscribe(() => { this.notify.success('Turno eliminado'); this.load(); });
    });
  }

  cancel(): void { this.showForm.set(false); }

  // ── Reportar retraso ───────────────────────────────────────────────────────

  abrirRetraso(t: Turno): void {
    this.minutosRetrasoInput = 15;
    this.motivoRetrasoInput  = '';
    this.retrasoTarget.set(t);
  }

  cancelarRetraso(): void { this.retrasoTarget.set(null); }

  confirmarRetraso(): void {
    const t = this.retrasoTarget();
    if (!t) return;
    if (this.minutosRetrasoInput < 0 || this.minutosRetrasoInput > 120) {
      this.notify.error('Los minutos deben estar entre 0 y 120.');
      return;
    }
    this.reportandoRetraso.set(true);
    this.svc.reportarRetraso(t.id!, {
      minutosRetraso: this.minutosRetrasoInput,
      motivo: this.motivoRetrasoInput || undefined,
    }).subscribe({
      next: (res) => {
        this.notify.success(res.message);
        this.retrasoTarget.set(null);
        this.reportandoRetraso.set(false);
      },
      error: () => {
        this.notify.error('No se pudo registrar el retraso');
        this.reportandoRetraso.set(false);
      },
    });
  }
}
