import { Component, inject, signal, OnInit, ViewChild, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormControl, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { RutasService } from '../../core/services/rutas.service';
import { ParaderosService } from '../../core/services/paraderos.service';
import { ProgramacionesService } from '../../core/services/programaciones.service';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { MapPickerComponent } from '../../shared/map-picker/map-picker.component';
import { Ruta, Paradero, ParaderoEnRuta, RutaMapa, Programacion } from '../../core/models/negocio.models';

type ParaderoEnForm = Paradero & { distanciaDesdeAnteriorMetros: number; tiempoEstimadoDesdeAnteriorMinutos: number };

@Component({
  selector: 'app-rutas',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatSelectModule, MatDialogModule,
    MatTooltipModule, MatChipsModule, MatDividerModule, DragDropModule, MapPickerComponent,
  ],
  templateUrl: './rutas.component.html',
  styleUrls: ['./rutas.component.scss'],
})
export class RutasComponent implements OnInit {
  @ViewChild('rutaMap') rutaMap?: MapPickerComponent;

  private readonly auth             = inject(AuthService);
  private readonly svc              = inject(RutasService);
  private readonly paraderosSvc     = inject(ParaderosService);
  private readonly programacionesSvc = inject(ProgramacionesService);
  private readonly notify           = inject(NotificationService);
  private readonly dialog           = inject(MatDialog);
  private readonly fb               = inject(FormBuilder);

  readonly esCiudadano = computed(() =>
    this.auth.roleDisplayNames().some(r => r.toLowerCase().includes('ciudadano'))
  );

  readonly searchControl = new FormControl('', { nonNullable: true });

  rutas = signal<Ruta[]>([]);
  programacionesRuta = signal<Programacion[]>([]);
  rutaSeleccionadaHorarios = signal<Ruta | null>(null);
  paraderosHorarios = signal<ParaderoEnRuta[]>([]);

  readonly rutasFiltradas = computed(() => {
    const q = this.searchControl.value.toLowerCase().trim();
    if (!q) return this.rutas();
    return this.rutas().filter(r => r.nombre?.toLowerCase().includes(q));
  });
  paraderos = signal<Paradero[]>([]);
  paraderosSel = signal<ParaderoEnForm[]>([]);
  rutaMapa = signal<RutaMapa | null>(null);
  showForm = signal(false);
  showMapa = signal(false);
  editingId = signal<number | null>(null);

  columns = ['nombre', 'descripcion', 'tarifa', 'acciones'];

  form = this.fb.group({
    nombre: ['', Validators.required],
    descripcion: [''],
    tarifa: [null as number | null],
  });

  ngOnInit(): void {
    this.load();
    this.paraderosSvc.list().subscribe(d => this.paraderos.set(d));
  }

  load(): void { this.svc.list().subscribe(d => this.rutas.set(d)); }

  openNew(): void {
    this.editingId.set(null);
    this.form.reset();
    this.paraderosSel.set([]);
    this.showForm.set(true);
    this.showMapa.set(false);
  }

  openEdit(r: Ruta): void {
    this.editingId.set(r.id!);
    this.form.patchValue(r as any);
    const sel: ParaderoEnForm[] = (r.paraderos ?? []).map(pr => {
      const p = this.paraderos().find(x => x.id === pr.paraderoId);
      return {
        ...(p ?? { id: pr.paraderoId, nombre: pr.nombre, latitud: pr.latitud, longitud: pr.longitud }),
        distanciaDesdeAnteriorMetros: pr.distanciaDesdeAnteriorMetros ?? 0,
        tiempoEstimadoDesdeAnteriorMinutos: pr.tiempoEstimadoDesdeAnteriorMinutos ?? 0,
      } as ParaderoEnForm;
    });
    this.paraderosSel.set(this.recalcularDistancias(sel));
    this.showForm.set(true);
    this.showMapa.set(false);
  }

