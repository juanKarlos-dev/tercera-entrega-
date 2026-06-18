import { Component, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { ReportesService } from '../../core/services/reportes.service';
import { NotificationService } from '../../core/services/notification.service';
import { ReporteIngresosPorMetodo, ReporteDistribucionEtaria, ReporteTendenciaIncidentes } from '../../core/models/negocio.models';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule, MatTabsModule, MatProgressSpinnerModule, MatSelectModule, MatFormFieldModule],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.scss'],
})
export class ReportesComponent implements OnInit, OnDestroy {
  @ViewChild('ingresosChart') ingresosChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('etariaChart')   etariaChartRef!:   ElementRef<HTMLCanvasElement>;
  @ViewChild('tendenciaChart') tendenciaChartRef!: ElementRef<HTMLCanvasElement>;

  private readonly svc    = inject(ReportesService);
  private readonly notify = inject(NotificationService);
  private readonly cdr    = inject(ChangeDetectorRef);

  ingresos  = signal<ReporteIngresosPorMetodo[]>([]);
  etaria    = signal<ReporteDistribucionEtaria[]>([]);
  tendencia = signal<ReporteTendenciaIncidentes[]>([]);
  loading   = signal(false);
  meses     = signal<3 | 6 | 12>(12);
  readonly mesesOpciones: (3 | 6 | 12)[] = [3, 6, 12];

  private chartIngresos?:  Chart;
  private chartEtaria?:    Chart;
  private chartTendencia?: Chart;

  ngOnInit(): void { this.cargarTodo(); }

  ngOnDestroy(): void {
    this.chartIngresos?.destroy();
    this.chartEtaria?.destroy();
    this.chartTendencia?.destroy();
  }

  cargarTodo(): void {
    this.loading.set(true);
    let done = 0;
    const check = () => {
      if (++done === 3) {
        this.loading.set(false);
        this.cdr.detectChanges(); // fuerza que @if (!loading()) renderice los canvas antes de construir los charts
        this.renderCharts();
      }
    };
    this.svc.ingresosPorMetodo(this.meses()).subscribe({ next: d => { this.ingresos.set(d);  check(); }, error: () => check() });
    this.svc.distribucionEtaria().subscribe({ next: d => { this.etaria.set(d);   check(); }, error: () => check() });
    this.svc.tendenciaIncidentes().subscribe({ next: d => { this.tendencia.set(d); check(); }, error: () => check() });
  }

  private renderCharts(): void {
    this.buildIngresosChart();
    this.buildEtariaChart();
    this.buildTendenciaChart();
  }

  private buildIngresosChart(): void {
    if (!this.ingresosChartRef?.nativeElement || !this.ingresos().length) return;
    this.chartIngresos?.destroy();
    this.chartIngresos = new Chart(this.ingresosChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels: this.ingresos().map(d => d.metodo ?? ''),
        datasets: [
          { label: 'Total $',      data: this.ingresos().map(d => d.total ?? 0),    backgroundColor: '#2d3ef0', borderRadius: 8 },
          { label: 'Porcentaje %', data: this.ingresos().map(d => d.cantidad ?? 0), backgroundColor: '#818cf8', borderRadius: 8 },
        ],
      },
      options: { responsive: true, plugins: { legend: { position: 'top' } } },
    });
  }

  private buildEtariaChart(): void {
    if (!this.etariaChartRef?.nativeElement || !this.etaria().length) return;
    this.chartEtaria?.destroy();
    this.chartEtaria = new Chart(this.etariaChartRef.nativeElement, {
      type: 'pie',
      data: {
        labels: this.etaria().map(d => d.rango ?? ''),
        datasets: [{
          data: this.etaria().map(d => d.cantidad ?? 0),
          backgroundColor: ['#2d3ef0','#818cf8','#38bdf8','#34d399','#fb923c','#f87171'],
        }],
      },
      options: { responsive: true, plugins: { legend: { position: 'right' } } },
    });
  }

  private buildTendenciaChart(): void {
    if (!this.tendenciaChartRef?.nativeElement || !this.tendencia().length) return;
    this.chartTendencia?.destroy();
    this.chartTendencia = new Chart(this.tendenciaChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: [...new Set(this.tendencia().map(d => d.fecha ?? ''))],
        datasets: [{
          label: 'Incidentes',
          data: this.tendencia().map(d => d.total ?? 0),
          borderColor: '#2d3ef0',
          backgroundColor: 'rgba(45,62,240,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 5,
        }],
      },
      options: { responsive: true, plugins: { legend: { position: 'top' } } },
    });
  }

  exportar(tipo: 'ingresos-por-metodo-pago' | 'distribucion-etaria' | 'tendencia-incidentes'): void {
    this.svc.exportarCSV(tipo).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte-${tipo}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.notify.success('Reporte exportado');
      }
    });
  }
}
