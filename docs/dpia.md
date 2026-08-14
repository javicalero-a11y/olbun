# Plantilla de evaluación de impacto: análisis de correspondencia operativa

> Plantilla de trabajo, no dictamen jurídico. Debe completarla y aprobarla el
> responsable del tratamiento con su DPD/asesoría antes de conectar el primer
> buzón real. No sustituye la evaluación exigible bajo RGPD art. 35.

## 1. Control y aprobación

- Organización responsable:
- DPD / asesor responsable:
- Responsable interno del tratamiento:
- Fecha de inicio y versión:
- Fecha de aprobación:
- Próxima revisión:
- Decisión: aprobado / aprobado con medidas / no aprobado.

## 2. Finalidad y alcance

- Servicios y contratos incluidos:
- Buzones funcionales incluidos:
- ¿Se propone algún buzón personal? Justificación individual:
- Finalidades concretas: detectar requerimientos, riesgos, incidentes y plazos;
  mantener evidencia; facilitar revisión humana.
- Usos excluidos: evaluación automática de rendimiento, vigilancia continua,
  decisiones disciplinarias automáticas, lectura ajena a la finalidad.

## 3. Datos y flujo

- Categorías de personas: empleados, personal del órgano de contratación,
  usuarios del servicio, proveedores y terceros citados.
- Datos tratados: cabeceras, cuerpo, adjuntos, identificadores de mensajes,
  señales propuestas y decisiones de revisión.
- Categorías especiales previsibles y cómo se minimizan:
- Origen, destinatarios y encargados:
- Transferencias internacionales y garantías:
- Si se usa Anthropic Message Batches: región contractual, conservación
  aplicable, ausencia de Zero Data Retention, DPA y autorización expresa:
- Plazo de conservación por categoría:

Flujo: proveedor de correo → OAuth de solo lectura → Olbun cifrado → análisis
local/servicio aprobado → cola humana → expediente, riesgo o incidencia solo si
una persona lo confirma.

## 4. Necesidad y proporcionalidad

- Por qué no basta un canal menos intrusivo:
- Por qué se incluye cada buzón:
- Ventana histórica aprobada:
- Contratos/etiquetas excluidos:
- Muestreo o limitación de adjuntos:
- Revisión de falsos positivos:
- Confirmación de que ninguna detección inicia por sí sola una actuación:

## 5. Base jurídica y transparencia

- Base jurídica por finalidad:
- Información facilitada a la plantilla y fecha:
- Información a terceros/remitentes cuando proceda:
- Política de uso de medios digitales aprobada, versión y documento:
- Consulta a la representación de los trabajadores, fecha y evidencia:
- Procedimiento de derechos de acceso, oposición, limitación y supresión:

## 6. Riesgos para las personas

Valorar probabilidad e impacto antes y después de controles:

| Riesgo                                        | Personas | Prob. inicial | Impacto inicial | Controles                               | Riesgo residual | Responsable |
| --------------------------------------------- | -------- | ------------- | --------------- | --------------------------------------- | --------------- | ----------- |
| Acceso a correspondencia fuera de finalidad   |          |               |                 | Buzones funcionales, RBAC, auditoría    |                 |             |
| Exposición de tokens o mensajes               |          |               |                 | AES-GCM, TLS, secretos, rotación        |                 |             |
| Falso positivo que cause una actuación        |          |               |                 | Citas verificadas y confirmación humana |                 |             |
| Tratamiento de datos especialmente sensibles  |          |               |                 | Minimización y permisos reforzados      |                 |             |
| Conservación excesiva                         |          |               |                 | Retención, hold litigioso y revisión    |                 |             |
| Transferencia internacional no controlada     |          |               |                 | Evaluación de proveedores y región      |                 |             |
| Vigilancia o efecto inhibidor en la plantilla |          |               |                 | Finalidad limitada y transparencia      |                 |             |

## 7. Medidas y evidencia de implantación

- [ ] OAuth delegado de solo lectura; sin contraseñas de buzón.
- [ ] Tokens cifrados y excluidos de logs/auditoría.
- [ ] Aislamiento RLS y pruebas cruzadas entre organizaciones.
- [ ] Ventana histórica máxima aprobada.
- [ ] Detecciones con citas verificables y revisión humana.
- [ ] Retención y bloqueo por litigio configurados.
- [ ] Procedimiento de brechas y revocación de tokens probado.
- [ ] Contrato de encargado y subencargados revisado.
- [ ] Uso de Anthropic/otro motor externo aprobado o desactivado; la ausencia
      de Zero Data Retention para Message Batches se ha evaluado.
- [ ] Formación y acceso por necesidad acreditados.

## 8. Riesgo residual y consulta previa

- Riesgos residuales altos:
- Medidas adicionales y plazo:
- ¿Requiere consulta previa a la autoridad de control? Motivo:
- Condiciones que obligan a repetir la evaluación: nuevo motor, nuevos tipos de
  buzón, ampliación de finalidad, nueva categoría sensible, proveedor o país.

## 9. Firmas

- Responsable del tratamiento:
- DPD / asesor:
- Seguridad:
- Representante de operaciones:
