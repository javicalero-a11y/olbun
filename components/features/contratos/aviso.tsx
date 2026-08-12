import type { AvisoContrato, NivelAviso } from '@/lib/domain/contratos/avisos';

/**
 * Status is never colour alone (SPEC §8): every level carries a word and a
 * symbol, so the meaning survives a monochrome print-out or a reader who does
 * not distinguish red from green.
 */
const ESTILO: Record<
  NivelAviso,
  { clase: string; borde: string; simbolo: string; palabra: string }
> = {
  CRITICO: {
    clase: 'text-status-red',
    borde: 'border-status-red/30 bg-status-red-subtle',
    simbolo: '▲',
    palabra: 'Crítico',
  },
  ALTO: {
    clase: 'text-status-amber',
    borde: 'border-status-amber/30 bg-status-amber-subtle',
    simbolo: '▲',
    palabra: 'Alto',
  },
  MEDIO: {
    clase: 'text-status-amber',
    borde: 'border-status-amber/30 bg-status-amber-subtle',
    simbolo: '■',
    palabra: 'Medio',
  },
  INFORMATIVO: {
    clase: 'text-muted-foreground',
    borde: 'border-border',
    simbolo: '●',
    palabra: 'Informativo',
  },
};

export function cuentaAtras(dias: number): string {
  if (dias < 0) return `hace ${String(Math.abs(dias))} días`;
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  return `en ${String(dias)} días`;
}

export function EtiquetaAviso({ aviso }: { aviso: AvisoContrato }) {
  const estilo = ESTILO[aviso.nivel];

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${estilo.clase}`}>
      <span aria-hidden="true">{estilo.simbolo}</span>
      <span className="sr-only">{estilo.palabra}: </span>
      {aviso.titulo} {cuentaAtras(aviso.diasRestantes)}
    </span>
  );
}

export function PanelAvisos({ avisos }: { avisos: AvisoContrato[] }) {
  if (avisos.length === 0) return null;

  return (
    <ul className="space-y-2">
      {avisos.map((aviso) => {
        const estilo = ESTILO[aviso.nivel];

        return (
          <li key={aviso.titulo} className={`rounded-md border px-3 py-2 ${estilo.borde}`}>
            <p className={`text-sm font-medium ${estilo.clase}`}>
              <span aria-hidden="true">{estilo.simbolo} </span>
              <span className="sr-only">{estilo.palabra}: </span>
              {aviso.titulo} — {cuentaAtras(aviso.diasRestantes)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{aviso.detalle}</p>
          </li>
        );
      })}
    </ul>
  );
}
