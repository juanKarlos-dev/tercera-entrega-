import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EmpresasService } from '../../core/services/empresas.service';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { Empresa } from '../../core/models/negocio.models';

@Component({
  selector: 'app-empresas',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatDialogModule, MatTooltipModule,
  ],
  templateUrl: './empresas.component.html',
  styleUrls: ['./empresas.component.scss'],
})
export class EmpresasComponent implements OnInit {
  private readonly svc = inject(EmpresasService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);

  empresas = signal<Empresa[]>([]);
  editingId = signal<number | null>(null);
  showForm = signal(false);

  columns = ['nombre', 'nit', 'acciones'];

  form = this.fb.group({
    nombre: ['', Validators.required],
    nit: [''],
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.svc.list().subscribe({
      next: data => this.empresas.set(data),
      error: err => {
        console.error('Error cargando empresas:', err);
        alert('Error conectando al backend: ' + (err.message || err.status || 'sin respuesta'));
      },
    });
  }

  openNew(): void {
    this.editingId.set(null);
    this.form.reset();
    this.showForm.set(true);
  }

  openEdit(e: Empresa): void {
    this.editingId.set(e.id!);
    this.form.patchValue({ nombre: e.nombre ?? '', nit: e.nit ?? '' });
    this.showForm.set(true);
  }

  save(): void {
    if (this.form.invalid) return;
    const id = this.editingId();
    const body = this.form.value as Partial<Empresa>;
    const op$ = id ? this.svc.update(id, body) : this.svc.create(body);
    op$.subscribe({
      next: () => {
        this.notify.success(id ? 'Empresa actualizada' : 'Empresa creada');
        this.showForm.set(false);
        this.load();
      },
    });
  }

  delete(e: Empresa): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Eliminar empresa', message: `¿Eliminar "${e.nombre}"?`, danger: true },
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.svc.delete(e.id!).subscribe(() => {
        this.notify.success('Empresa eliminada');
        this.load();
      });
    });
  }

  cancel(): void { this.showForm.set(false); }
}
