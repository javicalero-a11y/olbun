'use client';

import { useActionState, useState } from 'react';

import type { EstadoBuzon } from '@/app/(app)/[orgSlug]/comunicaciones/buzones-acciones';
import { BotonEnviar, ErrorGeneral } from '@/components/features/auth/campo';

const INICIAL: EstadoBuzon = {};

interface BuzonVisible {
  id: string;
  proveedor: 'Google Workspace' | 'Microsoft 365';
  direccion: string;
  estado: string;
  ultimaSincronizacion: string | null;
  error: string | null;
  personal: boolean;
  activo: boolean;
}

function FilaBuzon({
  buzon,
  sincronizar,
  desconectar,
}: {
  buzon: BuzonVisible;
  sincronizar: (previo: EstadoBuzon, formData: FormData) => Promise<EstadoBuzon>;
  desconectar: (previo: EstadoBuzon, formData: FormData) => Promise<EstadoBuzon>;
}) {
  const [estadoSync, ejecutarSync, sincronizando] = useActionState(sincronizar, INICIAL);
  const [estadoDesconexion, ejecutarDesconexion, desconectando] = useActionState(
    desconectar,
    INICIAL,
  );

  return (
    <li className="space-y-3 rounded-md border border-border bg-secondary/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{buzon.direccion}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {buzon.proveedor} ·{' '}
            {buzon.personal ? 'Personal, con garantías registradas' : 'Funcional'}
          </p>
          <p className="mt-1 text-xs">
            Estado: <span className="font-medium">{buzon.estado}</span>
            {buzon.ultimaSincronizacion ? ` · Última: ${buzon.ultimaSincronizacion}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {buzon.activo ? (
            <form action={ejecutarSync}>
              <input type="hidden" name="buzonId" value={buzon.id} />
              <BotonEnviar pendiente={sincronizando}>Sincronizar</BotonEnviar>
            </form>
          ) : null}
          {buzon.activo ? (
            <form action={ejecutarDesconexion}>
              <input type="hidden" name="buzonId" value={buzon.id} />
              <button
                type="submit"
                disabled={desconectando}
                className="rounded-md border border-input px-3 py-2 text-xs font-medium disabled:opacity-50"
              >
                {desconectando ? 'Desconectando…' : 'Desconectar'}
              </button>
            </form>
          ) : null}
        </div>
      </div>
      {buzon.error ? <p className="text-xs text-status-red">{buzon.error}</p> : null}
      <ErrorGeneral mensaje={estadoSync.error ?? estadoDesconexion.error} />
      {estadoSync.exito || estadoDesconexion.exito ? (
        <p role="status" className="text-xs text-status-green">
          {estadoSync.exito ?? estadoDesconexion.exito}
        </p>
      ) : null}
    </li>
  );
}

export function PanelBuzones({
  iniciar,
  sincronizar,
  desconectar,
  buzones,
  contratos,
  documentos,
  googleConfigurado,
  microsoftConfigurado,
  avisoOAuth,
}: {
  iniciar: (formData: FormData) => Promise<void>;
  sincronizar: (previo: EstadoBuzon, formData: FormData) => Promise<EstadoBuzon>;
  desconectar: (previo: EstadoBuzon, formData: FormData) => Promise<EstadoBuzon>;
  buzones: BuzonVisible[];
  contratos: { id: string; etiqueta: string }[];
  documentos: { id: string; etiqueta: string }[];
  googleConfigurado: boolean;
  microsoftConfigurado: boolean;
  avisoOAuth?: string | undefined;
}) {
  const [personal, setPersonal] = useState(false);

  return (
    <section className="space-y-5 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-sm font-semibold">Buzones conectados</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Lee correo mediante OAuth con permiso de solo lectura. Los tokens permanecen cifrados
          y cada mensaje nuevo pasa por deduplicación y detección automática local.
        </p>
      </div>

      {avisoOAuth ? (
        <p role="status" className="rounded-md bg-secondary px-3 py-2 text-xs">
          {avisoOAuth}
        </p>
      ) : null}

      {buzones.length > 0 ? (
        <ul className="space-y-3">
          {buzones.map((buzon) => (
            <FilaBuzon
              key={buzon.id}
              buzon={buzon}
              sincronizar={sincronizar}
              desconectar={desconectar}
            />
          ))}
        </ul>
      ) : null}

      <form action={iniciar} className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="oauth-contrato" className="text-sm font-medium">
            Vincular al contrato
          </label>
          <select
            id="oauth-contrato"
            name="contratoId"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Bandeja general</option>
            {contratos.map((contrato) => (
              <option key={contrato.id} value={contrato.id}>
                {contrato.etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="oauth-historico" className="text-sm font-medium">
            Importar desde{' '}
            <span className="font-normal text-muted-foreground">(máx. 1 año)</span>
          </label>
          <input
            id="oauth-historico"
            name="historicoDesde"
            type="date"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="esPersonal"
            className="mt-0.5"
            checked={personal}
            onChange={(evento) => setPersonal(evento.target.checked)}
          />
          <span>
            Es el buzón individual de una persona
            <span className="block text-xs text-muted-foreground">
              Olbun exigirá política interna y consulta laboral antes de abrir OAuth.
            </span>
          </span>
        </label>

        {personal ? (
          <>
            <div className="space-y-1.5">
              <label htmlFor="oauth-politica" className="text-sm font-medium">
                Política interna aprobada
              </label>
              <select
                id="oauth-politica"
                name="politicaInternaDocumentoId"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Seleccionar documento</option>
                {documentos.map((documento) => (
                  <option key={documento.id} value={documento.id}>
                    {documento.etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="oauth-consulta" className="text-sm font-medium">
                Fecha de consulta a la representación
              </label>
              <input
                id="oauth-consulta"
                name="consultaRepresentacionFecha"
                type="date"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </>
        ) : null}

        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button
            type="submit"
            name="proveedor"
            value="GOOGLE"
            disabled={!googleConfigurado}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Conectar Google Workspace
          </button>
          <button
            type="submit"
            name="proveedor"
            value="MICROSOFT"
            disabled={!microsoftConfigurado}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            Conectar Microsoft 365
          </button>
        </div>
        {!googleConfigurado || !microsoftConfigurado ? (
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Los botones desactivados necesitan sus credenciales OAuth de buzón en el despliegue.
          </p>
        ) : null}
      </form>
    </section>
  );
}
