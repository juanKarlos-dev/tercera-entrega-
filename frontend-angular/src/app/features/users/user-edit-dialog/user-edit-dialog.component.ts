import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { UserWithRolesResponse } from '../../../core/models/api.models';
import { UsersApiService } from '../../../core/services/users-api.service';
import { NotificationService } from '../../../core/services/notification.service';

export interface UserEditDialogData {
  user: UserWithRolesResponse;
}

@Component({
  selector: 'app-user-edit-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>Editar usuario</h2>
      <button mat-icon-button mat-dialog-close type="button" [disabled]="saving"><mat-icon>close</mat-icon></button>
    </div>
    <form [formGroup]="form" (ngSubmit)="save()">
      <div mat-dialog-content class="dialog-body">
        <mat-form-field appearance="outline">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="name" />
          @if (form.controls.name.touched && form.controls.name.invalid) {
            <mat-error>Requerido</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Apellido</mat-label>
          <input matInput formControlName="lastname" />
          @if (form.controls.lastname.touched && form.controls.lastname.invalid) {
            <mat-error>Requerido</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Correo</mat-label>
          <input matInput [value]="data.user.email" disabled />
          <mat-hint>No modificable desde aquí</mat-hint>
        </mat-form-field>
      </div>
      <div mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close [disabled]="saving">Cancelar</button>
        <button mat-raised-button color="primary" type="submit" [disabled]="saving || form.invalid">
          @if (saving) {
            <mat-spinner diameter="20" />
          } @else {
            Guardar
          }
        </button>
      </div>
    </form>
  `,
  styles: `
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1rem 0;
    }
    h2 {
      margin: 0;
    }
    .dialog-body {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: min(400px, calc(100vw - 48px));
      box-sizing: border-box;
    }
    mat-form-field {
      width: 100%;
    }
  `,
})
export class UserEditDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly usersApi = inject(UsersApiService);
  private readonly notify = inject(NotificationService);
  readonly dialogRef = inject(MatDialogRef<UserEditDialogComponent, boolean>);

  saving = false;

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    lastname: ['', Validators.required],
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: UserEditDialogData) {
    this.form.patchValue({
      name: data.user.name ?? '',
      lastname: data.user.lastname ?? '',
    });
  }

  async save(): Promise<void> {
    if (!this.data.user.id || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    try {
      const v = this.form.getRawValue();
      await firstValueFrom(
        this.usersApi.update(this.data.user.id, { name: v.name, lastname: v.lastname }),
      );
      this.notify.success('Usuario actualizado correctamente');
      this.dialogRef.close(true);
    } catch {
      /* snackbar desde interceptor */
    } finally {
      this.saving = false;
    }
  }
}
