# ADR 0007: Resolución global mínima del alias de correo entrante

- **Estado:** Aceptada
- **Fecha:** 2026-08-14
- **Hito:** M6
- **Decisores:** equipo Olbun

## Contexto

El webhook que recibe un correo conoce la dirección destinataria, pero todavía
no conoce la organización. Por eso no puede construir primero el cliente Prisma
ligado a un tenant que exige ADR 0005. Resolver el alias es una consulta
inevitablemente global y usar el cliente elevado de forma amplia abriría una
ruta de lectura entre tenants.

Además, la dirección se publica fuera de Olbun. Una respuesta distinta para un
alias inexistente, borrado o de otra organización permitiría enumerar clientes.

## Decisión

Se permite una sola operación elevada y de lectura en
`lib/db/correo-entrante.ts`: buscar una dirección normalizada y devolver
exclusivamente `id`, `organisationId`, `contratoId` y `direccion` cuando el
alias está activo.

Antes de esa consulta, el Route Handler exige un secreto Bearer comparado en
tiempo constante. Un alias desconocido o borrado siempre obtiene el mismo 404.
En cuanto se conoce `organisationId`, todo el análisis, almacenamiento,
deduplicación y auditoría se ejecuta con `tenantClient(organisationId)` y las
políticas RLS ordinarias. La consulta global nunca devuelve comunicaciones,
contratos, usuarios ni datos de negocio.

Las direcciones tienen dos barreras de unicidad: la restricción compuesta que
Prisma conoce y un índice parcial global, insensible a mayúsculas, para alias no
borrados.

## Consecuencias

### Positivas

- El webhook puede determinar el tenant sin entregar al proveedor ninguna
  credencial de base de datos ni codificar identificadores internos en la
  dirección.
- El privilegio elevado queda concentrado en una función pequeña y auditable.
- Después de la resolución se recuperan todas las garantías de aislamiento de
  ADR 0005.

### Costes y riesgos aceptados

- La dirección del alias pasa a ser un identificador sensible; debe generarse
  con entropía suficiente y no aparecer en logs públicos.
- El secreto del webhook es compartido con el proveedor y necesita rotación.
- La entrega pública todavía depende de configurar MX/rutas entrantes en un
  proveedor de correo; M8 conectará esa infraestructura sin cambiar este
  contrato interno.

## Alternativas descartadas

### Incluir `organisationId` en la dirección

Reduce una consulta, pero expone estructura interna, sigue necesitando validar
que el alias existe y facilita enumeración. No aporta una mejora de seguridad.

### Dar al proveedor acceso directo a una tabla

Rechazada: rompe el límite de confianza y haría depender el aislamiento de la
configuración de un tercero.

### Probar cada tenant hasta encontrar el alias

Rechazada: es lineal, abre demasiadas transacciones RLS y convierte el tiempo de
respuesta en un canal lateral sobre el número de organizaciones.
