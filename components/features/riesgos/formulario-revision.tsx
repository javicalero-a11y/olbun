'use client';

import { useActionState, useState } from 'react';

import { BotonEnviar, ErrorGeneral } from '@/components/features/auth/campo';
import { CLASE_NIVEL } from '@/components/features/riesgos/formulario-riesgo';
import {
  nombreDeNivel,
  valorar,
  type BandaMatriz,
  type Escala,
} from '@/lib/domain/riesgos/matriz';

interface EstadoFormulario {
  error?: string;
  exito?: string;
  errores?: Record<string, string[]>;
}

export function FormularioRevisionRiesgo({
  accion,
  riesgoId,
  probabilidadInherente,
  impactoInherente,
  probabilidadResidual,
  impactoResidual,
  proximaRevision,
  bandas,
}: {
  accion: (previo: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  riesgoId: string;
  probabilidadInherente: Escala;
  impactoInherente: Escala;
  probabilidadResidual: Escala | null;
  impactoResidual: Escala | null;
  proximaRevision: string;
  bandas: readonly BandaMatriz[];
}) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  const [resultado, setResultado] = useState('SIN_CAMBIOS');
  const [probabilidad, setProbabilidad] = useState(
    probabilidadResidual ?? probabilidadInherente,
  );
  const [impacto, setImpacto] = useState(impactoResidual ?? impactoInherente);
  const inherente = valorar(probabilidadInherente, impactoInherente, bandas);
  const residual = valorar(probabilidad, impacto, bandas);
  const empeora = residual.puntuacion > inherente.puntuacion;

  return (
    <form action={enviar} className="space-y-4 rounded-lg border border-border p-4">
      <input type="hidden" name="riesgoId" value={riesgoId} />
      <div>
        <h2 className="text-sm font-semibold">Registrar revisión</h2>
        <p className="text-xs text-muted-foreground">
          Cada envío añade una revisión inmutable. Una revaloración añade además un punto al
          histórico.
        </p>
      </div>
      <ErrorGeneral mensaje={estado.error} />
      {estado.exito ? (
        <p role="status" className="text-sm text-status-green">
          {estado.exito}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="resultado" className="text-sm font-medium">
            Resultado
          </label>
          <select
            id="resultado"
            name="resultado"
            value={resultado}
            onChange={(evento) => setResultado(evento.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="SIN_CAMBIOS">Sin cambios</option>
            <option value="REVALORADO">Revalorado</option>
            <option value="CONTROL_ACTUALIZADO">Control actualizado</option>
            <option value="CERRADO">Cerrar riesgo</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="probabilidadResidual" className="text-sm font-medium">
            Probabilidad residual
          </label>
          <select
            id="probabilidadResidual"
            name={resultado === 'REVALORADO' ? 'probabilidadResidual' : undefined}
            value={probabilidad}
            onChange={(evento) => {
              setProbabilidad(Number(evento.target.value) as Escala);
              setResultado('REVALORADO');
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {[1, 2, 3, 4, 5].map((valor) => (
              <option key={valor} value={valor}>
                {valor}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="impactoResidual" className="text-sm font-medium">
            Impacto residual
          </label>
          <select
            id="impactoResidual"
            name={resultado === 'REVALORADO' ? 'impactoResidual' : undefined}
            value={impacto}
            onChange={(evento) => {
              setImpacto(Number(evento.target.value) as Escala);
              setResultado('REVALORADO');
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {[1, 2, 3, 4, 5].map((valor) => (
              <option key={valor} value={valor}>
                {valor}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className={`text-sm ${CLASE_NIVEL[residual.nivel] ?? ''}`} role="status">
        Residual: {nombreDeNivel(residual.nivel, bandas)} · {residual.puntuacion}; inherente:{' '}
        {inherente.puntuacion}.
        {empeora ? ' Ha empeorado: la justificación es obligatoria.' : ''}
      </p>

      <div className="space-y-1.5">
        <label htmlFor="comentarios" className="text-sm font-medium">
          Comprobaciones y justificación
        </label>
        <textarea
          id="comentarios"
          name="comentarios"
          rows={3}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        {estado.errores?.['comentarios']?.[0] ? (
          <p className="text-xs text-destructive">{estado.errores['comentarios'][0]}</p>
        ) : null}
      </div>

      {resultado !== 'CERRADO' ? (
        <div className="max-w-xs space-y-1.5">
          <label htmlFor="proximaRevision" className="text-sm font-medium">
            Siguiente revisión
          </label>
          <input
            id="proximaRevision"
            name="proximaRevision"
            type="date"
            defaultValue={proximaRevision}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      ) : null}

      <BotonEnviar pendiente={pendiente}>Guardar revisión</BotonEnviar>
    </form>
  );
}
