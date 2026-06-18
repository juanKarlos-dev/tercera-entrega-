import {
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
  computed,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatTabsModule } from '@angular/material/tabs';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { CrearGrupoDto, Grupo, GrupoMiembro, GruposService } from '../../core/services/grupos.service';
import { Mensaje, MensajesService, UsuarioBusqueda } from '../../core/services/mensajes.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { environment } from '../../../environments/environment';

// ── Dialog para crear grupo ──────────────────────────────────────────────────
@Component({
  selector: 'app-crear-grupo-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatRadioModule, MatProgressSpinnerModule, MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>Nuevo grupo</h2>
    <mat-dialog-content>

      <mat-form-field appearance="outline" class="dlg-full-w">
        <mat-label>Nombre del grupo *</mat-label>
        <input matInput [(ngModel)]="nombre" maxlength="100" />
      </mat-form-field>

      <mat-form-field appearance="outline" class="dlg-full-w">
        <mat-label>Descripción (opcional)</mat-label>
        <textarea matInput [(ngModel)]="descripcion" maxlength="500" rows="3"></textarea>
      </mat-form-field>

      <mat-radio-group [(ngModel)]="tipo" class="dlg-radio-group">
        <mat-radio-button value="PUBLICO">Público</mat-radio-button>
        <mat-radio-button value="PRIVADO">Privado</mat-radio-button>
      </mat-radio-group>

      <!-- Imagen -->
      <div class="dlg-imagen-row">
        <span class="dlg-section-label">Imagen del grupo (opcional)</span>
        <div class="dlg-imagen-controles">
          @if (imagenPreviewUrl) {
            <img [src]="imagenPreviewUrl" class="dlg-imagen-preview" alt="preview" />
          }
          <button mat-stroked-button type="button" (click)="imagenInput.click()">
            <mat-icon>image</mat-icon>
            {{ imagenFile ? 'Cambiar' : 'Subir imagen' }}
          </button>
          <input #imagenInput type="file" accept="image/jpeg,image/png,image/webp" hidden
                 (change)="onImagenSelected($event)" />
        </div>
      </div>

      <!-- Buscar miembros -->
      <div class="dlg-section-label">Agregar miembros * <span class="dlg-hint">(mínimo 2)</span></div>
      <mat-form-field appearance="outline" class="dlg-full-w">
        <mat-label>Buscar por nombre o email</mat-label>
        <input matInput
               [(ngModel)]="busquedaQuery"
               (ngModelChange)="onBusquedaChange($event)"
               placeholder="Escribe al menos 2 caracteres…" />
        @if (buscando) {
          <mat-progress-spinner matSuffix diameter="16" mode="indeterminate" />
        }
      </mat-form-field>

      @if (resultadosBusqueda.length) {
        <div class="dlg-resultados">
          @for (u of resultadosBusqueda; track u.securityUserId) {
            <div class="dlg-resultado-item" (click)="agregarMiembro(u)">
              <div class="dlg-usuario-info">
                <span class="dlg-usuario-nombre">{{ u.nombres }} {{ u.apellidos }}</span>
                <span class="dlg-usuario-email">{{ u.email }}</span>
              </div>
              <mat-icon class="dlg-add-icon">add_circle</mat-icon>
            </div>
          }
        </div>
      }

      @if (miembrosSeleccionados.length) {
        <div class="dlg-chips">
          @for (m of miembrosSeleccionados; track m.securityUserId) {
            <span class="dlg-chip">
              {{ m.nombres }} {{ m.apellidos }}
              <button class="dlg-chip-remove" type="button" (click)="quitarMiembro(m)">×</button>
            </span>
          }
        </div>
      }

      @if (miembrosSeleccionados.length < 2) {
        <p class="dlg-error-miembros">
          <mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:middle">error_outline</mat-icon>
          Debes seleccionar al menos 2 miembros
        </p>
      }

    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close(null)">Cancelar</button>
      <button mat-raised-button color="primary"
              [disabled]="!nombre.trim() || miembrosSeleccionados.length < 2"
              (click)="confirmar()">
        Crear
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dlg-full-w       { width: 100%; margin-bottom: 12px; display: block; }
    .dlg-radio-group  { display: flex; gap: 24px; margin-bottom: 16px; }
    .dlg-section-label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    .dlg-hint         { font-weight: 400; color: #9CA3AF; }

    .dlg-imagen-row       { margin-bottom: 16px; }
    .dlg-imagen-controles { display: flex; align-items: center; gap: 12px; }
    .dlg-imagen-preview   { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; border: 1px solid #E5E7EB; }

    .dlg-resultados {
      border: 1px solid #E5E7EB; border-radius: 8px; max-height: 160px;
      overflow-y: auto; margin-bottom: 12px;
    }
    .dlg-resultado-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; cursor: pointer; gap: 8px;
      &:hover { background: #F9FAFB; }
      &:not(:last-child) { border-bottom: 1px solid #F3F4F6; }
    }
    .dlg-usuario-info  { display: flex; flex-direction: column; }
    .dlg-usuario-nombre { font-size: 13px; font-weight: 600; color: #111827; }
    .dlg-usuario-email  { font-size: 11px; color: #9CA3AF; }
    .dlg-add-icon       { color: #2563EB; font-size: 20px; width: 20px; height: 20px; }

    .dlg-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .dlg-chip  {
      display: flex; align-items: center; gap: 4px;
      background: #DBEAFE; color: #1E40AF;
      padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500;
    }
    .dlg-chip-remove {
      background: none; border: none; cursor: pointer;
      color: #1E40AF; font-size: 14px; line-height: 1; padding: 0; margin-left: 2px;
      &:hover { color: #DC2626; }
    }

    .dlg-error-miembros {
      font-size: 12px; color: #EF4444; margin: 0 0 8px;
      display: flex; align-items: center; gap: 4px;
    }
  `],
})
export class CrearGrupoDialogComponent implements OnDestroy {
  readonly dialogRef = inject(MatDialogRef<CrearGrupoDialogComponent>);
  private readonly gruposSvc = inject(GruposService);
  private readonly data = inject<{ excludeId: string }>(MAT_DIALOG_DATA);

  @ViewChild('imagenInput') imagenInputRef!: ElementRef<HTMLInputElement>;

  nombre      = '';
  descripcion = '';
  tipo: 'PUBLICO' | 'PRIVADO' = 'PUBLICO';

  busquedaQuery        = '';
  resultadosBusqueda: UsuarioBusqueda[] = [];
  miembrosSeleccionados: UsuarioBusqueda[] = [];
  buscando             = false;
  imagenFile: File | null  = null;
  imagenPreviewUrl: string | null = null;

  private readonly searchSubject = new Subject<string>();
  private readonly searchSub: Subscription;

  constructor() {
    this.searchSub = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => {
        if (q.length < 2) { this.resultadosBusqueda = []; return of([]); }
        this.buscando = true;
        return this.gruposSvc.buscarUsuarios(q, this.data.excludeId);
      }),
    ).subscribe({
      next: usuarios => {
        this.resultadosBusqueda = usuarios.filter(
          u => !this.miembrosSeleccionados.some(m => m.securityUserId === u.securityUserId),
        );
        this.buscando = false;
      },
      error: () => { this.buscando = false; },
    });
  }

  ngOnDestroy(): void { this.searchSub.unsubscribe(); }

  onBusquedaChange(q: string): void { this.searchSubject.next(q); }

  agregarMiembro(u: UsuarioBusqueda): void {
    if (!this.miembrosSeleccionados.some(m => m.securityUserId === u.securityUserId)) {
      this.miembrosSeleccionados = [...this.miembrosSeleccionados, u];
    }
    this.resultadosBusqueda = [];
    this.busquedaQuery = '';
  }

  quitarMiembro(u: UsuarioBusqueda): void {
    this.miembrosSeleccionados = this.miembrosSeleccionados.filter(
      m => m.securityUserId !== u.securityUserId,
    );
  }

  onImagenSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.imagenFile = file;
    const reader = new FileReader();
    reader.onload = e => { this.imagenPreviewUrl = e.target?.result as string; };
    reader.readAsDataURL(file);
  }

  confirmar(): void {
    if (!this.nombre.trim() || this.miembrosSeleccionados.length < 2) return;
    this.dialogRef.close({
      nombre:      this.nombre.trim(),
      descripcion: this.descripcion || undefined,
      tipo:        this.tipo,
      memberIds:   this.miembrosSeleccionados.map(m => m.securityUserId),
      imagenFile:  this.imagenFile,
    });
  }
}

// ── Componente principal de grupos ──────────────────────────────────────────
@Component({
  selector: 'app-grupos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatTabsModule,
  ],
  templateUrl: './grupos.component.html',
  styleUrls: ['./grupos.component.scss'],
})
export class GruposComponent implements OnInit, OnDestroy {
  private readonly gruposSvc   = inject(GruposService);
  private readonly auth        = inject(AuthService);
  private readonly notifSvc    = inject(NotificationService);
  private readonly dialog      = inject(MatDialog);
  private readonly mensajesSvc = inject(MensajesService);

  readonly serverUrl = environment.serverUrl;

  userId = '';
  private wsSubscription: Subscription | null = null;

  tabActiva            = signal<number>(0);
  publicos             = signal<Grupo[]>([]);
  busquedaPublicos     = signal<string>('');
  publicosFiltrados    = computed(() => {
    const q = this.busquedaPublicos().toLowerCase().trim();
    if (!q) return this.publicos();
    return this.publicos().filter(g => 
      g.nombre.toLowerCase().includes(q) || 
      (g.descripcion && g.descripcion.toLowerCase().includes(q))
    );
  });
  misGrupos            = signal<Grupo[]>([]);
  cargando             = signal<boolean>(false);
  uniendose            = signal<number | null>(null);
  grupoAbierto         = signal<number | null>(null);
  historialGrupo       = signal<Mensaje[]>([]);
  mensajeGrupo         = signal<string>('');
  enviandoMensajeGrupo = signal<boolean>(false);
  miembrosGrupo        = signal<GrupoMiembro[]>([]);
  historialLogs        = signal<any[]>([]);
  panelMiembrosTab     = signal<'MIEMBROS' | 'HISTORIAL'>('MIEMBROS');
  busquedaMiembros     = signal<string>('');
  miembrosGrupoFiltrados = computed(() => {
    const q = this.busquedaMiembros().toLowerCase().trim();
    if (!q) return this.miembrosGrupo();
    return this.miembrosGrupo().filter(m => 
      this.resolverNombre(m.usuarioId).toLowerCase().includes(q)
    );
  });
  panelMiembrosAbierto = signal<number | null>(null);
  accionando           = signal<string | null>(null);

  private readonly searchPublicosSubj = new Subject<string>();

  constructor() {
    this.searchPublicosSubj.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(q => {
      this.cargarPublicos(q);
    });
  }

  ngOnInit(): void {
    this.userId = this.auth.payload()?.id ?? '';
    this.cargarPublicos();
    this.cargarMisGrupos();
    this.mensajesSvc.conectar(this.userId);
    this.wsSubscription = this.mensajesSvc.onNuevoMensajeGrupo().subscribe(msg => {
      if (msg.grupoId === this.grupoAbierto()) {
        this.historialGrupo.update(list =>
          list.some(m => m.id === msg.id) ? list : [...list, msg],
        );
      }
    });

    const sub = this.mensajesSvc.onRemovidoGrupo().subscribe(data => {
      if (this.grupoAbierto() === data.grupoId) {
        this.grupoAbierto.set(null);
        this.historialGrupo.set([]);
        this.notifSvc.error('Has sido removido de este grupo por un administrador.');
      }
      this.cargarMisGrupos();
    });
    this.wsSubscription.add(sub);
  }

  ngOnDestroy(): void {
    this.wsSubscription?.unsubscribe();
  }

  onBusquedaPublicos(q: string): void {
    this.busquedaPublicos.set(q);
    this.searchPublicosSubj.next(q);
  }

  cargarPublicos(q?: string): void {
    this.cargando.set(true);
    this.gruposSvc.getPublicos(q).subscribe({
      next: g  => { this.publicos.set(g); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  cargarMisGrupos(): void {
    if (!this.userId) return;
    this.gruposSvc.getMisGrupos(this.userId).subscribe({
      next: g  => this.misGrupos.set(g),
      error: () => {},
    });
  }

  unirse(grupo: Grupo): void {
    this.uniendose.set(grupo.id);
    this.gruposSvc.unirse(grupo.id, this.userId).subscribe({
      next: () => {
        this.notifSvc.success(`Te uniste a "${grupo.nombre}"`);
        this.cargarMisGrupos();
        this.publicos.update(list =>
          list.map(g => g.id === grupo.id
            ? { ...g, totalMiembros: (g.totalMiembros ?? 0) + 1 }
            : g),
        );
        this.uniendose.set(null);
      },
      error: () => {
        this.notifSvc.error('No se pudo unir al grupo');
        this.uniendose.set(null);
      },
    });
  }

  abrirCrearGrupo(): void {
    const ref = this.dialog.open(CrearGrupoDialogComponent, {
      width: '520px',
      data: { excludeId: this.userId },
    });
    ref.afterClosed().subscribe((result: (CrearGrupoDto & { imagenFile?: File }) | null) => {
      if (!result) return;
      const { imagenFile, ...dto } = result;
      this.gruposSvc.crear(dto, this.userId).subscribe({
        next: (grupo) => {
          if (imagenFile) {
            this.gruposSvc.subirImagen(grupo.id, imagenFile).subscribe({
              next: () => {
                this.notifSvc.success('Grupo creado con imagen');
                this.cargarPublicos();
                this.cargarMisGrupos();
              },
              error: () => {
                this.notifSvc.success('Grupo creado (la imagen no se pudo subir)');
                this.cargarPublicos();
                this.cargarMisGrupos();
              },
            });
          } else {
            this.notifSvc.success('Grupo creado');
            this.cargarPublicos();
            this.cargarMisGrupos();
          }
        },
        error: (err: { error?: { message?: string } }) =>
          this.notifSvc.error(err.error?.message ?? 'No se pudo crear el grupo'),
      });
    });
  }

  yaSoyMiembro(grupo: Grupo): boolean {
    return this.misGrupos().some(g => g.id === grupo.id);
  }

  truncar(texto: string, max = 80): string {
    return texto.length > max ? texto.slice(0, max) + '…' : texto;
  }

  esAdmin(grupoId: number): boolean {
    return this.miembrosGrupo().some(
      m => m.grupoId === grupoId && m.usuarioId === this.userId && m.rol === 'ADMIN',
    );
  }

  esUnicoAdmin(grupoId: number): boolean {
    if (this.panelMiembrosAbierto() !== grupoId) return false;
    const admins = this.miembrosGrupo().filter(m => m.rol === 'ADMIN');
    return admins.length === 1 && admins[0].usuarioId === this.userId;
  }

  abrirPanelMiembros(grupoId: number): void {
    if (this.panelMiembrosAbierto() === grupoId) {
      this.panelMiembrosAbierto.set(null);
      return;
    }
    this.panelMiembrosAbierto.set(grupoId);
    this.panelMiembrosTab.set('MIEMBROS');
    this.gruposSvc.getMiembros(grupoId, this.userId).subscribe({
      next: ms => this.miembrosGrupo.set(ms),
    });
    this.gruposSvc.getLogMembresia(grupoId, this.userId).subscribe({
      next: logs => this.historialLogs.set(logs),
    });
  }

  salirDeGrupo(grupo: Grupo): void {
    if (!confirm(`¿Estás seguro que quieres abandonar el grupo ${grupo.nombre}?`)) return;
    this.gruposSvc.salir(grupo.id, this.userId).subscribe({
      next: () => {
        this.notifSvc.success('Saliste del grupo');
        this.cargarMisGrupos();
      },
      error: (err: { error?: { message?: string } }) =>
        this.notifSvc.error(err.error?.message ?? 'No puedes salir del grupo'),
    });
  }

  removerMiembro(grupoId: number, usuarioId: string): void {
    this.accionando.set(`remover-${usuarioId}`);
    this.gruposSvc.remover(grupoId, this.userId, usuarioId).subscribe({
      next: () => {
        this.miembrosGrupo.update(ms => ms.filter(m => m.usuarioId !== usuarioId));
        this.notifSvc.success('Miembro removido');
        this.accionando.set(null);
      },
      error: () => {
        this.notifSvc.error('No se pudo remover');
        this.accionando.set(null);
      },
    });
  }

  promoverMiembro(grupoId: number, usuarioId: string): void {
    if (!confirm('¿Seguro que deseas promover a este usuario a Administrador? Tendrá los mismos permisos que tú.')) return;
    this.accionando.set(`promover-${usuarioId}`);
    this.gruposSvc.promover(grupoId, this.userId, usuarioId).subscribe({
      next: () => {
        this.miembrosGrupo.update(ms =>
          ms.map(m => m.usuarioId === usuarioId ? { ...m, rol: 'ADMIN' as const } : m),
        );
        this.notifSvc.success('Miembro promovido a administrador');
        this.accionando.set(null);
      },
      error: () => {
        this.notifSvc.error('No se pudo promover');
        this.accionando.set(null);
      },
    });
  }

  bloquearMiembro(grupoId: number, usuarioId: string): void {
    if (!confirm('¿Seguro que deseas bloquear a este usuario? No podrá volver a unirse al grupo.')) return;
    this.accionando.set(`bloquear-${usuarioId}`);
    this.gruposSvc.bloquear(grupoId, this.userId, usuarioId).subscribe({
      next: () => {
        this.miembrosGrupo.update(ms =>
          ms.map(m => m.usuarioId === usuarioId ? { ...m, bloqueado: true } : m),
        );
        this.notifSvc.success('Usuario bloqueado');
        this.accionando.set(null);
      },
      error: () => {
        this.notifSvc.error('No se pudo bloquear');
        this.accionando.set(null);
      },
    });
  }

  abrirChat(grupoId: number): void {
    if (this.grupoAbierto() === grupoId) {
      this.grupoAbierto.set(null);
      return;
    }
    this.grupoAbierto.set(grupoId);
    this.historialGrupo.set([]);
    this.mensajesSvc.getHistorialGrupo(grupoId).subscribe({
      next: msgs => this.historialGrupo.set(msgs),
    });
    this.mensajesSvc.joinGrupo(grupoId);
    this.gruposSvc.getMiembros(grupoId, this.userId).subscribe({
      next: ms => this.miembrosGrupo.set(ms),
    });
  }

  enviarMensajeGrupo(grupoId: number): void {
    if (!this.mensajeGrupo().trim()) return;
    this.enviandoMensajeGrupo.set(true);
    this.mensajesSvc.enviarAGrupo(grupoId, this.userId, this.mensajeGrupo()).subscribe({
      next: msg => {
        this.historialGrupo.update(list => [...list, msg]);
        this.mensajeGrupo.set('');
        this.enviandoMensajeGrupo.set(false);
      },
      error: () => this.enviandoMensajeGrupo.set(false),
    });
  }

  eliminarMensajeGrupo(grupoId: number, msgId: number): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar mensaje',
        message: '¿Eliminar este mensaje? Esta acción no se puede deshacer.',
        confirmLabel: 'Eliminar',
        danger: true,
      },
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.gruposSvc.eliminarMensaje(grupoId, msgId, this.userId).subscribe({
        next: () => {
          this.historialGrupo.update(list =>
            list.map(m => m.id === msgId ? { ...m, deletedByAdmin: true } : m),
          );
          this.notifSvc.success('Mensaje eliminado');
        },
        error: (err: { error?: { message?: string } }) =>
          this.notifSvc.error(err.error?.message ?? 'No se pudo eliminar el mensaje'),
      });
    });
  }

  resolverNombre(usuarioId: string): string {
    const m = this.miembrosGrupo().find(x => x.usuarioId === usuarioId);
    if (m?.nombres) return `${m.nombres}${m.apellidos ? ' ' + m.apellidos : ''}`;
    return usuarioId.length > 10 ? usuarioId.slice(0, 8) + '…' : usuarioId;
  }

  getImagenUrl(imagen: string | null | undefined): string | null {
    if (!imagen) return null;
    return imagen.startsWith('http') ? imagen : `${this.serverUrl}${imagen}`;
  }
}
