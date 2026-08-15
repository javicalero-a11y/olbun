import 'server-only';

import type { Prisma } from '@prisma/client';

import { registrarEvento } from '@/lib/audit/registrar';
import { can } from '@/lib/auth/can';
import { requirePermission } from '@/lib/auth/guardias';
import { isScopedRole } from '@/lib/auth/permissions';
import {
  descifrarObjeto,
  type DatosLaboralesProtegidos,
  type IdentificacionProtegida,
} from '@/lib/crypto/datos-personales';
import { tenantTransaction } from '@/lib/db/tenant';

const detalleSelect = {
  id: true,
  numeroEmpleado: true,
  nombre: true,
  apellidos: true,
  email: true,
  telefono: true,
  puesto: true,
  estado: true,
  fechaAlta: true,
  fechaBaja: true,
  datosIdentificacionCifrados: true,
  datosLaboralesCifrados: true,
  codigoContratoSEPE: true,
  grupoCotizacion: true,
  jornadaPorcentaje: true,
  horasSemanales: true,
  antiguedadReconocida: true,
  esSubrogado: true,
  tieneReduccionJornada: true,
  esRepresentanteTrabajadores: true,
  categoria: { select: { id: true, denominacion: true } },
  convenio: { select: { id: true, nombre: true } },
  adscripciones: {
    where: { deletedAt: null },
    select: {
      id: true,
      centroTrabajo: true,
      horasSemanales: true,
      porcentajeDedicacion: true,
      fechaAlta: true,
      fechaBaja: true,
      esPersonalClave: true,
      turno: true,
      contrato: { select: { id: true, numeroExpediente: true, objeto: true } },
      categoria: { select: { denominacion: true } },
    },
    orderBy: { fechaAlta: 'desc' as const },
  },
  certificaciones: {
    where: { deletedAt: null },
    select: {
      id: true,
      emitidaPor: true,
      fechaEmision: true,
      fechaCaducidad: true,
      estado: true,
      tipo: { select: { nombre: true, diasAviso: true, esObligatoria: true } },
    },
    orderBy: { fechaCaducidad: 'asc' as const },
  },
} satisfies Prisma.EmpleadoSelect;

export async function obtenerDetalleEmpleado(orgSlug: string, empleadoId: string) {
  const sesion = await requirePermission(orgSlug, 'empleado:view');
  const incluirSensibles = can(sesion.actor, 'empleado:view_sensitive');

  return tenantTransaction(sesion.organisation.id, async (db) => {
    const empleado = await db.empleado.findFirst({
      where: { id: empleadoId, deletedAt: null },
      select: detalleSelect,
    });
    if (!empleado) return null;
    const adscripcionesEnAlcance = empleado.adscripciones.filter((adscripcion) =>
      can(sesion.actor, 'empleado:view', {
        organisationId: sesion.organisation.id,
        id: empleado.id,
        contratoId: adscripcion.contrato.id,
      }),
    );
    if (isScopedRole(sesion.actor.role) && adscripcionesEnAlcance.length === 0) {
      return null;
    }

    let identificacion: IdentificacionProtegida | null = null;
    let laborales: DatosLaboralesProtegidos | null = null;
    if (incluirSensibles) {
      identificacion = empleado.datosIdentificacionCifrados
        ? descifrarObjeto<IdentificacionProtegida>(empleado.datosIdentificacionCifrados)
        : null;
      laborales = empleado.datosLaboralesCifrados
        ? descifrarObjeto<DatosLaboralesProtegidos>(empleado.datosLaboralesCifrados)
        : null;
      await registrarEvento(
        db,
        {
          organisationId: sesion.organisation.id,
          actorId: sesion.user.id,
          actorEmail: sesion.user.email,
          actorRol: sesion.actor.role,
        },
        {
          tipo: 'ACCESO',
          accion: 'empleado.ver_datos_sensibles',
          entidad: 'Empleado',
          entidadId: empleado.id,
          descripcion: `${empleado.numeroEmpleado} — lectura de datos protegidos`,
        },
      );
    }

    const {
      datosIdentificacionCifrados: _identificacion,
      datosLaboralesCifrados: _laborales,
      ...publico
    } = empleado;
    return {
      ...publico,
      adscripciones: adscripcionesEnAlcance,
      identificacion,
      laborales,
      puedeVerSensibles: incluirSensibles,
    };
  });
}
