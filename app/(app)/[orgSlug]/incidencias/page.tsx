import type { Metadata } from 'next';

import { crear } from './acciones';
import { EstadoVacio, Tabla } from '@/components/ui/tabla';
import { FormularioIncidencia } from '@/components/features/riesgos/formulario-incidencia';
import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';

export const metadata: Metadata = { title: 'Incidencias' };

const ETIQUETA_TIPO: Record<string, string> = {
  FALLO_SERVICIO: 'Fallo del servicio',
  QUEJA_USUARIO: 'Queja de usuario',
  ACCIDENTE: 'Accidente con baja',
  INCIDENTE_SIN_BAJA: 'Incidente sin baja',
  DANO_MATERIAL: 'Daño material',
  AGRESION: 'Agresión',
  MEDIOAMBIENTAL: 'Medioambiental',
  VEHICULO: 'Vehículo',
  SEGURIDAD_DATOS: 'Seguridad de datos',
};

const ETIQUETA_GRAVEDAD: Record<string, { texto: string; clase: string }> = {
  LEVE: { texto: 'Leve', clase: 'text-muted-foreground' },
  MODERADA: { texto: 'Moderada', clase: 'text-status-amber' },
  GRAVE: { texto: 'Grave', clase: 'text-destructive' },
  MUY_GRAVE: { texto: 'Muy grave', clase: 'text-destructive font-semibold' },
};

function fechaCorta(valor: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(valor);
}

/**
 * The incident log.
 *
 * Newest first and open first: the question is "what is unresolved", and a log
 * that leads with closed items from last spring answers a different one.
 */
export default async function IncidenciasPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await requirePermission(orgSlug, 'incidencia:view');
  const db = tenantClient(contexto.organisation.id);

  const [incidencias, contratos] = await Promise.all([
    db.incidencia.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        referencia: true,
        tipo: true,
        gravedad: true,
        estado: true,
        fechaHecho: true,
        descripcion: true,
        esNotificableAAutoridad: true,
        comunicadaAlOrgano: true,
        contrato: { select: { numeroExpediente: true } },
        deteccionId: true,
      },
      orderBy: [{ estado: 'asc' }, { fechaHecho: 'desc' }],
      take: 200,
    }),
    db.contrato.findMany({
      where: { deletedAt: null },
      select: { id: true, numeroExpediente: true, objeto: true },
      orderBy: { numeroExpediente: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Incidencias</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Lo que ha pasado: fallos del servicio, quejas, accidentes, daños. Se registra aquí
          aunque nadie reclame todavía, porque cuando reclamen la pregunta será qué se hizo y
          cuándo.
        </p>
      </div>

      <FormularioIncidencia
        accion={crear.bind(null, orgSlug)}
        contratos={contratos.map((contrato) => ({
          id: contrato.id,
          etiqueta: `${contrato.numeroExpediente} — ${contrato.objeto}`,
        }))}
      />

      <Tabla
        titulo="Incidencias registradas, primero las que siguen abiertas"
        anchoMinimo="820px"
        filas={incidencias}
        claveDeFila={(incidencia) => incidencia.id}
        vacio={
          <EstadoVacio
            titulo="Todavía no hay incidencias"
            explicacion="Un registro de incidencias es lo que convierte «creo que eso pasó en marzo» en una fecha, un lugar y unas medidas. Es la primera cosa que pide un pliego cuando algo va mal."
          />
        }
        columnas={[
          {
            clave: 'referencia',
            encabezado: 'Referencia',
            esCabeceraDeFila: true,
            celda: (incidencia) => (
              <>
                <span className="text-sm font-medium">{incidencia.referencia}</span>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {incidencia.descripcion}
                </p>
              </>
            ),
          },
          {
            clave: 'tipo',
            encabezado: 'Tipo',
            clase: 'text-xs',
            celda: (incidencia) => ETIQUETA_TIPO[incidencia.tipo] ?? incidencia.tipo,
          },
          {
            clave: 'gravedad',
            encabezado: 'Gravedad',
            celda: (incidencia) => {
              const gravedad = ETIQUETA_GRAVEDAD[incidencia.gravedad];
              return (
                <span className={`text-xs ${gravedad?.clase ?? ''}`}>
                  {gravedad?.texto ?? incidencia.gravedad}
                </span>
              );
            },
          },
          {
            clave: 'avisos',
            encabezado: 'Comunicación',
            clase: 'text-xs',
            celda: (incidencia) => (
              <div className="space-y-0.5">
                {incidencia.esNotificableAAutoridad ? (
                  <p className="text-status-amber">Notificable a autoridad</p>
                ) : null}
                <p className="text-muted-foreground">
                  {incidencia.comunicadaAlOrgano ? 'Comunicada al órgano' : 'Sin comunicar'}
                </p>
              </div>
            ),
          },
          {
            clave: 'contrato',
            encabezado: 'Contrato',
            clase: 'text-xs text-muted-foreground',
            celda: (incidencia) => incidencia.contrato?.numeroExpediente ?? 'Sin vincular',
          },
          {
            clave: 'fecha',
            encabezado: 'Fecha',
            numerica: true,
            clase: 'text-xs whitespace-nowrap',
            celda: (incidencia) => fechaCorta(incidencia.fechaHecho),
          },
        ]}
      />
    </div>
  );
}
