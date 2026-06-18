import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { NotificationService } from '../../core/services/notification.service';
import { Pqrs, PqrsService } from '../../core/services/pqrs.service';

@Component({
  selector: 'app-pqrs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTabsModule,
  ],
  templateUrl: './pqrs.component.html',
  styleUrls: ['./pqrs.component.scss'],
})
export class PqrsComponent {
  private readonly pqrsSvc  = inject(PqrsService);
  private readonly notifSvc = inject(NotificationService);

  readonly tiposOpciones      = ['PETICION', 'QUEJA', 'RECLAMO', 'SUGERENCIA'];
  readonly categoriasOpciones = ['CONDUCTOR', 'BUS', 'RUTA', 'TARJETA', 'OTRO'];

  readonly labelTipo: Record<string, string> = {
    PETICION: 'Petición', QUEJA: 'Queja', RECLAMO: 'Reclamo', SUGERENCIA: 'Sugerencia',
  };
  readonly labelCategoria: Record<string, string> = {
    CONDUCTOR: 'Conductor', BUS: 'Bus', RUTA: 'Ruta', TARJETA: 'Tarjeta', OTRO: 'Otro',
  };

  tabActiva       = signal<number>(0);
  tipo            = signal<string>('');
  categoria       = signal<string>('');
  descripcion     = signal<string>('');
  emailContacto   = signal<string>('');
  enviando        = signal<boolean>(false);
  radicadoCreado  = signal<string | null>(null);

  fotos           = signal<File[]>([]);
  fotosPreview    = signal<string[]>([]);

  radicadoBuscar  = signal<string>('');
  pqrsBuscado     = signal<Pqrs | null>(null);
  buscando        = signal<boolean>(false);
  errorBusqueda   = signal<string | null>(null);

  onFilesSelected(event: any): void {
    const newFiles: File[] = Array.from(event.target.files || []);
    if (!newFiles.length) return;

    const currentFotos = this.fotos();
    if (currentFotos.length + newFiles.length > 3) {
      this.notifSvc.error('Puedes adjuntar máximo 3 fotografías');
      return;
    }

    const validFiles = newFiles.filter(f => f.type.startsWith('image/'));
    if (validFiles.length !== newFiles.length) {
      this.notifSvc.error('Solo se permiten imágenes');
    }

    this.fotos.update(prev => [...prev, ...validFiles].slice(0, 3));

    // Generar previews
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          this.fotosPreview.update(prev => [...prev, e.target!.result as string].slice(0, 3));
        }
      };
      reader.readAsDataURL(file);
    });

    event.target.value = ''; // Reset input
  }

  eliminarFoto(index: number): void {
    this.fotos.update(prev => prev.filter((_, i) => i !== index));
    this.fotosPreview.update(prev => prev.filter((_, i) => i !== index));
  }

  enviarPqrs(): void {
    if (!this.tipo() || !this.categoria() || !this.descripcion().trim() || !this.emailContacto().trim()) {
      this.notifSvc.error('Completa todos los campos requeridos');
      return;
    }
    this.enviando.set(true);

    const formData = new FormData();
    formData.append('tipo', this.tipo());
    formData.append('categoria', this.categoria());
    formData.append('descripcion', this.descripcion());
    formData.append('email', this.emailContacto());

    this.fotos().forEach((file) => {
      formData.append('files', file);
    });

    this.pqrsSvc.crear(formData).subscribe({
      next: pqrs => {
        this.radicadoCreado.set(pqrs.radicado);
        this.tipo.set('');
        this.categoria.set('');
        this.descripcion.set('');
        this.emailContacto.set('');
        this.fotos.set([]);
        this.fotosPreview.set([]);
        this.enviando.set(false);
      },
      error: () => {
        this.notifSvc.error('No se pudo enviar la PQRS');
        this.enviando.set(false);
      },
    });
  }

  nuevaPqrs(): void {
    this.radicadoCreado.set(null);
  }

  consultarPqrs(): void {
    if (!this.radicadoBuscar().trim()) return;
    this.buscando.set(true);
    this.errorBusqueda.set(null);
    this.pqrsBuscado.set(null);
    this.pqrsSvc.consultar(this.radicadoBuscar().trim()).subscribe({
      next: pqrs => {
        this.pqrsBuscado.set(pqrs);
        this.buscando.set(false);
      },
      error: () => {
        this.errorBusqueda.set('No se encontró un PQRS con ese radicado');
        this.buscando.set(false);
      },
    });
  }

  colorEstado(estado: string): string {
    switch (estado) {
      case 'PENDIENTE':   return 'estado-pendiente';
      case 'EN_REVISION': return 'estado-revision';
      case 'EN_PROCESO':  return 'estado-proceso';
      case 'RESUELTO':    return 'estado-resuelto';
      default:            return '';
    }
  }
}
