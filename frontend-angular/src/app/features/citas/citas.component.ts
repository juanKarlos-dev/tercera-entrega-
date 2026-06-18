import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { CitasService } from '../../core/services/citas.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-citas',
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
  ],
  templateUrl: './citas.component.html',
  styleUrls: ['./citas.component.scss'],
})
export class CitasComponent implements OnInit {
  private readonly citasSvc = inject(CitasService);
  private readonly notifSvc = inject(NotificationService);

  readonly tiposAtencion  = ['Presencial', 'Virtual'];
  readonly tiposConsulta  = ['Problema con tarjeta', 'Reclamo', 'Reembolso', 'Otro'];
  readonly horasBase = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  ];

  nombre           = signal('');
  email            = signal('');
  tipoAtencion     = signal('Presencial');
  tipoConsulta     = signal('Problema con tarjeta');
  motivo           = signal('');
  fechaSeleccionada = signal('');
  horaSeleccionada  = signal('');
  enviando         = signal(false);
  citaConfirmada   = signal(false);

  diasDisponibles = signal<{ date: string; label: string }[]>([]);
  ocupados = signal<{ start: string; end: string }[]>([]);
  cargandoDisponibilidad = signal(false);

  readonly horasDelDia = computed(() => {
    const fecha = this.fechaSeleccionada();
    if (!fecha) return [];
    
    return this.horasBase.map(h => {
      const slotStart = new Date(`${fecha}T${h}:00`).getTime();
      const slotEnd = slotStart + 30 * 60 * 1000;
      
      const isOcupado = this.ocupados().some(o => {
        if (!o.start || !o.end) return false;
        const oStart = new Date(o.start).getTime();
        const oEnd = new Date(o.end).getTime();
        return slotStart < oEnd && slotEnd > oStart;
      });

      const isPast = slotStart < Date.now();

      return {
        hora: h,
        disponible: !isOcupado && !isPast
      };
    });
  });

  ngOnInit(): void {
    this.generarDias();
    this.cargarDisponibilidad();
  }

  generarDias(): void {
    const dias = [];
    const cur = new Date();
    while (dias.length < 10) {
      if (cur.getDay() !== 0 && cur.getDay() !== 6) {
        const iso = cur.toISOString().split('T')[0];
        const label = cur.toLocaleDateString('es-ES', { weekday: 'short', month: 'short', day: 'numeric' });
        dias.push({ date: iso, label });
      }
      cur.setDate(cur.getDate() + 1);
    }
    this.diasDisponibles.set(dias);
  }

  cargarDisponibilidad(): void {
    this.cargandoDisponibilidad.set(true);
    this.citasSvc.consultarDisponibilidad().subscribe({
      next: res => {
        this.ocupados.set(res.ocupados || []);
        this.cargandoDisponibilidad.set(false);
      },
      error: () => {
        this.ocupados.set([]);
        this.cargandoDisponibilidad.set(false);
      }
    });
  }

  onSelectFecha(d: string): void {
    this.fechaSeleccionada.set(d);
    this.horaSeleccionada.set('');
  }

  onSelectHora(h: string, disp: boolean): void {
    if (disp) this.horaSeleccionada.set(h);
  }

  horaFinDisplay(hora: string): string {
    if (!hora) return '';
    const [h, m] = hora.split(':').map(Number);
    const totalMin = h * 60 + m + 30;
    return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
  }

  agendarCita(): void {
    if (!this.nombre().trim() || !this.email().trim() || !this.motivo().trim()
        || !this.fechaSeleccionada() || !this.horaSeleccionada()) {
      this.notifSvc.error('Completa todos los campos');
      return;
    }

    const [h, m] = this.horaSeleccionada().split(':').map(Number);
    const totalMin = h * 60 + m + 30;
    const finH = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const finM = String(totalMin % 60).padStart(2, '0');

    const fechaHora = `${this.fechaSeleccionada()}T${this.horaSeleccionada()}:00-05:00`;
    const fechaHoraFin = `${this.fechaSeleccionada()}T${finH}:${finM}:00-05:00`;

    this.enviando.set(true);
    this.citasSvc.agendarCita({
      nombre:       this.nombre(),
      email:        this.email(),
      tipoAtencion: this.tipoAtencion() as 'Presencial' | 'Virtual',
      tipoConsulta: this.tipoConsulta() as 'Problema con tarjeta' | 'Reclamo' | 'Reembolso' | 'Otro',
      motivo:       this.motivo(),
      fechaHora,
      fechaHoraFin,
    }).subscribe({
      next: () => {
        this.ocupados.update(occ => [...occ, { start: fechaHora, end: fechaHoraFin }]);
        this.citaConfirmada.set(true);
        this.notifSvc.success('Cita agendada');
        this.enviando.set(false);
      },
      error: () => {
        this.notifSvc.error('No se pudo agendar. Intenta de nuevo.');
        this.enviando.set(false);
      },
    });
  }

  nuevaCita(): void {
    this.citaConfirmada.set(false);
    this.nombre.set('');
    this.email.set('');
    this.tipoAtencion.set('Presencial');
    this.tipoConsulta.set('Problema con tarjeta');
    this.motivo.set('');
    this.fechaSeleccionada.set('');
    this.horaSeleccionada.set('');
  }
}