  private haversineMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  private recalcularDistancias(arr: ParaderoEnForm[]): ParaderoEnForm[] {
    return arr.map((p, i) => {
      if (i === 0) return { ...p, distanciaDesdeAnteriorMetros: 0, tiempoEstimadoDesdeAnteriorMinutos: 0 };
      const prev = arr[i - 1];
      const dist = (prev.latitud != null && prev.longitud != null && p.latitud != null && p.longitud != null)
        ? this.haversineMetros(prev.latitud, prev.longitud, p.latitud, p.longitud)
        : 0;
      return { ...p, distanciaDesdeAnteriorMetros: dist, tiempoEstimadoDesdeAnteriorMinutos: Math.round(dist / 250) };
    });
  }

  addParadero(id: number): void {
    const p = this.paraderos().find(x => x.id === id);
    if (!p || this.paraderosSel().find(x => x.id === id)) return;
    const newArr = [...this.paraderosSel(), { ...p, distanciaDesdeAnteriorMetros: 0, tiempoEstimadoDesdeAnteriorMinutos: 0 }];
    this.paraderosSel.set(this.recalcularDistancias(newArr));
  }

  removeParadero(id: number): void {
    this.paraderosSel.set(this.recalcularDistancias(this.paraderosSel().filter(p => p.id !== id)));
  }

  drop(event: CdkDragDrop<ParaderoEnForm[]>): void {
    const arr = [...this.paraderosSel()];
    moveItemInArray(arr, event.previousIndex, event.currentIndex);
    this.paraderosSel.set(this.recalcularDistancias(arr));
  }

  save(): void {
    if (this.form.invalid) return;
    if (this.paraderosSel().length < 3) { this.notify.warning('Selecciona al menos 3 paraderos'); return; }
    const id = this.editingId();
    const v = this.form.value;
    const body: Partial<Ruta> = {
      nombre:      v.nombre ?? undefined,
      descripcion: v.descripcion ?? undefined,
      tarifa:      v.tarifa != null ? Number(v.tarifa) : undefined,
      paraderos:   this.paraderosSel().map((p, i) => ({
        paraderoId: Number(p.id),
        orden: i + 1,
        distanciaDesdeAnteriorMetros: Number(p.distanciaDesdeAnteriorMetros),
        tiempoEstimadoDesdeAnteriorMinutos: Number(p.tiempoEstimadoDesdeAnteriorMinutos),
      })),
    };
    const op$ = id ? this.svc.update(id, body) : this.svc.create(body);
    op$.subscribe({ next: () => { this.notify.success(id ? 'Ruta actualizada' : 'Ruta creada'); this.showForm.set(false); this.load(); } });
  }

  verMapa(r: Ruta): void {
    this.showForm.set(false);
    this.showMapa.set(true);
    this.svc.getMapa(r.id!).subscribe(mapa => {
      this.rutaMapa.set(mapa);
      setTimeout(() => {
        if (mapa.paraderos?.length) this.rutaMap?.mostrarRuta(mapa.paraderos);
      }, 300);
    });
  }

  delete(r: Ruta): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Eliminar ruta', message: `¿Eliminar ruta "${r.nombre}"?`, danger: true },
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.svc.delete(r.id!).subscribe(() => { this.notify.success('Ruta eliminada'); this.load(); });
    });
  }

  verHorarios(ruta: Ruta): void {
    this.showForm.set(false);
    this.showMapa.set(false);
    this.rutaSeleccionadaHorarios.set(ruta);
    const paraderos = ruta.paraderos ?? [];
    if (paraderos.length > 0) {
      this.paraderosHorarios.set([...paraderos].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)));
    } else {
      this.svc.getMapa(ruta.id!).subscribe(mapa => {
        this.paraderosHorarios.set([...(mapa.paraderos ?? [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)));
      });
    }
    this.programacionesSvc.list().subscribe(todas => {
      this.programacionesRuta.set(todas.filter(p => p.rutaId === ruta.id || p.ruta?.id === ruta.id));
    });
  }

  cancel(): void { this.showForm.set(false); this.showMapa.set(false); this.rutaSeleccionadaHorarios.set(null); this.paraderosHorarios.set([]); }
}
