# ADR 0011: Histórico inmutable y matriz de riesgo por organización

- **Estado:** Aceptada
- **Fecha:** 2026-08-14
- **Hito:** M10

## Contexto

La valoración de un riesgo cambia a medida que aparecen controles y evidencia.
El registro vivo debe reflejar el juicio vigente, pero una revisión posterior no
puede borrar qué se declaró antes, con qué matriz ni quién lo declaró. Además,
dos contratistas pueden usar umbrales y taxonomías distintas sin que el código
de la aplicación contenga listas propias de cada cliente.

El modelo inicial conservaba la categoría como un enum fijo. Eso contradecía el
requisito de configuración por tenant y habría obligado a desplegar una
migración para cada nueva categoría de negocio.

## Decisión

1. Mantener en `Riesgo` los ejes inherentes y residuales vigentes para ordenar,
   filtrar y explicar la situación actual con una consulta rápida.
2. Insertar una `ValoracionRiesgo` cada vez que nace el riesgo o cambian sus
   puntuaciones. Guarda los seis valores, los niveles, la justificación y una
   copia JSON de las bandas aplicadas.
3. Insertar una `RevisionRiesgo` por cada revisión periódica, incluso cuando el
   resultado sea «sin cambios». Valoraciones y revisiones tienen triggers de
   solo inserción: ni el rol de aplicación ni un administrador ordinario puede
   reescribir o borrar su historia.
4. Modelar los controles y las acciones correctoras como registros con
   responsable, evidencia temporal, eficacia y estado; no esconderlos en un
   único campo de texto.
5. Guardar `BandaRiesgo` y `CategoriaRiesgo` como datos tenant con RLS. Los
   registros nuevos nacen con una matriz 5×5 coherente y nueve categorías
   editables. Cambiar los nombres o umbrales afecta a la lectura vigente, no a
   los snapshots históricos.
6. Desactivar una categoría impide seleccionarla en un riesgo nuevo, pero no
   oculta ni reclasifica riesgos anteriores.
7. Migrar el enum heredado a `categoriaId` sin destruir la columna original.
   La columna antigua queda temporalmente como copia recuperable y se retirará
   sólo en una migración posterior, cuando una comprobación de producción
   confirme que no queda ninguna fila sin relación.

## Consecuencias

- Un cambio metodológico no falsifica tendencias ni actas anteriores. La UI
  reconstruye el nombre del nivel desde la matriz guardada en cada snapshot.
- El registro vivo puede cambiar de banda al modificar umbrales sin que cambie
  la puntuación. Eso es esperado y queda auditado como cambio de configuración.
- `categoriaId` es nullable en la base únicamente para conservar filas
  históricas huérfanas durante la transición. Zod y los servicios exigen una
  categoría activa en toda alta válida.
- Los informes de tendencia deben leer `ValoracionRiesgo`, no inferir historia
  desde `updatedAt` de `Riesgo`.

## Alternativas descartadas

- **Guardar sólo la puntuación vigente:** rápido, pero incapaz de probar qué
  sabía la organización en una fecha concreta.
- **Calcular siempre con la matriz actual:** reescribe semánticamente el pasado
  cuando cambia un umbral.
- **Mantener categorías como enum Prisma:** seguro en tipos, pero contrario a
  la configuración por cliente y costoso de operar.
- **Copiar el riesgo entero en cada revisión:** duplica datos no relacionados
  con la valoración y dificulta distinguir un cambio de contenido de uno de
  puntuación.
