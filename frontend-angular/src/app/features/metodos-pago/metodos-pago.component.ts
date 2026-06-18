import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../core/services/auth.service';
import { MetodosPagoService } from '../../core/services/metodos-pago.service';
import { CiudadanosService } from '../../core/services/ciudadanos.service';
import { NotificationService } from '../../core/services/notification.service';
import { MetodoPago, MetodoPagoCiudadano, Ciudadano, RecargaResponse } from '../../core/models/negocio.models';

@Component({
  selector: 'app-metodos-pago',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatSelectModule, MatTabsModule,
    MatTooltipModule, MatDividerModule,
  ],
  templateUrl: './metodos-pago.component.html',
  styleUrls: ['./metodos-pago.component.scss'],
})
export class MetodosPagoComponent implements OnInit, OnDestroy {
  private readonly auth          = inject(AuthService);
  private readonly svc           = inject(MetodosPagoService);
  private readonly ciudadanosSvc = inject(CiudadanosService);
  private readonly notify        = inject(NotificationService);
  private readonly fb            = inject(FormBuilder);

  readonly esCiudadano = computed(() =>
    this.auth.roleDisplayNames().some(r => r.toLowerCase().includes('ciudadano'))
  );

  metodos       = signal<MetodoPago[]>([]);
  ciudadanos    = signal<Ciudadano[]>([]);
  metodosPropios = signal<MetodoPagoCiudadano[]>([]);
  sinPerfilCiudadano = signal(false);

  columns        = ['nombre', 'tipo', 'activo'];
  columnsPropios = ['mpNombre', 'mpCodigo', 'mpTipo', 'mpSaldo'];
  tipos = ['TARJETA_PREPAGADA', 'QR', 'EFECTIVO'];

  crearForm = this.fb.group({
    nombre:  ['', Validators.required],
    tipo:    ['TARJETA_PREPAGADA', Validators.required],
  });

  asignarForm = this.fb.group({
    ciudadanoId:   [null as number | null, Validators.required],
    metodoPagoId:  [null as number | null, Validators.required],
    saldoInicial:  [0, [Validators.required, Validators.min(0)]],
  });

  ciudadanoIdBusqueda   = signal<number | null>(null);
  metodosDelCiudadano   = signal<MetodoPagoCiudadano[]>([]);
  columnsConsultar      = ['metodoPago', 'codigo', 'tipo', 'saldo'];

  montosPredef = [10000, 20000, 50000, 100000];

  ciudadanoRecargaId         = signal<number | null>(null);
  metodosParaRecargar        = signal<MetodoPagoCiudadano[]>([]);
  metodoPagoCiudadanoId      = signal<number | null>(null);
  montoRecarga               = signal<number | null>(null);
  recargaResp                = signal<RecargaResponse | null>(null);
  cargandoMetodosRecarga     = signal(false);
  descripcionRecarga         = '';
  private epaycoObserver: MutationObserver | null = null;
  private webhookYaDisparado = false;
  private pagoAprobadoPorEpayco = false;
  private epaycoMessageListener: ((e: MessageEvent) => void) | null = null;
  private saldoAntesDeRecarga = 0;

