import type { AvisoPlazo, NivelPlazo } from '@/lib/domain/expedientes/avisos';
import { formatearEs } from '@/lib/domain/fecha';

/**
 * Deadline warnings.
 *
 * Never colour alone (SPEC §8): each level carries a symbol and a word, so the
 * message survives a monochrome print, a colour-blind reader, or a screen
 * reader announcing the row.
 */
const ESTILO: Record<
  NivelPlazo,
  { texto: string; borde: string; simbolo: string; palabra: string }
> = {
  VENCIDO: {
    texto: 'text-status-red',
    borde: 'border-status-red/40 bg-status-red-subtle',
    simbolo: '▲',
    palabra: 'Vencido',
  },
  CRITICO: {
    texto: 'text-status-red',
    borde: 'border-status-red/30 bg-status-red-subtle',
    simbolo: '▲',
    palabra: 'Crítico',
  },
  ALTO: {
    texto: 'text-status-amber',
    borde: 'border-status-amber/30 bg-status-amber-subtle',
    simbolo: '▲',
    palabra: 'Alto',
  },
  MEDIO: {
    texto: 'text-status-amber',
    borde: 'border-status-amber/30 bg-status-amber-subtle',
    simbolo: '■',
    palabra: 'Medio',
  },
  INFORMATIVO: {
    texto: 'text-muted-foreground',
    borde: 'border-border',
    simbolo: '●',
    palabra: 'Informativo',
  },
  CERRADO: {
    texto: 'text-status-green',
    borde: 'border-border',
    simbolo: '✓',
    palabra: 'Cerrado',
  },
};

export function cuentaAtras(dias: number): string {
  if (dias < 0) {
    const d = Math.abs(dias);
    return d === 1 ? 'venció ayer' : `venció hace ${String(d)} días`;
  }
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  return `vence en ${String(dias)} días`;
}

export function EtiquetaPlazo({ aviso }: { aviso: AvisoPlazo }) {
  const estilo = ESTILO[aviso.nivel];

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${estilo.texto}`}>
      <span aria-hidden="true">{estilo.simbolo}</span>
      <span className="sr-only">{estilo.palabra}: </span>
      {aviso.titulo} — {cuentaAtras(aviso.diasRestantes)}
      {aviso.provisional ? <span className="sr-only"> (fecha sin confirmar)</span> : null}
    </span>
  );
}

export function TarjetaPlazo({ aviso }: { aviso: AvisoPlazo }) {
  const estilo = ESTILO[aviso.nivel];

  return (
    <li className={`rounded-md border px-3 py-2.5 ${estilo.borde}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className={`text-sm font-medium ${estilo.texto}`}>
          <span aria-hidden="true">{estilo.simbolo} </span>
          <span className="sr-only">{estilo.palabra}: </span>
          {aviso.titulo}
        </p>
        <p className={`text-xs font-medium ${estilo.texto}`} data-numeric>
          {formatearEs(aviso.vencimiento)} · {cuentaAtras(aviso.diasRestantes)}
        </p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{aviso.detalle}</p>
      {aviso.provisional ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Fecha calculada por el sistema. Nadie la ha confirmado todavía.
        </p>
      ) : null}
    </li>
  );
}

export function PanelPlazos({ avisos }: { avisos: AvisoPlazo[] }) {
  if (avisos.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
        Este expediente no tiene ningún plazo abierto.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {avisos.map((aviso) => (
        <TarjetaPlazo key={aviso.plazoId} aviso={aviso} />
      ))}
    </ul>
  );
}
