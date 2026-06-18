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
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';
import { BusesService } from '../../core/services/buses.service';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { EstadoBadgePipe } from '../../shared/pipes/estado-badge.pipe';
import { Bus } from '../../core/models/negocio.models';
import { environment } from '../../../environments/environment';
import QRCode from 'qrcode';

// ── QR Dialog ──────────────────────────────────────────────────────────────
@Component({
  selector: 'app-bus-qr-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, CommonModule, MatProgressSpinnerModule],
  template: `
    <h2 mat-dialog-title>Código QR — {{ data.placa }}</h2>
    <mat-dialog-content style="padding:16px 24px">
      <div style="text-align:center">
        @if (qrUrl()) {
          <img [src]="qrUrl()!" alt="QR {{ data.placa }}" style="width:300px;height:300px">
        } @else {
          <mat-spinner diameter="48" style="margin:auto"></mat-spinner>
        }
      </div>
      <div style="margin-top:16px;border:1px solid #e0e0e0;border-radius:10px;padding:14px 16px;display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:0.88rem">
        <mat-icon style="font-size:18px;color:#555;align-self:center">directions_bus</mat-icon>
        <span><strong>Placa:</strong> {{ data.placa ?? '—' }}</span>
        <mat-icon style="font-size:18px;color:#555;align-self:center">factory</mat-icon>
        <span><strong>Modelo:</strong> {{ data.modelo ?? '—' }}</span>
        <mat-icon style="font-size:18px;color:#555;align-self:center">calendar_today</mat-icon>
        <span><strong>Año:</strong> {{ data.anio ?? '—' }}</span>
        <mat-icon style="font-size:18px;color:#555;align-self:center">group</mat-icon>
        <span><strong>Capacidad:</strong> {{ data.capacidadMaximaPasajeros ?? '—' }} pasajeros</span>
        <mat-icon style="font-size:18px;color:#555;align-self:center">business</mat-icon>
        <span><strong>Empresa:</strong> {{ data.empresa?.nombre ?? '—' }}</span>
        <mat-icon style="font-size:18px;color:#555;align-self:center">info</mat-icon>
        <span><strong>Estado:</strong> {{ data.estado ?? '—' }}</span>
        @if (data.codigo) {
          <mat-icon style="font-size:18px;color:#555;align-self:center">key</mat-icon>
          <span><strong>Código:</strong> {{ data.codigo }}</span>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cerrar</button>
      @if (qrUrl()) {
        <button mat-flat-button color="primary" (click)="download()">
          <mat-icon>download</mat-icon> Descargar QR
        </button>
      }
    </mat-dialog-actions>
  `,
})
export class BusQrDialogComponent implements OnInit {
  readonly data = inject<Bus>(MAT_DIALOG_DATA);
  qrUrl = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const url = await QRCode.toDataURL(`${this.data.placa ?? ''} | ${this.data.modelo ?? ''} | ${this.data.empresa?.nombre ?? ''} | ${this.data.capacidadMaximaPasajeros ?? ''} pasajeros | ${this.data.estado ?? ''}`, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
      color: { dark: '#000000', light: '#ffffff' },
    });
    this.qrUrl.set(url);
  }

  download(): void {
    const link = document.createElement('a');
    link.href = this.qrUrl()!;
    link.download = `qr-bus-${this.data.placa ?? 'bus'}.png`;
    link.click();
  }
}

// ── Main component ─────────────────────────────────────────────────────────
@Component({
  selector: 'app-buses',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatSelectModule, MatDialogModule, MatTooltipModule,
    EstadoBadgePipe,
  ],
  templateUrl: './buses.component.html',
  styleUrls: ['./buses.component.scss'],
})
export class BusesComponent implements OnInit {
  @ViewChild('fotoInput') fotoInput!: ElementRef<HTMLInputElement>;

  private readonly auth = inject(AuthService);
  private readonly svc = inject(BusesService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);

  readonly esSupervisor = computed(() =>
    this.auth.roleDisplayNames().some(r => r.toLowerCase().includes('supervisor'))
  );
  readonly esSoloLectura = computed(() => this.esSupervisor());

