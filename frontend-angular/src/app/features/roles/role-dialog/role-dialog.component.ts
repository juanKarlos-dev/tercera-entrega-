import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { Role } from '../../../core/models/role.model';

export interface RoleDialogData {
  role?: Role | null;
  roles?: Role[];
}

@Component({
  selector: 'app-role-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule
  ],
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>{{ data.role?.id ? 'Editar rol' : 'Crear rol' }}</h2>
      <button mat-icon-button mat-dialog-close><mat-icon>close</mat-icon></button>
    </div>
    
    <form [formGroup]="form" (ngSubmit)="save()" class="dialog-form">
      <div mat-dialog-content>
        <div class="field-group">
          <label>Nombre del rol</label>
          <mat-form-field appearance="outline">
            <input matInput placeholder="Ej. Supervisor" formControlName="name">
            @if (form.controls.name.invalid && form.controls.name.touched) {
              <mat-error>El nombre es obligatorio (mín. 3 caracteres)</mat-error>
            }
          </mat-form-field>
        </div>

        <div class="field-group">
          <label>Descripción</label>
          <mat-form-field appearance="outline">
            <textarea 
              matInput 
              rows="3" 
              placeholder="Describe el propósito y alcance de este rol..." 
              formControlName="description"
              maxlength="200"
            ></textarea>
            <mat-hint align="end">{{ form.controls.description.value.length }} / 200</mat-hint>
          </mat-form-field>
        </div>

        @if (!data.role?.id && data.roles && data.roles.length > 0) {
          <div class="field-group">
            <label>Rol base (opcional)</label>
            <mat-form-field appearance="outline">
              <mat-select placeholder="Seleccionar rol base" formControlName="baseRoleId">
                <mat-option [value]="null">Ninguno</mat-option>
                @for (r of data.roles; track r.id) {
                  <mat-option [value]="r.id">{{ r.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
        }
      </div>

      <div mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close class="btn-cancel">Cancelar</button>
        <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid" class="btn-save">
          {{ data.role?.id ? 'Actualizar rol' : 'Guardar rol' }}
        </button>
      </div>
    </form>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem 1.5rem 0.5rem;
      h2 { margin: 0; font-size: 1.5rem; font-weight: 800; color: #1e1b4b; }
      button { color: #94a3b8; }
    }
    .dialog-form {
      padding: 0 0.5rem;
    }
    .field-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 1.25rem;
      label { font-size: 0.85rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
      mat-form-field { width: 100%; }
    }
    mat-dialog-content {
      padding-top: 1rem;
      min-width: 450px;
    }
    mat-dialog-actions {
      padding: 1.5rem;
      gap: 1rem;
      button { border-radius: 12px; font-weight: 700; padding: 0.5rem 1.5rem; }
      .btn-cancel { color: #64748b; }
      .btn-save { background: #2d3ef0; box-shadow: 0 4px 12px rgba(45, 62, 240, 0.2); }
    }
    @media (max-width: 600px) {
      mat-dialog-content { min-width: 100%; }
    }
  `]
})
export class RoleDialogComponent {
  private readonly fb = inject(FormBuilder);
  readonly dialogRef = inject(MatDialogRef<RoleDialogComponent, any>);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.maxLength(200)]],
    baseRoleId: [null as string | null]
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: RoleDialogData) {
    if (data.role) {
      this.form.patchValue({
        name: data.role.name ?? '',
        description: data.role.description ?? '',
      });
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dialogRef.close(this.form.getRawValue());
  }
}
