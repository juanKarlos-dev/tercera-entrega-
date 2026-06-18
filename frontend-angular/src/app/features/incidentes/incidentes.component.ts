import { Component, inject, signal, OnInit, ElementRef, ViewChild, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { IncidentesService } from '../../core/services/incidentes.service';
import { BusesService } from '../../core/services/buses.service';
import { TurnosService } from '../../core/services/turnos.service';
import { ContextService } from '../../core/services/context.service';
import { NotificationService } from '../../core/services/notification.service';
import { Incidente, Bus, Turno } from '../../core/models/negocio.models';
import { EstadoBadgePipe } from '../../shared/pipes/estado-badge.pipe';

@Component({
  selector: 'app-incidentes',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatSelectModule, MatTabsModule, MatTooltipModule,
    EstadoBadgePipe,
  ],
  templateUrl: './incidentes.component.html',
  styleUrls: ['./incidentes.component.scss'],
})
export class IncidentesComponent implements OnInit {
  @ViewChild('fotoInput') fotoInput!: ElementRef<HTMLInputElement>;

  private readonly auth = inject(AuthService);
  private readonly svc = inject(IncidentesService);
  private readonly busesSvc = inject(BusesService);
  private readonly turnosSvc = inject(TurnosService);
  private readonly ctx = inject(ContextService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly esSupervisor = computed(() =>
    this.auth.roleDisplayNames().some(r => r.toLowerCase().includes('supervisor'))
  );

  incidentes = signal<Incidente[]>([]);
  buses = signal<Bus[]>([]);
  fotos = signal<File[]>([]);
  turnoActivo = signal<Turno | null>(null);
  incidenteParaFotos = signal<number | null>(null);
  busIdBusqueda = signal<number | null>(null);
  incidenteParaComentario = signal<Incidente | null>(null);
  comentario = signal('');
  nuevoEstado = signal('');
  capturandoGps = signal(false);

  fotoSeleccionada = signal<string | null>(null);
  fotosActuales   = signal<string[]>([]);
  fotoIndex       = signal(0);
  retrasoAutomatico = signal<number>(5);

  tipos = ['ACCIDENTE', 'MECANICO', 'RETRASO', 'SEGURIDAD', 'OTRO'];
  gravedades = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO'];
  columns = ['tipo', 'gravedad', 'descripcion', 'estado', 'comentario', 'fotografias', 'acciones'];

  form = this.fb.group({
    tipo:        ['', Validators.required],
    gravedad:    ['BAJO', Validators.required],
    descripcion: ['', Validators.required],
    tiempoEstimadoRetrasoMinutos: [null as number | null],
    latitud:     [null as number | null],
    longitud:    [null as number | null],
  });

  ngOnInit(): void {
    this.busesSvc.list().subscribe(d => this.buses.set(d));
    const conductorId = this.ctx.conductorId();
    this.turnosSvc.list().subscribe(turnos => {
      const activo = conductorId
        ? turnos.find(t => t.estado === 'EN_CURSO' && (t.conductor as any)?.id === conductorId)
        : turnos.find(t => t.estado === 'EN_CURSO');
      this.turnoActivo.set(activo ?? null);
    });

    this.form.get('gravedad')?.valueChanges.subscribe(gravedad => {
      let retraso = 5;
      if (gravedad === 'MEDIO') retraso = 10;
      else if (gravedad === 'ALTO') retraso = 20;
      else if (gravedad === 'CRITICO') retraso = 30;
      this.retrasoAutomatico.set(retraso);
    });
  }

  fotoUrl(ruta: string): string { return `${environment.serverUrl}/${ruta}`; }

  onBusFilter(id: number | null): void {
    this.busIdBusqueda.set(id);
    this.buscarPorBus();
  }

  crear(): void {
    if (this.form.invalid) return;
    this.capturandoGps.set(true);
    const submit = (lat?: number, lng?: number) => {
      const v = this.form.value;
      const body: any = { tipo: v.tipo, gravedad: v.gravedad, descripcion: v.descripcion };
      if (lat != null) body.latitud = lat;
      if (lng != null) body.longitud = lng;
      body.tiempoEstimadoRetrasoMinutos = this.retrasoAutomatico();

      this.svc.crear(body).subscribe({
        next: inc => {
          this.notify.success('Incidente creado correctamente. El retraso se sumará automáticamente en Tracking.');
          this.capturandoGps.set(false);
          this.form.reset({ gravedad: 'BAJO' });
          if (this.busIdBusqueda()) this.buscarPorBus();
          if (this.fotos().length) {
            this.svc.subirFotografias(inc.id!, this.fotos()).subscribe(() => {
              this.notify.success('Fotografías subidas');
              this.fotos.set([]);
            });
          }
        },
        error: () => this.capturandoGps.set(false),
      });
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => submit(p.coords.latitude, p.coords.longitude),
        () => { this.capturandoGps.set(false); submit(); }
      );
    } else {
      this.capturandoGps.set(false);
      submit();
    }
  }

  onFotosSelected(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    if (files.length > 5) { this.notify.warning('Máximo 5 fotografías'); return; }
    this.fotos.set(files);
  }

  buscarPorBus(): void {
    const id = this.busIdBusqueda();
    if (!id) return;
    this.svc.getByBus(id).subscribe(d => this.incidentes.set(d));
  }

  guardarComentario(): void {
    const inc = this.incidenteParaComentario();
    if (!inc) return;
    this.svc.agregarComentario(inc.id!, this.comentario(), this.nuevoEstado() || undefined).subscribe({
      next: () => {
        this.notify.success('Comentario guardado');
        this.incidenteParaComentario.set(null);
        this.comentario.set('');
        this.nuevoEstado.set('');
        if (this.busIdBusqueda()) this.buscarPorBus();
      }
    });
  }

  abrirLightbox(fotos: string[], rawPath: string): void {
    const idx = fotos.indexOf(rawPath);
    const i   = idx >= 0 ? idx : 0;
    this.fotosActuales.set(fotos);
    this.fotoIndex.set(i);
    this.fotoSeleccionada.set(this.fotoUrl(fotos[i]));
  }

  cerrarLightbox(): void { this.fotoSeleccionada.set(null); }

  fotoAnterior(): void {
    const fotos = this.fotosActuales();
    const i = (this.fotoIndex() - 1 + fotos.length) % fotos.length;
    this.fotoIndex.set(i);
    this.fotoSeleccionada.set(this.fotoUrl(fotos[i]));
  }

  fotoSiguiente(): void {
    const fotos = this.fotosActuales();
    const i = (this.fotoIndex() + 1) % fotos.length;
    this.fotoIndex.set(i);
    this.fotoSeleccionada.set(this.fotoUrl(fotos[i]));
  }
}