  ngOnInit(): void {
    this.svc.listar().subscribe(d => this.metodos.set(d));
    this.ciudadanosSvc.list().subscribe(d => {
      this.ciudadanos.set(d);
      if (this.esCiudadano()) {
        const email = this.auth.payload()?.email;
        const found = d.find(c => c.email?.toLowerCase() === email?.toLowerCase()) ?? null;
        if (found?.id != null) {
          this.sinPerfilCiudadano.set(false);
          this.svc.getByciudadano(found.id).subscribe(m => this.metodosPropios.set(m));
          this.onCiudadanoRecargaChange(found.id);
        } else {
          this.sinPerfilCiudadano.set(true);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.epaycoObserver?.disconnect();
    if (this.epaycoMessageListener) {
      window.removeEventListener('message', this.epaycoMessageListener);
      this.epaycoMessageListener = null;
    }
  }

  crear(): void {
    if (this.crearForm.invalid) return;
    this.svc.crear(this.crearForm.value as any).subscribe({
      next: () => {
        this.notify.success('Método de pago creado');
        this.svc.listar().subscribe(d => this.metodos.set(d));
        this.crearForm.reset({ tipo: 'TARJETA_PREPAGADA' });
      }
    });
  }

  asignar(): void {
    if (this.asignarForm.invalid) return;
    const { ciudadanoId, metodoPagoId, saldoInicial } = this.asignarForm.value;
    this.svc.asignarCiudadano(ciudadanoId!, metodoPagoId!, Number(saldoInicial) ?? 0).subscribe({
      next: () => { this.notify.success('Asignado correctamente'); this.asignarForm.reset({ saldoInicial: 0 }); }
    });
  }

  buscarPorCiudadano(): void {
    const id = this.ciudadanoIdBusqueda();
    if (!id) return;
    this.svc.getByciudadano(id).subscribe(d => this.metodosDelCiudadano.set(d));
  }

  onCiudadanoRecargaChange(id: number | null): void {
    this.ciudadanoRecargaId.set(id);
    this.metodoPagoCiudadanoId.set(null);
    this.metodosParaRecargar.set([]);
    this.recargaResp.set(null);
    if (!id) return;
    this.cargandoMetodosRecarga.set(true);
    this.svc.getByciudadano(id).subscribe({
      next: lista => {
        this.metodosParaRecargar.set(lista.filter(m => m.metodoPago?.tipo === 'TARJETA_PREPAGADA'));
        this.cargandoMetodosRecarga.set(false);
      },
      error: () => this.cargandoMetodosRecarga.set(false),
    });
  }

  setMonto(m: number): void { this.montoRecarga.set(m); }

  recargar(): void {
    const ciudadanoId        = this.ciudadanoRecargaId();
    const metodoPagoCiudadanoId = this.metodoPagoCiudadanoId();
    const monto              = this.montoRecarga();

    if (!ciudadanoId || !metodoPagoCiudadanoId || !monto) {
      this.notify.warning('Selecciona ciudadano, tarjeta y monto');
      return;
    }
    if (monto < 5000) { this.notify.warning('Monto mínimo de recarga: $5.000'); return; }

    this.saldoAntesDeRecarga = this.saldoSeleccionado() ?? 0;

    this.svc.recargar({ ciudadanoId, metodoPagoCiudadanoId, monto }).subscribe({
      next: resp => {
        this.recargaResp.set(resp);
        this.descripcionRecarga = resp.descripcion ?? '';
        this.notify.info('Recarga iniciada — abriendo pasarela ePayco...');
        this.submitEpaycoForm(resp, monto);
      }
    });
  }

  saldoSeleccionado(): number | undefined {
    const id = this.metodoPagoCiudadanoId();
    return this.metodosParaRecargar().find(m => m.id === id)?.saldo;
  }

  saldoDespuesRecarga(): number | undefined {
    const saldo = this.saldoSeleccionado();
    const monto = this.montoRecarga();
    if (saldo === undefined || !monto) return undefined;
    return saldo + monto;
  }

  nombreCiudadano(c: Ciudadano): string {
    if (c.nombre || c.apellido) return `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim();
    return `${c.persona?.nombres ?? ''} ${c.persona?.apellidos ?? ''}`.trim();
  }

  private dispararWebhookExito(): void {
    if (this.webhookYaDisparado) return;
    this.webhookYaDisparado = true;
    this.epaycoObserver?.disconnect();
    this.epaycoObserver = null;
    this.svc.webhookEpayco({
      x_cod_response: '1',
      x_description:  this.descripcionRecarga,
      x_amount:        String(this.montoRecarga()),
    }).subscribe({
      next: () => {
        this.notify.success('Saldo recargado exitosamente');
        this.onCiudadanoRecargaChange(this.ciudadanoRecargaId());
      }
    });
  }

  private submitEpaycoForm(resp: RecargaResponse, monto: number): void {
    const ePayco = (window as any).ePayco;
    if (!ePayco) {
      this.notify.warning('El widget de ePayco no está disponible. Verifica tu conexión.');
      return;
    }

    // Reset flags para este intento
    this.webhookYaDisparado = false;
    this.pagoAprobadoPorEpayco = false;
    this.epaycoObserver?.disconnect();

    // Remover listener anterior si existía
    if (this.epaycoMessageListener) {
      window.removeEventListener('message', this.epaycoMessageListener);
    }

    // postMessage: ePayco puede enviar el resultado como mensaje al window padre
    this.epaycoMessageListener = (event: MessageEvent) => {
      const data = event.data;
      if (!data) return;
      if (Number(data.x_cod_response) === 1 || data.x_response === 'Aceptada') {
        this.pagoAprobadoPorEpayco = true;
        this.dispararWebhookExito();
      }
    };
    window.addEventListener('message', this.epaycoMessageListener);

    const handler = ePayco.checkout.configure({
      key:  resp.publicKey ?? '',
      test: resp.test === '1' || resp.test === 'true',
    });
    handler.open({
      name:          'Recarga TransporteYA',
      description:   resp.descripcion ?? `Recarga $${monto}`,
      invoice:       resp.referencia ?? '',
      currency:      'cop',
      amount:        String(resp.monto ?? monto),
      tax_base:      String(resp.monto ?? monto),
      tax:           '0',
      country:       'co',
      lang:          'es',
      external:      'false',
      response:      (data: any) => {
        if (Number(data?.x_cod_response) === 1 || data?.x_response === 'Aceptada') {
          this.pagoAprobadoPorEpayco = true;
          this.dispararWebhookExito();
        }
      },
      confirmation:  `${window.location.origin}/api/v1/metodos-pago/webhook-epayco`,
      email_billing: resp.email ?? '',
    });

    this.epaycoObserver = new MutationObserver(() => {
      const iframe = document.querySelector('iframe[src*="epayco"]');
      if (!iframe) {
        this.epaycoObserver?.disconnect();
        this.epaycoObserver = null;
        if (this.epaycoMessageListener) {
          window.removeEventListener('message', this.epaycoMessageListener);
          this.epaycoMessageListener = null;
        }

        setTimeout(() => {
          if (this.webhookYaDisparado) return; // response/postMessage ya lo gestionó
          this.webhookYaDisparado = true;
          this.svc.webhookEpayco({
            x_cod_response: '1',
            x_description:  this.descripcionRecarga,
            x_amount:       String(this.montoRecarga()),
          }).subscribe({
            next: (resp: any) => {
              const nuevoSaldo = resp?.nuevoSaldo ?? resp?.data?.nuevoSaldo;
              if (nuevoSaldo != null && nuevoSaldo > this.saldoAntesDeRecarga) {
                this.notify.success('Saldo recargado exitosamente');
                this.onCiudadanoRecargaChange(this.ciudadanoRecargaId());
              }
              // saldo igual o sin cambio → fue cancelada, no mostrar nada
            }
          });
        }, 2000);
      }
    });
    this.epaycoObserver.observe(document.body, { childList: true, subtree: true });
  }
}
