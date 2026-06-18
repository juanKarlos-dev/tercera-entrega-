import { Component, inject, signal, OnInit } from '@angular/core';
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
import { AuthService } from '../../core/services/auth.service';
import { CiudadanosService } from '../../core/services/ciudadanos.service';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { Ciudadano } from '../../core/models/negocio.models';

@Component({
  selector: 'app-ciudadanos',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatSelectModule, MatDialogModule, MatTooltipModule,
  ],
  templateUrl: './ciudadanos.component.html',
  styleUrls: ['./ciudadanos.component.scss'],
})
export class CiudadanosComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly svc = inject(CiudadanosService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);

  ciudadanos = signal<Ciudadano[]>([]);
  editingId = signal<number | null>(null);
  showForm = signal(false);

  columns = ['nombre', 'apellido', 'tipoDocumento', 'numeroDocumento', 'telefono', 'email', 'acciones'];

  tiposDocumento = ['CC', 'TI', 'CE', 'PP'];

  form = this.fb.group({
    nombre:          ['', Validators.required],
    apellido:        ['', Validators.required],
    email:           ['', [Validators.required, Validators.email]],
    fechaNacimiento: [''],
    tipoDocumento:   ['CC', Validators.required],
    numeroDocumento: ['', Validators.required],
    telefono:        [''],
  });

  ngOnInit(): void { this.load(); }
  load(): void { this.svc.list().subscribe(d => this.ciudadanos.set(d)); }

  openNew(): void {
    this.editingId.set(null);
    this.form.reset({ tipoDocumento: 'CC' });
    this.showForm.set(true);
  }

  openEdit(c: Ciudadano): void {
    this.editingId.set(c.id!);
    this.form.patchValue({
      nombre:          c.nombre          ?? '',
      apellido:        c.apellido        ?? '',
      email:           c.email           ?? '',
      fechaNacimiento: c.fechaNacimiento ?? '',
      tipoDocumento:   c.tipoDocumento   ?? 'CC',
      numeroDocumento: c.numeroDocumento ?? '',
      telefono:        c.telefono        ?? '',
    });
    this.showForm.set(true);
  }

  save(): void {
    if (this.form.invalid) return;
    const id = this.editingId();
    const v = this.form.value;

    const body: Partial<Ciudadano> = {
      nombre:          v.nombre          ?? undefined,
      apellido:        v.apellido        ?? undefined,
      email:           v.email           ?? undefined,
      tipoDocumento:   v.tipoDocumento   ?? undefined,
      numeroDocumento: v.numeroDocumento ?? undefined,
      telefono:        v.telefono        || undefined,
    };

    if (v.fechaNacimiento) body.fechaNacimiento = v.fechaNacimiento;

    // Al crear, asignar automáticamente el ID del usuario logueado
    if (!id) {
      const userId = this.auth.payload()?.id;
      if (userId) body.securityUserId = userId;
    }

    const op$ = id ? this.svc.update(id, body) : this.svc.create(body);
    op$.subscribe({
      next: () => { this.notify.success(id ? 'Ciudadano actualizado' : 'Ciudadano creado'); this.showForm.set(false); this.load(); },
    });
  }

  delete(c: Ciudadano): void {
    const nombre = `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim() || `#${c.id}`;
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Eliminar ciudadano', message: `¿Eliminar a ${nombre}?`, danger: true },
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.svc.delete(c.id!).subscribe(() => { this.notify.success('Ciudadano eliminado'); this.load(); });
    });
  }

  cancel(): void { this.showForm.set(false); }
}
