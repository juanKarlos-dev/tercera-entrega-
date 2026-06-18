import { Component, inject, signal, OnInit, computed } from '@angular/core';
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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { AuthService } from '../../core/services/auth.service';
import { ConductoresService } from '../../core/services/conductores.service';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { Conductor } from '../../core/models/negocio.models';

@Component({
  selector: 'app-conductores',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatSelectModule, MatDialogModule, MatTooltipModule,
    MatDatepickerModule, MatNativeDateModule,
  ],
  templateUrl: './conductores.component.html',
  styleUrls: ['./conductores.component.scss'],
})
export class ConductoresComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly svc = inject(ConductoresService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);

  readonly esSupervisor = computed(() =>
    this.auth.roleDisplayNames().some(r => r.toLowerCase().includes('supervisor'))
  );
  readonly esSoloLectura = computed(() => this.esSupervisor());

  conductores = signal<Conductor[]>([]);
  editingId = signal<number | null>(null);
  showForm = signal(false);

  columns = ['nombres', 'apellidos', 'tipoDocumento', 'numeroDocumento', 'numeroLicencia', 'acciones'];
  tiposDocumento = ['CC', 'CE', 'PASAPORTE', 'TI'];

  readonly DIAS  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  readonly MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  form = this.fb.group({
    nombres: ['', Validators.required],
    apellidos: ['', Validators.required],
    tipoDocumento: ['CC'],
    numeroDocumento: [''],
    email: [''],
    numeroLicencia: [''],
    fechaVencimientoLicencia: [null as Date | null],
  });

  ngOnInit(): void { this.load(); }
  load(): void { this.svc.list().subscribe(d => this.conductores.set(d)); }

  openNew(): void {
    this.editingId.set(null);
    const unAno = new Date();
    unAno.setFullYear(unAno.getFullYear() + 1);
    this.form.reset({ tipoDocumento: 'CC', fechaVencimientoLicencia: unAno });
    this.showForm.set(true);
  }

  openEdit(c: Conductor): void {
    this.editingId.set(c.id!);
    this.form.patchValue({
      nombres: c.persona?.nombres ?? '',
      apellidos: c.persona?.apellidos ?? '',
      tipoDocumento: c.persona?.tipoDocumento ?? 'CC',
      numeroDocumento: c.persona?.numeroDocumento ?? '',
      email: c.email ?? '',
      numeroLicencia: c.numeroLicencia ?? '',
      fechaVencimientoLicencia: c.fechaVencimientoLicencia ? new Date(c.fechaVencimientoLicencia) : null,
    });
    this.showForm.set(true);
  }

  save(): void {
    if (this.form.invalid) return;
    const id = this.editingId();
    const v = this.form.value as any;
    const fechaDate = v.fechaVencimientoLicencia as Date | null;
    const pad = (n: number) => String(n).padStart(2, '0');
    const fechaVencimientoLicencia = fechaDate
      ? `${fechaDate.getFullYear()}-${pad(fechaDate.getMonth() + 1)}-${pad(fechaDate.getDate())}`
      : undefined;
    const body: any = {
      nombres: v.nombres, apellidos: v.apellidos, tipoDocumento: v.tipoDocumento,
      numeroDocumento: v.numeroDocumento, email: v.email, numeroLicencia: v.numeroLicencia,
      fechaVencimientoLicencia,
    };
    const op$ = id ? this.svc.update(id, body) : this.svc.create(body);
    op$.subscribe({ next: () => { this.notify.success(id ? 'Conductor actualizado' : 'Conductor creado'); this.showForm.set(false); this.load(); } });
  }

  getNombreDia(fecha: Date | null | undefined): string {
    return fecha ? this.DIAS[new Date(fecha).getDay()] : '';
  }

  getNombreFecha(fecha: Date | null | undefined): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    return `${d.getDate()} ${this.MESES[d.getMonth()]} ${d.getFullYear()}`;
  }

  delete(c: Conductor): void {
    const nombre = `${c.persona?.nombres ?? ''} ${c.persona?.apellidos ?? ''}`.trim() || `#${c.id}`;
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Eliminar conductor', message: `¿Eliminar a ${nombre}?`, danger: true },
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.svc.delete(c.id!).subscribe(() => { this.notify.success('Conductor eliminado'); this.load(); });
    });
  }

  cancel(): void { this.showForm.set(false); }
}
