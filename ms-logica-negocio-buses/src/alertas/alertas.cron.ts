import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertasService } from './alertas.service';

@Injectable()
export class AlertasCron {
  private readonly logger = new Logger(AlertasCron.name);

  constructor(private readonly alertasService: AlertasService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    try {
      await this.alertasService.procesarPendientes();
    } catch (error: any) {
      this.logger.error('Error al procesar alertas pendientes', error.stack);
    }
  }
}
