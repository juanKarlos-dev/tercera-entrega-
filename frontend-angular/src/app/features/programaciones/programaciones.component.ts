import { Component, inject, signal, OnInit, computed, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MapPickerComponent } from '../../shared/map-picker/map-picker.component';
import { environment } from '../../../environments/environment';
import QRCode from 'qrcode';
import { AuthService } from '../../core/services/auth.service';
import { ContextService } from '../../core/services/context.service';
import { ProgramacionesService } from '../../core/services/programaciones.service';
import { BusesService } from '../../core/services/buses.service';
import { RutasService } from '../../core/services/rutas.service';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { Programacion, Bus, Ruta, RutaMapa } from '../../core/models/negocio.models';

function to24h(h: number, ampm: string): number {
  return ampm === 'AM' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
}

@Component({
  selector: 'app-programaciones',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatSelectModule, MatDialogModule, MatTooltipModule, MatTabsModule,
    MatDatepickerModule, MatNativeDateModule,
    MatProgressSpinnerModule, MatDividerModule, MapPickerComponent,
  ],
  templateUrl: './programaciones.component.html',
  styleUrls: ['./programaciones.component.scss'],
})
export class ProgramacionesComponent implements OnInit {
  @ViewChild('detalleMap') detalleMap?: MapPickerComponent;

  private readonly auth      = inject(AuthService);
  private readonly ctx       = inject(ContextService);
  private readonly svc       = inject(ProgramacionesService);
  private readonly busesSvc  = inject(BusesService);
  private readonly rutasSvc  = inject(RutasService);
  private readonly notify    = inject(NotificationService);
  private readonly dialog    = inject(MatDialog);
  private readonly fb        = inject(FormBuilder);

  readonly apiBase = environment.serverUrl;

  constructor() {
    effect(() => {
      const empresaId = this.ctx.empresaId();
      if (empresaId) {
        this.load();
      }
    });
  }

  readonly esSupervisor  = computed(() => this.auth.roleDisplayNames().some(r => r.toLowerCase().includes('supervisor')));
  readonly esCiudadano   = computed(() => this.auth.roleDisplayNames().some(r => r.toLowerCase().includes('ciudadano')));
  readonly esSoloLectura = computed(() => this.esSupervisor() || this.esCiudadano());

  programaciones        = signal<Programacion[]>([]);
  visibles              = signal<Programacion[]>([]);
  buses                 = signal<Bus[]>([]);
  rutas                 = signal<Ruta[]>([]);
  editingId             = signal<number | null>(null);
  showForm              = signal(false);
  detalleAbierto        = signal(false);
  programacionDetalle   = signal<Programacion | null>(null);
  rutaMapa              = signal<RutaMapa | null>(null);
  busQrUrl              = signal<string | null>(null);

  tiposRecurrencia = [
    { value: 'NINGUNA',         label: 'Ninguna (una vez)' },
    { value: 'LUNES_A_VIERNES', label: 'Lunes a viernes' },
    { value: 'FINES_DE_SEMANA', label: 'Fines de semana' },
    { value: 'DIARIA',          label: 'Diaria' },
  ];
  columns         = ['fechaHoraSalida', 'tipoRecurrencia', 'estado', 'acciones'];
  columnsVisibles = ['fechaHoraSalida', 'ruta', 'tipoRecurrencia', 'estado', 'acciones'];

  readonly DIAS  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  readonly MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  horas12    = Array.from({ length: 12 }, (_, i) => i + 1);
  minutosAll = Array.from({ length: 60 }, (_, i) => i);
  ampmOpts   = ['AM', 'PM'];

  form = this.fb.group({
    fechaSalida:     [null as Date | null,   Validators.required],
    horaSalida:      [8    as number | null, Validators.required],
    minutoSalida:    [0    as number | null, Validators.required],
    ampmSalida:      ['AM' as string | null, Validators.required],
    tipoRecurrencia: ['DIARIA' as string | null, Validators.required],
    rutaId:          [null as number | null, Validators.required],
    busId:           [null as number | null, Validators.required],
  });

  ngOnInit(): void {
    this.busesSvc.list().subscribe(d => this.buses.set(d));
    this.rutasSvc.list().subscribe(d => this.rutas.set(d));
    if (this.esCiudadano()) {
      this.loadVisibles();
    }
  }

  load(): void { this.svc.list().subscribe(d => this.programaciones.set(d)); }
  loadVisibles(): void { this.svc.getHorariosVisibles().subscribe(d => this.visibles.set(d)); }

