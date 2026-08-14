import 'server-only';

import nodemailer from 'nodemailer';

import { logger } from '@/lib/logger';
import { serverEnv } from '@/lib/env';

/**
 * Mail behind an interface (SPEC §3), so the transport can change without
 * touching a single call site.
 *
 * Development uses the console transport: it logs the message and the link
 * rather than sending anything, which keeps invitation testing self-contained
 * and means a misconfigured dev environment cannot email a real person.
 */

export interface Mensaje {
  para: string;
  asunto: string;
  html: string;
  texto: string;
}

export interface MailService {
  enviar(mensaje: Mensaje): Promise<void>;
}

class ConsoleMailService implements MailService {
  enviar(mensaje: Mensaje): Promise<void> {
    logger.info(
      { para: mensaje.para, asunto: mensaje.asunto, cuerpo: mensaje.texto },
      'Correo (transporte de consola — no se ha enviado nada)',
    );
    return Promise.resolve();
  }
}

class SmtpMailService implements MailService {
  private readonly transporte;

  constructor(url: string) {
    this.transporte = nodemailer.createTransport(url);
  }

  async enviar(mensaje: Mensaje): Promise<void> {
    await this.transporte.sendMail({
      from: serverEnv().AUTH_EMAIL_FROM ?? 'no-reply@olbun.es',
      to: mensaje.para,
      subject: mensaje.asunto,
      text: mensaje.texto,
      html: mensaje.html,
    });
  }
}

/**
 * Placeholder for the production transport. Deliberately throws rather than
 * silently dropping mail: an invitation that is never delivered and never
 * reported is worse than an error.
 */
class UnconfiguredMailService implements MailService {
  enviar(mensaje: Mensaje): Promise<void> {
    logger.error(
      { para: mensaje.para, asunto: mensaje.asunto },
      'No hay transporte de correo configurado',
    );
    return Promise.reject(
      new Error(
        'No hay transporte de correo configurado. Configura MAIL_TRANSPORT antes de desplegar.',
      ),
    );
  }
}

let instancia: MailService | undefined;

export function mailService(): MailService {
  const env = serverEnv();
  instancia ??=
    env.MAIL_TRANSPORT === 'smtp' && env.SMTP_URL
      ? new SmtpMailService(env.SMTP_URL)
      : env.MAIL_TRANSPORT === 'console' || env.NODE_ENV !== 'production'
        ? new ConsoleMailService()
        : new UnconfiguredMailService();

  return instancia;
}

/** Test seam. */
export function setMailService(servicio: MailService | undefined): void {
  instancia = servicio;
}
