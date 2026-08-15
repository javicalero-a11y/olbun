# Inventario de protección de datos — personal M11

Documento de ingeniería, no dictamen jurídico. El responsable del tratamiento
y su DPD/asesoría deben aprobar finalidad, base jurídica, información a la
plantilla y conservación antes de usar datos reales.

| Datos                                               | Finalidad prevista                                | Acceso                                          | Protección                                                        | Conservación a validar                                  |
| --------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| Nombre, correo, puesto y nº interno                 | Directorio y asignación operativa                 | `empleado:view` y alcance contractual           | RLS, auditoría de mutaciones                                      | Relación laboral + periodo legal aplicable              |
| NIF/NIE, NSS y CCC                                  | Identificación laboral inequívoca                 | `empleado:view_sensitive`                       | AES-256-GCM; NIF con índice ciego HMAC; auditoría en cada lectura | Bloqueada hasta política aprobada                       |
| Convenio, categoría, jornada y antigüedad           | Coste, subrogación y cobertura contractual        | `empleado:view`                                 | RLS; historial de vigencias                                       | Relación contractual/laboral + defensa de reclamaciones |
| Complemento ad personam                             | Preparación de cálculo retributivo                | `empleado:view_sensitive`                       | AES-256-GCM; no se muestra en listados                            | Nómina y obligaciones fiscales/laborales aplicables     |
| Reducción, discapacidad y circunstancias protegidas | Ajustes y disponibilidad estrictamente necesarios | `empleado:view_sensitive`                       | AES-256-GCM; auditoría de lectura                                 | Minimización reforzada; revisión periódica              |
| Referencia de certificación                         | Acreditar habilitación                            | `empleado:view` para estado; referencia cifrada | AES-256-GCM; documento separado                                   | Según obligación o contrato                             |
| Personas implicadas en una incidencia               | Investigar y gestionar el hecho                   | `incidencia:view_sensitive`                     | Sobre AES-256-GCM; auditoría en cada lectura                      | Según tipo de incidente y reclamaciones                 |

## Reglas operativas

- No introducir diagnósticos, afiliación sindical ni narrativas médicas en
  campos libres si basta con un estado operativo.
- Una jefatura de contrato ve sólo las personas adscritas a sus contratos; la
  mera pertenencia a la organización no amplía ese alcance.
- Exportaciones, nómina y expedientes disciplinarios requieren permisos
  distintos en hitos posteriores; M11 no los infiere de `empleado:view`.
- Las referencias salariales del convenio no son salario neto ni cálculo de
  nómina. No deben usarse para pagar sin el flujo validado de M21–M22.
- Los datos demo son íntegramente ficticios y llevan dominio
  `demo.olbun.local`; nunca se mezclarán con un tenant real.

## Validaciones pendientes del responsable/DPD

1. Base jurídica y finalidad exacta por cliente y categoría de dato.
2. Plazos de conservación por dato, litigio y obligación de Seguridad Social.
3. Información y procedimiento de ejercicio de derechos de la plantilla.
4. Necesidad de DPIA para la combinación de vigilancia operativa, correo,
   incidencias y datos laborales.
5. Proveedores, región, KMS y procedimiento de respuesta ante brechas del
   despliegue de producción.
