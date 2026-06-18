import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NotificationService } from '../../../core/services/notification.service';
import { Pqrs, PqrsService } from '../../../core/services/pqrs.service';

@Component({
  selector: 'app-pqrs-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatDialogModule,
  ],
  templateUrl: './pqrs-admin.component.html',
  styleUrls: ['./pqrs-admin.component.scss'],
})
export class PqrsAdminComponent implements OnInit {
  private readonly pqrsSvc = inject(PqrsService);
  private readonly notifSvc = inject(NotificationService);

  pqrsList = signal<Pqrs[]>([]);
  filtroEstado = signal<string>('');
  filtroCategoria = signal<string>('');

  estados = ['PENDIENTE', 'EN_REVISION', 'EN_PROCESO', 'RESUELTO'];
  categorias = ['CONDUCTOR', 'BUS', 'RUTA', 'TARJETA', 'OTRO'];

  displayedColumns: string[] = ['radicado', 'fecha', 'tipo', 'categoria', 'email', 'estado', 'acciones'];

  // Removemos el computed() local que filtraba en memoria.
  // Ahora usaremos directamente pqrsList en el template.

  // Modal manual state
  pqrsSeleccionada = signal<Pqrs | null>(null);
  nuevoEstadoSeleccionado = signal<string>('');
  respuestaResuelto = signal<string>('');
  isModalOpen = signal<boolean>(false);

  ngOnInit(): void {
    this.cargarPqrs();
  }

  cambioFiltro(): void {
    this.cargarPqrs();
  }

  cargarPqrs(): void {
    this.pqrsSvc.obtenerTodos(this.filtroEstado(), this.filtroCategoria()).subscribe({
      next: (data) => this.pqrsList.set(data),
      error: () => this.notifSvc.error('Error al cargar la lista de PQRS'),
    });
  }

  iniciarCambioEstado(pqrs: Pqrs, event: any): void {
    const estadoAntiguo = pqrs.estado;
    const estadoNuevo = event.value; // de mat-select

    if (estadoAntiguo === estadoNuevo) return;

    this.pqrsSeleccionada.set(pqrs);
    this.nuevoEstadoSeleccionado.set(estadoNuevo);

    if (estadoNuevo === 'RESUELTO') {
      this.respuestaResuelto.set('');
      this.isModalOpen.set(true);
    } else {
      // Cambio directo para otros estados
      this.ejecutarCambioEstado();
    }
  }

  ejecutarCambioEstado(): void {
    const pqrs = this.pqrsSeleccionada();
    const estado = this.nuevoEstadoSeleccionado();
    const respuesta = this.respuestaResuelto();

    if (!pqrs) return;
    if (estado === 'RESUELTO' && !respuesta.trim()) {
      this.notifSvc.error('Debe ingresar una respuesta al marcar como RESUELTO');
      return;
    }

    this.pqrsSvc.cambiarEstado(pqrs.id, { estado, respuesta: respuesta || undefined }).subscribe({
      next: (actualizada) => {
        this.notifSvc.success(`Estado actualizado a ${estado}`);
        this.pqrsList.update(list => list.map(p => p.id === actualizada.id ? actualizada : p));
        this.cerrarModal();
      },
      error: () => {
        this.notifSvc.error('Error al actualizar el estado');
        // Revertir selector
        this.cargarPqrs();
        this.cerrarModal();
      }
    });
  }

  cerrarModal(): void {
    this.isModalOpen.set(false);
    this.pqrsSeleccionada.set(null);
    this.respuestaResuelto.set('');
  }

  cancelarCambio(): void {
    this.cerrarModal();
    this.cargarPqrs(); // recargar para revertir el mat-select a su estado original
  }
}