  buses = signal<Bus[]>([]);
  editingId = signal<number | null>(null);
  showForm = signal(false);
  uploadingFotoForId = signal<number | null>(null);

  columns = ['foto', 'placa', 'modelo', 'anio', 'capacidadMaximaPasajeros', 'estado', 'qr', 'acciones'];
  estados = ['OPERATIVO', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO'];
  apiBase = environment.serverUrl;

  form = this.fb.group({
    placa:                   ['', [Validators.required, Validators.maxLength(15)]],
    modelo:                  ['', [Validators.required, Validators.maxLength(80)]],
    anio:                    [null as number | null, [Validators.required, Validators.min(1980), Validators.max(2027)]],
    capacidadMaximaPasajeros:[null as number | null, [Validators.required, Validators.min(1), Validators.max(300)]],
    capacidadSentados:       [null as number | null, [Validators.required, Validators.min(0), Validators.max(300)]],
    capacidadParados:        [null as number | null, [Validators.required, Validators.min(0), Validators.max(300)]],
    estado:                  ['OPERATIVO', Validators.required],
  });

  ngOnInit(): void { this.load(); }

  load(): void { this.svc.list().subscribe(data => this.buses.set(data)); }

  openNew(): void {
    this.editingId.set(null);
    this.form.reset({ estado: 'OPERATIVO' });
    this.showForm.set(true);
  }

  openEdit(b: Bus): void {
    this.editingId.set(b.id!);
    this.form.patchValue({
      placa:                    b.placa ?? '',
      modelo:                   b.modelo ?? '',
      anio:                     b.anio ?? null,
      capacidadMaximaPasajeros: b.capacidadMaximaPasajeros ?? null,
      capacidadSentados:        b.capacidadSentados ?? null,
      capacidadParados:         b.capacidadParados ?? null,
      estado:                   b.estado ?? 'OPERATIVO',
    });
    this.showForm.set(true);
  }

  save(): void {
    if (this.form.invalid) return;
    const id = this.editingId();
    const v = this.form.value;
    const payload: Partial<Bus> = {
      placa:                    v.placa    ?? undefined,
      modelo:                   v.modelo   ?? undefined,
      anio:                     Number(v.anio),
      capacidadMaximaPasajeros: Number(v.capacidadMaximaPasajeros),
      capacidadSentados:        Number(v.capacidadSentados),
      capacidadParados:         Number(v.capacidadParados),
      estado:                   (v.estado  ?? undefined) as Bus['estado'],
    };
    const op$ = id ? this.svc.update(id, payload) : this.svc.create(payload);
    op$.subscribe({ next: () => { this.notify.success(id ? 'Bus actualizado' : 'Bus creado'); this.showForm.set(false); this.load(); } });
  }

  triggerFoto(busId: number): void {
    this.uploadingFotoForId.set(busId);
    this.fotoInput.nativeElement.click();
  }

  onFotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    const id = this.uploadingFotoForId();
    if (!file || !id) return;
    this.svc.subirFoto(id, file).subscribe({ next: () => { this.notify.success('Foto actualizada'); this.load(); } });
    (event.target as HTMLInputElement).value = '';
  }

  delete(b: Bus): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Eliminar bus', message: `¿Eliminar bus ${b.placa}?`, danger: true },
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.svc.delete(b.id!).subscribe(() => { this.notify.success('Bus eliminado'); this.load(); });
    });
  }

  openQr(b: Bus): void {
    this.dialog.open(BusQrDialogComponent, { data: b, width: '400px' });
  }

  cancel(): void { this.showForm.set(false); }

  onImgError(e: Event): void {
    const img = e.target as HTMLImageElement;
    img.style.display = 'none';
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = 'directions_bus';
    icon.style.cssText = 'font-size:36px;color:#9e9e9e';
    img.parentElement?.appendChild(icon);
  }

  getFotoUrl(b: Bus): string | null {
    if (!b.fotoUrl) return null;
    return b.fotoUrl.startsWith('http') ? b.fotoUrl : `${this.apiBase}${b.fotoUrl}`;
  }
}
