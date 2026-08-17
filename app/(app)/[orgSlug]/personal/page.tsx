import Link from 'next/link';
import type { Metadata } from 'next';

import { crearEmpleadoAction } from './acciones';
import { can } from '@/lib/auth/can';
import { requirePermission } from '@/lib/auth/guardias';
import { isScopedRole } from '@/lib/auth/permissions';
import { FormularioEmpleado } from '@/components/features/personal/formulario-empleado';
import { EstadoVacio, Tabla } from '@/components/ui/tabla';
import { tenantClient } from '@/lib/db/tenant';
import { hoyEn } from '@/lib/domain/fecha';
import { estadoDeCertificacion } from '@/lib/domain/personal/caducidades';

export const metadata: Metadata = { title: 'Personal' };

const ETIQUETA_ESTADO: Record<string, string> = {
  ACTIVO: 'Activo',
  EXCEDENCIA: 'Excedencia',
  BAJA: 'Baja',
  FINALIZADO: 'Finalizado',
};
const CLASE_CERTIFICACION: Record<string, string> = {
  VALIDA: 'text-status-green',
  PROXIMA_A_CADUCAR: 'text-status-amber',
  CADUCADA: 'text-destructive',
};

export default async function PersonalPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await requirePermission(orgSlug, 'empleado:view');
  const db = tenantClient(contexto.organisation.id);
  const scoped = isScopedRole(contexto.actor.role);
  const filtroContrato = scoped
    ? {
        adscripciones: {
          some: { contratoId: { in: [...contexto.actor.contratoIds] }, deletedAt: null },
        },
      }
    : {};
  const [empleados, convenios, categorias, contratos] = await Promise.all([
    db.empleado.findMany({
      where: { deletedAt: null, ...filtroContrato },
      select: {
        id: true,
        numeroEmpleado: true,
        nombre: true,
        apellidos: true,
        puesto: true,
        estado: true,
        jornadaPorcentaje: true,
        horasSemanales: true,
        categoria: { select: { denominacion: true } },
        convenio: { select: { nombre: true } },
        adscripciones: {
          where: { deletedAt: null },
          select: {
            contratoId: true,
            esPersonalClave: true,
            contrato: { select: { numeroExpediente: true } },
          },
        },
        certificaciones: {
          where: { deletedAt: null },
          select: { fechaCaducidad: true, estado: true, tipo: { select: { diasAviso: true } } },
        },
      },
      orderBy: [{ estado: 'asc' }, { apellidos: 'asc' }],
      take: 500,
    }),
    db.convenioColectivo.findMany({
      where: { deletedAt: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    db.categoriaProfesional.findMany({
      where: { deletedAt: null },
      select: { id: true, convenioId: true, denominacion: true },
      orderBy: { denominacion: 'asc' },
    }),
    db.contrato.findMany({
      where: {
        deletedAt: null,
        ...(scoped ? { id: { in: [...contexto.actor.contratoIds] } } : {}),
      },
      select: { id: true, numeroExpediente: true, objeto: true },
      orderBy: { numeroExpediente: 'asc' },
    }),
  ]);
  const hoy = hoyEn(contexto.organisation.timezone);
  const filas = empleados.map((empleado) => {
    const estados = empleado.certificaciones.map((certificacion) =>
      certificacion.estado === 'REVOCADA' || certificacion.estado === 'PENDIENTE_RENOVACION'
        ? certificacion.estado
        : estadoDeCertificacion(
            certificacion.fechaCaducidad?.toISOString().slice(0, 10),
            hoy,
            certificacion.tipo.diasAviso,
          ),
    );
    const estadoCertificacion = estados.includes('CADUCADA')
      ? 'CADUCADA'
      : estados.includes('PROXIMA_A_CADUCAR') || estados.includes('PENDIENTE_RENOVACION')
        ? 'PROXIMA_A_CADUCAR'
        : 'VALIDA';
    return { ...empleado, estadoCertificacion };
  });
  const activos = empleados.filter((empleado) => empleado.estado === 'ACTIVO');
  const fte = activos.reduce(
    (suma, empleado) => suma + Number(empleado.jornadaPorcentaje) / 100,
    0,
  );
  const puedeGestionar = can(contexto.actor, 'empleado:manage');

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Personal</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Quién presta cada contrato, bajo qué convenio y con qué habilitaciones. Los
            identificadores y salarios individuales quedan cifrados y fuera de esta vista.
          </p>
        </div>
        <nav aria-label="Vistas de personal" className="flex flex-wrap gap-2 text-sm">
          <Link
            className="rounded-md border border-border px-3 py-2 hover:bg-muted"
            href={`/${orgSlug}/personal/convenios`}
          >
            Convenios
          </Link>
          <Link
            className="rounded-md border border-border px-3 py-2 hover:bg-muted"
            href={`/${orgSlug}/personal/plantilla`}
          >
            Plantilla y adscripción
          </Link>
          <Link
            className="rounded-md border border-border px-3 py-2 hover:bg-muted"
            href={`/${orgSlug}/personal/certificaciones`}
          >
            Certificaciones
          </Link>
          <Link
            className="rounded-md border border-border px-3 py-2 hover:bg-muted"
            href={`/${orgSlug}/personal/ausencias`}
          >
            Ausencias
          </Link>
          <Link
            className="rounded-md border border-border px-3 py-2 hover:bg-muted"
            href={`/${orgSlug}/personal/planificador`}
          >
            Planificador
          </Link>
          <Link
            className="rounded-md border border-border px-3 py-2 hover:bg-muted"
            href={`/${orgSlug}/personal/jornada`}
          >
            Jornada
          </Link>
        </nav>
      </header>
      <section
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Resumen de plantilla"
      >
        <Metrica etiqueta="Personas activas" valor={String(activos.length)} />
        <Metrica etiqueta="FTE aproximado" valor={fte.toFixed(1)} />
        <Metrica
          etiqueta="Adscripciones activas"
          valor={String(empleados.flatMap((empleado) => empleado.adscripciones).length)}
        />
        <Metrica
          etiqueta="Certificados a revisar"
          valor={String(filas.filter((fila) => fila.estadoCertificacion !== 'VALIDA').length)}
        />
      </section>
      {puedeGestionar ? (
        <FormularioEmpleado
          accion={crearEmpleadoAction.bind(null, orgSlug)}
          convenios={convenios}
          categorias={categorias.map((categoria) => ({
            id: categoria.id,
            convenioId: categoria.convenioId,
            nombre: categoria.denominacion,
          }))}
          contratos={contratos.map((contrato) => ({
            id: contrato.id,
            etiqueta: `${contrato.numeroExpediente} — ${contrato.objeto}`,
          }))}
          hoy={hoy}
        />
      ) : null}
      <Tabla
        titulo="Directorio y situación contractual"
        anchoMinimo="940px"
        filas={filas}
        claveDeFila={(fila) => fila.id}
        vacio={
          <EstadoVacio
            titulo="Todavía no hay plantilla"
            explicacion="Añade a las personas y después adscríbelas a contratos. La cobertura frente al pliego se calcula sin mezclar categorías."
          />
        }
        columnas={[
          {
            clave: 'persona',
            encabezado: 'Persona',
            esCabeceraDeFila: true,
            celda: (fila) => (
              <div>
                <Link
                  href={`/${orgSlug}/personal/${fila.id}`}
                  className="font-medium hover:underline"
                >
                  {fila.apellidos}, {fila.nombre}
                </Link>
                <p className="font-mono text-xs text-muted-foreground">{fila.numeroEmpleado}</p>
              </div>
            ),
          },
          {
            clave: 'puesto',
            encabezado: 'Puesto / categoría',
            celda: (fila) => (
              <div>
                <p>{fila.puesto ?? 'Sin puesto'}</p>
                <p className="text-xs text-muted-foreground">
                  {fila.categoria?.denominacion ?? 'Sin categoría'}
                </p>
              </div>
            ),
          },
          {
            clave: 'contratos',
            encabezado: 'Contratos',
            celda: (fila) => (
              <span>
                {fila.adscripciones.map((item) => item.contrato.numeroExpediente).join(', ') ||
                  'Sin adscripción'}
              </span>
            ),
          },
          {
            clave: 'jornada',
            encabezado: 'Jornada',
            celda: (fila) => (
              <span className="tabular-nums">
                {Number(fila.horasSemanales).toLocaleString('es-ES')} h ·{' '}
                {Number(fila.jornadaPorcentaje).toLocaleString('es-ES')}%
              </span>
            ),
          },
          {
            clave: 'estado',
            encabezado: 'Estado',
            celda: (fila) => <span>{ETIQUETA_ESTADO[fila.estado] ?? fila.estado}</span>,
          },
          {
            clave: 'certificacion',
            encabezado: 'Certificaciones',
            celda: (fila) => (
              <span className={CLASE_CERTIFICACION[fila.estadoCertificacion] ?? ''}>
                {fila.estadoCertificacion === 'VALIDA'
                  ? 'Al día'
                  : fila.estadoCertificacion === 'CADUCADA'
                    ? 'Caducada'
                    : 'Revisar pronto'}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}

function Metrica({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
    </div>
  );
}
