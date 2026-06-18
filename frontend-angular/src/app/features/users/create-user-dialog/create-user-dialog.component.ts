import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { CommonModule } from '@angular/common';
import { firstValueFrom, forkJoin } from 'rxjs';
import { UsersApiService } from '../../../core/services/users-api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RecaptchaService } from '../../../core/services/recaptcha.service';
import { RolesApiService } from '../../../core/services/roles-api.service';
import { EmpresasService } from '../../../core/services/empresas.service';
import { UserRoleApiService } from '../../../core/services/user-role-api.service';
import { RegisterRequest } from '../../../core/models/api.models';
import { Role } from '../../../core/models/role.model';
import { Empresa } from '../../../core/models/negocio.models';

@Component({
  selector: 'app-create-user-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  template: `
    <div class="dialog-header">
      <h2 mat-dialog-title>Nuevo usuario</h2>
      <button mat-icon-button mat-dialog-close type="button" [disabled]="saving">
        <mat-icon>close</mat-icon>
      </button>
    </div>
    <form [formGroup]="form" (ngSubmit)="save()">
      <div mat-dialog-content class="dialog-body">
        <mat-form-field appearance="outline">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="name" autocomplete="given-name" />
          @if (form.controls.name.touched && form.controls.name.invalid) {
            <mat-error>Requerido (mín. 2 caracteres)</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Apellido</mat-label>
          <input matInput formControlName="lastname" autocomplete="family-name" />
          @if (form.controls.lastname.touched && form.controls.lastname.invalid) {
            <mat-error>Requerido (mín. 2 caracteres)</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Correo</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="email" />
          @if (form.controls.email.touched && form.controls.email.invalid) {
            <mat-error>Correo válido requerido</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Contraseña</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="new-password" />
          <mat-hint>Mayúscula, minúscula, número y carácter especial</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Confirmar contraseña</mat-label>
          <input matInput type="password" formControlName="confirmPassword" autocomplete="new-password" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Roles (opcional)</mat-label>
          <mat-select multiple [value]="selectedRoleIds()" (valueChange)="selectedRoleIds.set($event)">
            @for (r of roles(); track r.id) {
              <mat-option [value]="r.id">{{ r.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (mostrarSelectorEmpresa()) {
          <mat-form-field appearance="outline">
            <mat-label>Empresa que administrará *</mat-label>
            <mat-select [value]="empresaSeleccionada()?.id ?? null" (valueChange)="onEmpresaChange($event)">
              <mat-option [value]="null">— Selecciona una empresa —</mat-option>
              @for (e of empresas(); track e.id) {
                <mat-option [value]="e.id">{{ e.nombre }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
      </div>
      <div mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close [disabled]="saving">Cancelar</button>
        <button mat-raised-button color="primary" type="submit" [disabled]="saving || form.invalid">
          @if (saving) {
            <mat-spinner diameter="20" />
          } @else {
            Crear
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
      font-size: 1.25rem;
    }
    .dialog-body {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: min(420px, calc(100vw - 48px));
      box-sizing: border-box;
    }
    mat-form-field {
      width: 100%;
    }
  `,
})
export class CreateUserDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly usersApi = inject(UsersApiService);
  private readonly notify = inject(NotificationService);
  private readonly recaptcha = inject(RecaptchaService);
  private readonly rolesApi = inject(RolesApiService);
  private readonly empresasSvc = inject(EmpresasService);
  private readonly userRoleApi = inject(UserRoleApiService);
  readonly dialogRef = inject(MatDialogRef<CreateUserDialogComponent, boolean>);

  saving = false;

  roles = signal<Role[]>([]);
  selectedRoleIds = signal<string[]>([]);
  empresas = signal<Empresa[]>([]);
  empresaSeleccionada = signal<Empresa | null>(null);

  readonly rolesSeleccionados = computed(() =>
    this.roles().filter(r => r.id ? this.selectedRoleIds().includes(r.id) : false)
  );

  readonly mostrarSelectorEmpresa = computed(() =>
    this.rolesSeleccionados().some(r => r.name?.toLowerCase().includes('administrador empresa'))
  );

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    lastname: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.rolesApi.list().subscribe(r => this.roles.set(r));
    this.empresasSvc.list().subscribe(e => this.empresas.set(e));
  }

  onEmpresaChange(empresaId: number | null): void {
    const empresa = this.empresas().find(e => e.id === empresaId) ?? null;
    this.empresaSeleccionada.set(empresa);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    if (v.password !== v.confirmPassword) {
      this.notify.error('Las contraseñas no coinciden');
      return;
    }
    let recaptchaToken = '';
    if (this.recaptcha.isConfigured()) {
      try {
        recaptchaToken = await this.recaptcha.execute('register');
      } catch {
        this.notify.error('No se pudo obtener reCAPTCHA');
        return;
      }
    }
    const body: RegisterRequest = {
      name: v.name,
      lastname: v.lastname,
      email: v.email,
      password: v.password,
      confirmPassword: v.confirmPassword,
      recaptchaToken,
    };
    this.saving = true;
    try {
      const res = await firstValueFrom(this.usersApi.create(body));
      const userId = res.userId;

      if (userId && this.selectedRoleIds().length > 0) {
        const assigns = this.selectedRoleIds().map(roleId => this.userRoleApi.assign(userId, roleId));
        await firstValueFrom(forkJoin(assigns));
      }

      if (userId && this.mostrarSelectorEmpresa() && this.empresaSeleccionada()) {
        const e = this.empresaSeleccionada()!;
        await firstValueFrom(
          this.usersApi.asignarEmpresa(userId, String(e.id), e.nombre ?? '')
        );
      }

      this.notify.success(res.message ?? 'Usuario creado correctamente');
      this.dialogRef.close(true);
    } catch {
      /* el interceptor de errores muestra el detalle */
    } finally {
      this.saving = false;
    }
  }
}
