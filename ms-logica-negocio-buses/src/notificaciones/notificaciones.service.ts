import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(private readonly http: HttpService) {}

  async notificarIncidenteGrave(params: {
    supervisorEmail: string;
    busPlaca: string;
    incidenteCodigo: string;
    gravedad: string;
    tipo: string;
    descripcion?: string;
  }): Promise<void> {
    const notificationsUrl =
      process.env.NOTIFICATIONS_URL ?? 'http://localhost:3002';
    const supervisorEmail =
      params.supervisorEmail ||
      process.env.SUPERVISOR_EMAIL ||
      'supervisor@empresa.com';

    try {
      await firstValueFrom(
        this.http.post(
          `${notificationsUrl}/send-email`,
          {
            to: supervisorEmail,
            subject: `🚨 Incidente ${params.gravedad} - Bus ${params.busPlaca}`,
            html: true,
            body: `
            <h2>Incidente reportado</h2>
            <p><b>Código:</b> ${params.incidenteCodigo}</p>
            <p><b>Bus:</b> ${params.busPlaca}</p>
            <p><b>Gravedad:</b> ${params.gravedad}</p>
            <p><b>Tipo:</b> ${params.tipo}</p>
            <p><b>Descripción:</b> ${params.descripcion ?? 'Sin descripción'}</p>
          `,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': process.env.NOTIFICATIONS_API_KEY ?? '',
            },
          },
        ),
      );
      this.logger.log(
        `[Notificaciones] Email enviado para incidente ${params.incidenteCodigo}`,
      );
    } catch (error) {
      this.logger.warn(
        `[Notificaciones] No se pudo enviar email: ${(error as Error)?.message}`,
      );
    }
  }

  async notificarMasivo(params: {
    destinatarios: string[];
    asunto: string;
    mensaje: string;
    urgente: boolean;
  }): Promise<{ enviados: number; fallidos: number; total: number }> {
    if (params.destinatarios.length === 0) {
      return { enviados: 0, fallidos: 0, total: 0 };
    }

    const notificationsUrl = process.env.NOTIFICATIONS_URL ?? 'http://localhost:3002';
    const subject = params.urgente ? `🚨 URGENTE: ${params.asunto}` : params.asunto;

    const resultados = await Promise.allSettled(
      params.destinatarios.map(email =>
        firstValueFrom(
          this.http.post(
            `${notificationsUrl}/send-email`,
            {
              to: email,
              subject,
              html: true,
              body: params.mensaje,
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.NOTIFICATIONS_API_KEY ?? '',
              },
            },
          ),
        ),
      ),
    );

    const enviados = resultados.filter(r => r.status === 'fulfilled').length;
    const fallidos = resultados.filter(r => r.status === 'rejected').length;
    this.logger.log(`[Notificaciones] Masiva: ${enviados}/${params.destinatarios.length} enviados`);
    return { enviados, fallidos, total: params.destinatarios.length };
  }

  async notificarBusProximo(params: {
    email: string;
    rutaNombre: string;
    paraderoNombre: string;
    tiempoMinutos: number;
    placaBus: string;
  }): Promise<void> {
    const notificationsUrl =
      process.env.NOTIFICATIONS_URL ?? 'http://localhost:3002';
    try {
      await firstValueFrom(
        this.http.post(
          `${notificationsUrl}/notificar-bus-proximo`,
          {
            to: params.email,
            rutaNombre: params.rutaNombre,
            paraderoNombre: params.paraderoNombre,
            tiempoMinutos: params.tiempoMinutos,
            placaBus: params.placaBus,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': process.env.NOTIFICATIONS_API_KEY ?? '',
            },
          },
        ),
      );
      this.logger.log(
        `[Notificaciones] Email bus próximo enviado a ${params.email}`,
      );
    } catch (error) {
      this.logger.warn(
        `[Notificaciones] No se pudo enviar email bus próximo: ${(error as Error)?.message}`,
      );
    }
  }
}
