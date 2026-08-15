# ADR 0012: Datos personales cifrados y adscripción contractual

- **Estado:** Aceptada
- **Fecha:** 2026-08-14
- **Hito:** M11

## Contexto

Olbun necesita responder quién presta cada contrato, bajo qué convenio y con
qué habilitaciones. Parte de esa respuesta —NIF/NIE, afiliación, CCC,
retribución individual, discapacidad o personas implicadas en un accidente— no
debe aparecer en los listados operativos ni quedar legible en una copia de la
base de datos. Además, el producto español aún no tiene una entidad `Servicio`:
la unidad operativa disponible y jurídicamente trazable es el contrato y su
centro de trabajo.

## Decisión

1. Separar los datos de directorio de `Empleado` de dos cargas cifradas:
   identificación y circunstancias laborales/retributivas. AES-256-GCM genera
   un IV aleatorio y autentica cada valor; Prisma sólo recibe el sobre cifrado.
2. Buscar duplicados de NIF mediante un índice ciego HMAC, nunca guardando el
   NIF normalizado. Durante una rotación se consultan índices producidos por la
   clave actual y por las anteriores autorizadas.
3. Exigir `empleado:view_sensitive` o `incidencia:view_sensitive` para
   descifrar. Cada lectura protegida se registra como evento `ACCESO`; la
   auditoría nunca guarda el contenido.
4. Guardar `Incidencia.personasImplicadas` como un sobre JSON
   `{ version, cifrado }`. Un rol puede investigar una incidencia sin recibir
   automáticamente datos de salud o identidad.
5. Modelar convenio, categoría y tabla salarial como datos versionados por
   organización. La tabla publicada calcula el precio ordinario, pero no
   sustituye una nómina ni decide automáticamente el salario individual.
6. Adscribir cada empleado a un `Contrato`, categoría y centro con periodo,
   horas y dedicación. Se avisa por encima del 100 % y se bloquea por encima del
   150 %. La comparación de M11 es una línea base estática; M12 descontará
   ausencias y disponibilidad real.
7. No introducir una entidad ficticia `Servicio` sólo para imitar el prompt
   británico original. Cuando el dominio español necesite centros o lotes con
   vida propia, se añadirá mediante una migración explícita.

## Rotación de claves

1. Generar una clave nueva de 32 bytes en base64 y conservar la vigente en el
   gestor de secretos.
2. Configurar la nueva como `ENCRYPTION_KEY` y añadir la anterior a
   `ENCRYPTION_PREVIOUS_KEYS`. Las nuevas escrituras usan sólo la nueva; las
   lecturas y la detección de NIF duplicado aceptan ambas.
3. Probar lectura de empleados, certificados, MFA, tokens de buzón e
   incidencias; guardar evidencia de la prueba y una copia recuperable de la
   base antes de retirar nada.
4. Reencriptar por lotes todos los sobres cuyo identificador de clave sea el
   antiguo y recalcular sus índices ciegos. La automatización y KMS pertenecen
   a M23; hasta entonces esta operación requiere ventana de mantenimiento y
   script revisado para el despliegue concreto.
5. Retirar la clave anterior sólo después de contar cero sobres e índices
   antiguos y verificar restauración. Sustituirla antes deja datos
   irrecuperables.

## Consecuencias

- Una copia de PostgreSQL no expone directamente los campos protegidos, aunque
  un host de aplicación comprometido sí puede usar la clave; KMS y cifrado por
  envolvente siguen en M23.
- Los listados pueden ser rápidos y accesibles sin descifrar cada fila.
- La auditoría crece con cada lectura sensible, que es el comportamiento
  deseado para investigación, salud y retribución.
- Las cifras salariales son referencia de convenio. Nómina, cotización,
  tributación y atrasos permanecen en M21–M22 y exigirán validación profesional.

## Alternativas descartadas

- **Columnas en claro con RBAC:** protege la interfaz, pero no copias, consultas
  administrativas ni errores de logging.
- **Cifrar la fila completa:** impide ordenar y filtrar el directorio sin
  descifrarlo entero.
- **Hash simple del NIF:** el espacio es pequeño y admite tablas precalculadas;
  HMAC necesita la clave del sistema.
- **Usar `Servicio` sin que exista en el dominio:** añade una abstracción vacía
  y rompe la trazabilidad inmediata con pliego y contrato.
