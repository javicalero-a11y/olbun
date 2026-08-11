import type { Mensaje } from './index';

/**
 * Email bodies. Plain strings for now; React Email arrives with the
 * notification engine, when there are enough templates to justify it.
 *
 * Every message is plain-text first — a lot of public-sector mail clients
 * render HTML badly, and the text part is what ends up quoted in replies.
 */

function envoltorio(
  titulo: string,
  cuerpo: string,
  cta?: { texto: string; url: string },
): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f6f6f5;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1c1f26">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;padding:32px">
    <p style="margin:0 0 24px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">Olbun</p>
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:600">${titulo}</h1>
    <div style="font-size:14px;line-height:1.6;color:#374151">${cuerpo}</div>
    ${
      cta
        ? `<p style="margin:24px 0 0"><a href="${cta.url}" style="display:inline-block;background:#2f3d8f;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:500">${cta.texto}</a></p>
    <p style="margin:16px 0 0;font-size:12px;color:#6b7280">Si el botón no funciona, copia esta dirección en tu navegador:<br>${cta.url}</p>`
        : ''
    }
  </div>
</body></html>`;
}

export function correoInvitacion(datos: {
  para: string;
  organizacion: string;
  invitadoPor: string;
  url: string;
  diasCaducidad: number;
}): Mensaje {
  const titulo = `${datos.invitadoPor} te invita a ${datos.organizacion}`;

  return {
    para: datos.para,
    asunto: `Invitación a ${datos.organizacion} en Olbun`,
    html: envoltorio(
      titulo,
      `<p>Te han invitado a acceder al espacio de <strong>${datos.organizacion}</strong> en Olbun, donde se gestionan contratos, plazos y expedientes.</p>
       <p>La invitación caduca en ${String(datos.diasCaducidad)} días y sólo puede usarse una vez.</p>`,
      { texto: 'Aceptar invitación', url: datos.url },
    ),
    texto: [
      titulo,
      '',
      `Te han invitado a acceder al espacio de ${datos.organizacion} en Olbun.`,
      `La invitación caduca en ${String(datos.diasCaducidad)} días y sólo puede usarse una vez.`,
      '',
      `Aceptar la invitación: ${datos.url}`,
    ].join('\n'),
  };
}
