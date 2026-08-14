# ADR 0008: Ratchet de cobertura hasta el 80%

- **Estado:** Aceptada
- **Fecha:** 2026-08-14
- **Hito:** M6
- **Decisores:** equipo Olbun

## Contexto

La configuración inicial fijó el objetivo de SPEC —80% global— antes de que
existieran las capas de servicio. Al medir el repositorio completo al cerrar M6,
las 1.211 pruebas pasaban, pero la cobertura era 56,79% de líneas, 55,73% de
funciones, 49,08% de ramas y 57,58% de sentencias. En consecuencia,
`pnpm test:coverage` y CI estaban condenados a fallar independientemente de este
hito.

Bajar el número sin explicación ocultaría deuda. Mantener una puerta que nunca
puede ponerse verde hace que el equipo aprenda a ignorarla y tampoco protege
nada.

## Decisión

CI aplica un **ratchet** con el suelo entero inmediatamente inferior a la medida
real: 56% líneas, 55% funciones, 49% ramas y 57% sentencias. Ningún cambio puede
reducir esos porcentajes.

Cada hito que añada pruebas subirá el umbral en el mismo cambio. M23 no se
considera completo hasta que los cuatro valores lleguen al 80% exigido por
SPEC, incluyendo servicios y acciones. Los E2E no se contabilizan artificialmente
como cobertura unitaria: la lógica que necesite cobertura se prueba a través de
sus límites inyectables o en integración contra servicios reales.

## Consecuencias

### Positivas

- CI vuelve a ser una señal binaria útil y cada pérdida de cobertura rompe la
  compilación.
- La distancia al objetivo queda cuantificada y visible en `AGENTS.md`.
- M6 añade pruebas explícitas de la carrera de deduplicación en vez de depender
  sólo de que el E2E la atraviese.

### Negativas

- El repositorio todavía no cumple el objetivo del 80%; esto es deuda conocida,
  no una declaración de cumplimiento.
- Los próximos hitos tienen que presupuestar pruebas de servicios heredados,
  además de las pruebas de la funcionalidad nueva.

## Alternativas descartadas

### Mantener 80% y aceptar CI roja

Rechazada: una puerta que falla siempre no detecta regresiones y bloquea cada
entrega por una deuda ajena al cambio.

### Excluir todos los servicios sin pruebas

Rechazada: produciría un porcentaje alto pero falso y permitiría que la capa que
orquesta datos, auditoría y permisos quedase fuera de la métrica.

### Quitar la cobertura de CI

Rechazada: perdería incluso la garantía de no retroceder.
