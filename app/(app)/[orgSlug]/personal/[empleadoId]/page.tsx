import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { obtenerDetalleEmpleado } from '@/lib/services/personal/empleados';
import { formatearEuros } from '@/lib/domain/contratos/etiquetas';

export const metadata: Metadata = { title: 'Detalle de personal' };

const fecha = (valor: Date | null) =>
  valor
    ? new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'medium',
        timeZone: 'Europe/Madrid',
      }).format(valor)
    : 'Sin fecha';

export default async function EmpleadoDetallePage({
  params,
}: {
  params: Promise<{ orgSlug: string; empleadoId: string }>;
}) {
  const { orgSlug, empleadoId } = await params;
  const empleado = await obtenerDetalleEmpleado(orgSlug, empleadoId);
  if (!empleado) notFound();
  return (
    <div className="space-y-8">
      <header className="space-y-2 border-b border-border pb-5">
        <Link
          href={`/${orgSlug}/personal`}
          className="text-xs font-medium text-primary hover:underline"
        >
          ← Personal
        </Link>
        <p className="font-mono text-xs text-muted-foreground">{empleado.numeroEmpleado}</p>
        <h1 className="text-2xl font-semibold">
          {empleado.nombre} {empleado.apellidos}
        </h1>
        <p className="text-sm text-muted-foreground">
          {empleado.puesto ?? 'Sin puesto'} · {empleado.estado}
        </p>
      </header>
      <section className="grid gap-4 lg:grid-cols-2">
        <Bloque titulo="Relación laboral">
          <Dato etiqueta="Alta" valor={fecha(empleado.fechaAlta)} />
          <Dato etiqueta="Antigüedad reconocida" valor={fecha(empleado.antiguedadReconocida)} />
          <Dato
            etiqueta="Jornada"
            valor={`${Number(empleado.horasSemanales).toLocaleString('es-ES')} h · ${Number(empleado.jornadaPorcentaje).toLocaleString('es-ES')}%`}
          />
          <Dato etiqueta="Convenio" valor={empleado.convenio?.nombre ?? 'Sin asignar'} />
          <Dato
            etiqueta="Categoría"
            valor={empleado.categoria?.denominacion ?? 'Sin asignar'}
          />
          <Dato etiqueta="Contrato SEPE" valor={empleado.codigoContratoSEPE ?? 'Sin indicar'} />
        </Bloque>
        <Bloque titulo="Datos protegidos">
          <p className="col-span-2 text-xs text-muted-foreground">
            {empleado.puedeVerSensibles
              ? 'Esta lectura ha quedado registrada en auditoría.'
              : 'Necesitas permiso adicional para ver identificadores, circunstancias protegidas y retribución individual.'}
          </p>
          {empleado.puedeVerSensibles ? (
            <>
              <Dato
                etiqueta="NIF / NIE"
                valor={empleado.identificacion?.nif ?? 'Sin indicar'}
              />
              <Dato
                etiqueta="Afiliación SS"
                valor={empleado.identificacion?.numeroAfiliacionSS ?? 'Sin indicar'}
              />
              <Dato
                etiqueta="CCC"
                valor={empleado.identificacion?.codigoCuentaCotizacion ?? 'Sin indicar'}
              />
              <Dato
                etiqueta="Complemento ad personam"
                valor={
                  empleado.laborales?.complementoAdPersonam === undefined
                    ? 'Sin complemento'
                    : formatearEuros(empleado.laborales.complementoAdPersonam)
                }
              />
              <Dato
                etiqueta="Reducción"
                valor={empleado.laborales?.motivoReduccion ?? 'No indicada'}
              />
              <Dato
                etiqueta="Discapacidad reconocida"
                valor={
                  empleado.laborales?.tieneDiscapacidadReconocida ? 'Sí' : 'No / no indicada'
                }
              />
            </>
          ) : null}
        </Bloque>
      </section>
      <section>
        <h2 className="mb-3 text-base font-semibold">Adscripciones</h2>
        <div className="grid gap-3">
          {empleado.adscripciones.length ? (
            empleado.adscripciones.map((item) => (
              <article key={item.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {item.contrato.numeroExpediente} — {item.contrato.objeto}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.centroTrabajo} · {item.categoria.denominacion}
                    </p>
                  </div>
                  <span className="text-sm tabular-nums">
                    {Number(item.horasSemanales).toLocaleString('es-ES')} h ·{' '}
                    {Number(item.porcentajeDedicacion).toLocaleString('es-ES')}%
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {fecha(item.fechaAlta)} → {item.fechaBaja ? fecha(item.fechaBaja) : 'vigente'}{' '}
                  · turno {item.turno.toLowerCase()}
                  {item.esPersonalClave ? ' · personal clave' : ''}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Sin adscripción contractual.</p>
          )}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-base font-semibold">Certificaciones</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {empleado.certificaciones.length ? (
            empleado.certificaciones.map((item) => (
              <article key={item.id} className="rounded-lg border border-border p-4">
                <p className="font-medium">{item.tipo.nombre}</p>
                <p className="mt-1 text-sm">{item.estado.replaceAll('_', ' ')}</p>
                <p className="text-xs text-muted-foreground">
                  Caduca: {item.fechaCaducidad ? fecha(item.fechaCaducidad) : 'no caduca'}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Sin certificados registrados.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-2 gap-3 rounded-lg border border-border p-4">
      <h2 className="col-span-2 text-sm font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}
function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className="text-sm break-words">{valor}</p>
    </div>
  );
}