  openNew(): void {
    this.editingId.set(null);
    const ahora = new Date();
    const h24   = ahora.getHours();
    this.form.reset({
      fechaSalida:     ahora,
      horaSalida:      h24 % 12 || 12,
      minutoSalida:    ahora.getMinutes(),
      ampmSalida:      h24 < 12 ? 'AM' : 'PM',
      tipoRecurrencia: 'DIARIA',
      rutaId:          null,
      busId:           null,
    });
    this.showForm.set(true);
  }

  openEdit(p: Programacion): void {
    this.editingId.set(p.id!);
    let fechaSalida: Date | null = null;
    let horaSalida = 8;
    let minutoSalida = 0;
    let ampmSalida = 'AM';
    if (p.fechaHoraSalida) {
      const d   = new Date(p.fechaHoraSalida);
      const h24 = d.getHours();
      fechaSalida  = d;
      horaSalida   = h24 % 12 || 12;
      minutoSalida = d.getMinutes();
      ampmSalida   = h24 < 12 ? 'AM' : 'PM';
    }
    this.form.patchValue({
      fechaSalida, horaSalida, minutoSalida, ampmSalida,
      tipoRecurrencia: p.tipoRecurrencia ?? 'DIARIA',
      rutaId: (p as any).ruta?.id ?? (p as any).rutaId ?? null,
      busId:  (p as any).bus?.id  ?? (p as any).busId  ?? null,
    });
    this.showForm.set(true);
  }

  save(): void {
    if (this.form.invalid) return;
    const v    = this.form.value;
    const d    = new Date(v.fechaSalida as Date);
    const h24  = to24h(v.horaSalida as number, v.ampmSalida as string);
    d.setHours(h24, v.minutoSalida as number, 0, 0);
    const pad  = (n: number) => String(n).padStart(2, '0');
    const iso  = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h24)}:${pad(v.minutoSalida as number)}:00`;
    const tipoRecurrencia = v.tipoRecurrencia ?? 'NINGUNA';
    const body = {
      rutaId:                  Number(v.rutaId),
      busId:                   Number(v.busId),
      fechaHoraSalida:         iso,
      tipoRecurrencia,
      recurrente:              tipoRecurrencia !== 'NINGUNA',
      margenToleranciaMinutos: 5,
    };
    const id  = this.editingId();
    const op$ = id ? this.svc.update(id, body) : this.svc.create(body);
    op$.subscribe({ next: () => { this.notify.success(id ? 'Programación actualizada' : 'Programación creada'); this.showForm.set(false); this.load(); } });
  }

  delete(p: Programacion): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Eliminar programación', message: '¿Eliminar esta programación?', danger: true },
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.svc.delete(p.id!).subscribe(() => { this.notify.success('Programación eliminada'); this.load(); });
    });
  }

  cancel(): void { this.showForm.set(false); }

  async verDetalle(p: Programacion): Promise<void> {
    const busId  = p.bus?.id  ?? p.busId;
    const rutaId = p.ruta?.id ?? p.rutaId;
    // Prefer full objects from the pre-loaded signals (API may return partial nested objects)
    const bus    = this.buses().find(b => b.id === busId) ?? p.bus;
    const ruta   = this.rutas().find(r => r.id === rutaId) ?? p.ruta;

    this.programacionDetalle.set({ ...p, bus, ruta });
    this.rutaMapa.set(null);
    this.busQrUrl.set(null);
    this.detalleAbierto.set(true);

    const placa = bus?.placa ?? busId?.toString() ?? 'BUS';
    QRCode.toDataURL(placa, { width: 180, margin: 2 }).then(url => this.busQrUrl.set(url));

    if (rutaId) {
      this.rutasSvc.getMapa(rutaId).subscribe(mapa => {
        this.rutaMapa.set(mapa);
        setTimeout(() => {
          if (mapa.paraderos?.length) this.detalleMap?.mostrarRuta(mapa.paraderos);
        }, 300);
      });
    }
  }

  cerrarDetalle(): void {
    this.detalleAbierto.set(false);
    this.programacionDetalle.set(null);
    this.rutaMapa.set(null);
    this.busQrUrl.set(null);
  }

  getFotoUrl(bus: Bus | null | undefined): string | null {
    if (!bus?.fotoUrl) return null;
    return bus.fotoUrl.startsWith('http') ? bus.fotoUrl : `${this.apiBase}${bus.fotoUrl}`;
  }

  getTiempoTotal(mapa: RutaMapa | null): number {
    return (mapa?.paraderos ?? []).reduce((s, p) => s + (p.tiempoEstimadoDesdeAnteriorMinutos ?? 0), 0);
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
}
