# Metodología de riesgos e incidencias

Esta guía explica qué significa cada dato de M10. No sustituye el sistema de
gestión de PRL, el protocolo de brechas de datos, el plan de emergencia ni el
asesoramiento jurídico de cada organización.

## Riesgo e incidencia no son lo mismo

- Un **riesgo** es algo que todavía puede ocurrir. Se redacta como causa →
  evento → consecuencia para que el control actúe sobre una parte concreta.
- Una **incidencia** es un hecho que ya ocurrió. Conserva la descripción
  inicial, medidas inmediatas, investigación, causa raíz, lecciones y acciones.
- Una detección automática sólo propone. Una persona confirma si debe crear un
  riesgo o una incidencia y esa decisión queda auditada.

## Valoración

La puntuación es `probabilidad × impacto`, con ambos ejes entre 1 y 5. Se
distinguen tres momentos:

1. **Inherente:** exposición antes de considerar controles.
2. **Residual:** exposición demostrada después de los controles existentes.
3. **Histórico:** snapshot inmutable de cada apertura o revaloración.

«Sin residual valorado» no significa que el control haya reducido el riesgo a
la misma puntuación. Significa que todavía no hay una valoración documentada.
Si el residual supera al inherente se admite, pero exige una justificación:
ocultar el empeoramiento sería peor que señalar una posible incoherencia.

## Matriz y categorías

Cada organización administra sus categorías, nombres de nivel, colores y
fronteras. Las cuatro bandas deben cubrir todos los productos del 1 al 25 sin
huecos ni solapamientos. El color nunca comunica solo: cada celda y estado
incluye también el nombre y la puntuación.

Cambiar la matriz modifica la clasificación vigente. No altera la matriz
guardada en valoraciones históricas, por lo que un informe puede explicar por
qué una puntuación se llamó «Alta» en marzo aunque el umbral cambie en agosto.

## Controles, revisiones y acciones

- Un **control** puede ser preventivo, detectivo, correctivo o directivo. Su
  existencia no presupone eficacia; debe probarse y registrarse como no
  evaluado, ineficaz, parcial o eficaz.
- Una **revisión** documenta comprobaciones y programa la siguiente fecha. Al
  cerrar el riesgo deja de exigir otra revisión.
- Una **acción correctora** pertenece exactamente a un riesgo o a una
  incidencia. Su progreso y sus transiciones se validan en dominio y en base de
  datos. Verificarla requiere registrar la eficacia observada.

## Incidencias notificables

La casilla «hay que comunicarlo a una autoridad» es una señal de trabajo, no
una conclusión jurídica. Los plazos, canales y destinatarios dependen del tipo
de hecho, las personas afectadas y la normativa aplicable. Antes de cerrar una
incidencia marcada, el responsable debe confirmar la decisión con la función
competente —PRL, DPD, asesoría o dirección técnica— y conservar la referencia
de la comunicación. Olbun no envía una notificación regulatoria por sí solo.

Los nombres de organismos que aparecen como ayuda en el formulario son
ejemplos de referencia; no determinan cuál es competente en un caso real.

## Cadencia mínima de gobierno

- Revisar primero los riesgos vencidos y los de mayor nivel vigente.
- No aceptar una reducción residual sin controles o evidencia descritos.
- Examinar acciones bloqueadas y vencidas en cada reunión operativa.
- Revisar mensualmente las incidencias abiertas y los patrones repetidos.
- Auditar cualquier cambio de matriz antes de usarlo en un informe de comité.
