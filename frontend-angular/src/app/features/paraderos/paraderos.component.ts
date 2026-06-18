import { Component, inject, signal, OnInit, ViewChild, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatSelectModule } from '@angular/material/select';
import { ParaderosService } from '../../core/services/paraderos.service';
import { RutasService } from '../../core/services/rutas.service';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { MapPickerComponent } from '../../shared/map-picker/map-picker.component';
import { ZonasService, Zona } from '../../core/services/zonas.service';
import { Paradero, Ruta } from '../../core/models/negocio.models';

@Component({
  selector: 'app-paraderos',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatDialogModule, MatTooltipModule,
    MatTabsModule, MatDividerModule, MatSelectModule, MapPickerComponent,
  ],
  templateUrl: './paraderos.component.html',
  styleUrls: ['./paraderos.component.scss'],
})
export class ParaderosComponent implements OnInit {
  private readonly auth     = inject(AuthService);
  private readonly svc      = inject(ParaderosService);
  private readonly rutasSvc = inject(RutasService);
  private readonly notify   = inject(NotificationService);
  private readonly dialog   = inject(MatDialog);
  private readonly fb       = inject(FormBuilder);
  private readonly zonasSvc = inject(ZonasService);

  readonly esCiudadano = computed(() =>
    this.auth.roleDisplayNames().some(r => r.toLowerCase().includes('ciudadano'))
  );

  paraderos = signal<Paradero[]>([]);
  rutasDelParadero = signal<(Ruta & { tiempoEnParadero?: number })[]>([]);
  paraderoSeleccionado = signal<Paradero | null>(null);
  cercanos = signal<Paradero[]>([]);
  buscados = signal<Paradero[]>([]);
  editingId = signal<number | null>(null);
  showForm = signal(false);
  busquedaNombre = signal('');
  localizando = signal(false);
  miUbicacion = signal<{ lat: number; lng: number } | null>(null);
  zonas = signal<Zona[]>([]);

  pickedLat: number = 5.0703;
  pickedLng: number = -75.5138;

  @ViewChild('mapPicker') mapPicker?: MapPickerComponent;
  @ViewChild('cercanosMap') cercanosMap?: MapPickerComponent;

  columns = ['nombre', 'tipo', 'zona', 'latitud', 'longitud', 'acciones'];
  tipoOptions = ['PARADERO', 'ESTACION', 'TERMINAL'];

  form = this.fb.group({
    nombre: ['', Validators.required],
    tipo: ['PARADERO'],
    latitud: [null as number | null, Validators.required],
    longitud: [null as number | null, Validators.required],
    zonaId: [null as number | null],
  });

  ngOnInit(): void { 
    this.load(); 
    this.zonasSvc.list().subscribe(z => this.zonas.set(z));
  }
  load(): void { this.svc.list().subscribe(d => this.paraderos.set(d)); }

  onMapPick(pos: { lat: number; lng: number }): void {
    this.pickedLat = pos.lat;
    this.pickedLng = pos.lng;
    this.form.patchValue({ latitud: pos.lat, longitud: pos.lng });
  }

  openNew(): void {
    this.editingId.set(null);
    this.form.reset({ tipo: 'PARADERO', zonaId: null });
    this.pickedLat = 5.0703;
    this.pickedLng = -75.5138;
    this.showForm.set(true);
  }

  openEdit(p: Paradero): void {
    this.editingId.set(p.id!);
    this.form.patchValue({ 
      nombre: p.nombre, 
      tipo: p.tipo, 
      latitud: p.latitud, 
      longitud: p.longitud,
      zonaId: (p as any).zona?.id ?? null
    });
    this.pickedLat = p.latitud ?? 5.0703;
    this.pickedLng = p.longitud ?? -75.5138;
    this.showForm.set(true);
  }

  save(): void {
    if (this.form.invalid) return;
    const id = this.editingId();
    const round7 = (n: number) => parseFloat(n.toFixed(7));
    const body: Partial<Paradero> & { zonaId?: number } = {
      nombre:   this.form.value.nombre?.trim(),
      tipo:     this.form.value.tipo ?? undefined,
      latitud:  round7(this.pickedLat),
      longitud: round7(this.pickedLng),
      zonaId:   this.form.value.zonaId ?? undefined,
    };
    const op$ = id ? this.svc.update(id, body) : this.svc.create(body);
    op$.subscribe({ next: () => { this.notify.success(id ? 'Paradero actualizado' : 'Paradero creado'); this.showForm.set(false); this.load(); } });
  }

  buscarPorNombre(): void {
    const nombre = this.busquedaNombre();
    if (!nombre) return;
    this.svc.buscarPorNombre(nombre).subscribe(d => this.buscados.set(d));
  }

  buscarCercanos(): void {
    if (!navigator.geolocation) { this.notify.error('Geolocalización no soportada'); return; }
    this.localizando.set(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = parseFloat(pos.coords.latitude.toFixed(7));
        const lng = parseFloat(pos.coords.longitude.toFixed(7));
        this.localizando.set(false);
        this.miUbicacion.set({ lat, lng });
        this.svc.buscarCercanos(lat, lng).subscribe(data => {
          this.cercanos.set(data.slice(0, 5));
          setTimeout(() => {
            this.cercanosMap?.addUserMarker(lat, lng);
            this.cercanosMap?.addNearbyMarkers(data.slice(0, 5));
          }, 200);
        });
      },
      () => { this.localizando.set(false); this.notify.error('No se pudo obtener la ubicación'); }
    );
  }

  delete(p: Paradero): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Eliminar paradero', message: `¿Eliminar "${p.nombre}"?`, danger: true },
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.svc.delete(p.id!).subscribe(() => { this.notify.success('Paradero eliminado'); this.load(); });
    });
  }

  verRutas(paradero: Paradero): void {
    this.showForm.set(false);
    this.paraderoSeleccionado.set(paradero);
    this.rutasSvc.list().subscribe(rutas => {
      if (!rutas.length) { this.rutasDelParadero.set([]); return; }
      forkJoin(rutas.map(r => this.rutasSvc.getById(r.id!))).subscribe(respuestas => {
        const detalladas = respuestas.map((res: any) => res.data ?? res);
        this.rutasDelParadero.set(
          detalladas
            .filter((r: any) => r.paraderos?.some((rp: any) => rp.paradero?.id === paradero.id))
            .map((r: any) => ({
              ...r,
              tiempoEnParadero: r.paraderos
                ?.find((rp: any) => rp.paradero?.id === paradero.id)
                ?.tiempoEstimadoDesdeAnteriorMinutos,
            }))
        );
      });
    });
  }

  cancel(): void { this.showForm.set(false); this.paraderoSeleccionado.set(null); }
}
