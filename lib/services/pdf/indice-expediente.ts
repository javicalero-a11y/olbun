import 'server-only';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const ANCHO = 595.28;
const ALTO = 841.89;
const MARGEN = 52;

function textoCompatible(valor: string): string {
  return valor
    .replaceAll('—', '-')
    .replaceAll('→', '->')
    .replaceAll('“', '"')
    .replaceAll('”', '"')
    .replaceAll('«', '"')
    .replaceAll('»', '"')
    .replaceAll('**', '')
    .replaceAll('`', '')
    .replace(/^#+\s*/u, '')
    .replace(/^[-*]\s+/u, '- ');
}

function envolver(
  texto: string,
  anchoMaximo: number,
  tamano: number,
  medir: (texto: string, tamano: number) => number,
): string[] {
  if (texto === '') return [''];
  const palabras = texto.split(/\s+/u);
  const lineas: string[] = [];
  let actual = '';

  for (const palabra of palabras) {
    const candidata = actual ? `${actual} ${palabra}` : palabra;
    if (actual && medir(candidata, tamano) > anchoMaximo) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = candidata;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/** A durable, printable index included next to the source documents. */
export async function crearIndicePdfExpediente(datos: {
  referencia: string;
  titulo: string;
  lineas: readonly string[];
  generadoEn?: Date;
}): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Expediente ${datos.referencia}`);
  pdf.setSubject(datos.titulo);
  pdf.setCreator('Olbun');
  pdf.setCreationDate(datos.generadoEn ?? new Date());
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const paginas: ReturnType<typeof pdf.addPage>[] = [];
  let pagina = pdf.addPage([ANCHO, ALTO]);
  paginas.push(pagina);
  let y = ALTO - MARGEN;

  const cabecera = () => {
    pagina.drawRectangle({
      x: 0,
      y: ALTO - 16,
      width: ANCHO,
      height: 16,
      color: rgb(0.08, 0.23, 0.22),
    });
    pagina.drawText('OLBUN  /  EXPEDIENTE AUDITABLE', {
      x: MARGEN,
      y: ALTO - 42,
      size: 8,
      font: negrita,
      color: rgb(0.08, 0.23, 0.22),
    });
  };

  const nuevaPagina = () => {
    pagina = pdf.addPage([ANCHO, ALTO]);
    paginas.push(pagina);
    y = ALTO - MARGEN;
    cabecera();
    y -= 22;
  };

  cabecera();
  y -= 28;
  pagina.drawText(textoCompatible(`Expediente ${datos.referencia}`), {
    x: MARGEN,
    y,
    size: 19,
    font: negrita,
    color: rgb(0.08, 0.23, 0.22),
  });
  y -= 27;
  for (const lineaTitulo of envolver(
    textoCompatible(datos.titulo),
    ANCHO - MARGEN * 2,
    11,
    (texto, tamano) => normal.widthOfTextAtSize(texto, tamano),
  )) {
    pagina.drawText(lineaTitulo, { x: MARGEN, y, size: 11, font: normal });
    y -= 15;
  }
  y -= 13;

  for (const original of datos.lineas) {
    const nivel = original.match(/^(#+)\s/u)?.[1]?.length ?? 0;
    const texto = textoCompatible(original);
    const tamano = nivel === 1 ? 16 : nivel === 2 ? 13 : nivel === 3 ? 11 : 9;
    const fuente = nivel > 0 ? negrita : normal;
    const altoLinea = tamano + 4;
    const lineas = envolver(texto, ANCHO - MARGEN * 2, tamano, (valor, size) =>
      fuente.widthOfTextAtSize(valor, size),
    );

    if (y - lineas.length * altoLinea < 50) nuevaPagina();
    if (nivel > 0) y -= 5;
    for (const linea of lineas) {
      if (linea !== '') pagina.drawText(linea, { x: MARGEN, y, size: tamano, font: fuente });
      y -= altoLinea;
    }
  }

  paginas.forEach((hoja, indice) => {
    hoja.drawText(
      `Generado por Olbun · página ${String(indice + 1)} de ${String(paginas.length)}`,
      {
        x: MARGEN,
        y: 24,
        size: 7,
        font: normal,
        color: rgb(0.4, 0.4, 0.4),
      },
    );
  });

  return Buffer.from(await pdf.save());
}
