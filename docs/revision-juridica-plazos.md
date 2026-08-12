# Revisión jurídica del motor de plazos

**Estado: PENDIENTE DE REVISIÓN POR ABOGADO.**
**Preparado por:** el equipo de desarrollo, que no tiene formación jurídica.
**Fecha:** 12 de agosto de 2026 (ampliado con el apartado 2.7 el mismo día)
**Código afectado:** `lib/domain/plazos/`, `lib/domain/fecha.ts`

---

## Qué es este documento y qué no es

Esto **no es** una revisión jurídica. Es el material para que un abogado pueda
hacerla en una sesión corta en lugar de tener que leer un repositorio entero.

Recoge, para cada regla que el sistema implementa: el precepto en que creemos
que se apoya, cómo la hemos programado exactamente, un ejemplo verificable a
mano, y las dudas concretas que no hemos sabido resolver.

**Por qué importa.** Si el sistema calcula mal un plazo preclusivo, un cliente
pierde el derecho a recurrir. No hay forma de arreglarlo después. Por eso el
motor marca hoy todos sus resultados como no verificados y la interfaz no debe
presentarlos como fechas firmes hasta que esta revisión se cierre.

**Lo que pedimos:** confirmar o corregir cada regla del apartado 2, y responder
a las preguntas del apartado 4. Nada más.

Las dos cuestiones con más consecuencias son la **4.1** (desde qué día cuentan
los plazos por meses) y la **2.7 / 4.6** (cómo se encadenan los plazos dentro de
un mismo procedimiento). Si sólo hubiera tiempo para dos, son ésas.

---

## 1. Cómo está construido

El cálculo es una función pura, sin acceso a base de datos ni a reloj propio: se
le pasan la fecha de inicio, la cantidad, el tipo de cómputo y los calendarios,
y devuelve el vencimiento **junto con la lista de días excluidos y el motivo de
cada exclusión**. Es decir, cualquier resultado se puede comprobar a mano sin
leer código.

Los calendarios de festivos están cargados **sin verificar** a propósito.
Mientras un año no esté verificado contra su fuente oficial, todo plazo
calculado sobre él se devuelve marcado como incompleto.

---

## 2. Reglas implementadas

### 2.1 Inicio del cómputo

|                            |                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Precepto que aplicamos** | art. 30.3 Ley 39/2015                                                                                     |
| **Regla programada**       | El cómputo empieza el día **siguiente** al de la notificación. El día de la notificación nunca se cuenta. |
| **Ejemplo**                | Notificación lunes 2 de marzo de 2026, plazo de 1 día hábil → vence martes 3.                             |

### 2.2 Días hábiles en vía administrativa

|                      |                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Precepto**         | art. 30.2 Ley 39/2015                                                                                         |
| **Regla programada** | Se excluyen sábados, domingos y días declarados festivos (nacional, autonómico y local). **Agosto es hábil.** |
| **Ejemplo**          | Jueves 5 de marzo de 2026 + 3 días hábiles → viernes 6, lunes 9, martes 10. Vence el 10.                      |

### 2.3 Días hábiles en vía judicial

|                      |                                                                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Precepto**         | art. 182 LOPJ                                                                                                                                                                       |
| **Regla programada** | Se excluyen sábados, domingos, festivos, **todo el mes de agosto**, y el **24 y el 31 de diciembre**.                                                                               |
| **Excepción**        | Los asuntos urgentes en los que agosto sí es hábil se marcan expresamente al crear el plazo. El sistema **no** deduce la urgencia: es un juicio jurídico, no un dato de calendario. |
| **Ejemplo**          | Jueves 30 de julio de 2026 + 2 días hábiles judiciales → viernes 31 de julio, y después todo agosto se salta: vence el martes 1 de septiembre.                                      |

### 2.4 Plazos por meses y años

|                      |                                                                                                                                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Precepto**         | art. 30.4 Ley 39/2015                                                                                                                                                                                                            |
| **Regla programada** | Se cuenta **de fecha a fecha**, desde el día de la notificación y no desde el siguiente. Si en el mes de vencimiento no existe el día equivalente, vence el último día de ese mes. Los festivos intermedios no alargan el plazo. |
| **Ejemplo 1**        | Notificación 16 de marzo, 1 mes → vence 16 de abril.                                                                                                                                                                             |
| **Ejemplo 2**        | Notificación 31 de enero, 1 mes → 30 de febrero no existe → vence 28 de febrero (29 en bisiesto).                                                                                                                                |

> ⚠️ Este es el punto donde más nos preocupa habernos equivocado: la
> combinación de "de fecha a fecha" (art. 30.4) con el inicio "el día
> siguiente" (art. 30.3) admite más de una lectura. Ver pregunta 4.1.

### 2.5 Vencimiento en día inhábil

|                      |                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Precepto**         | art. 30.5 Ley 39/2015                                                                                                     |
| **Regla programada** | Si el último día cae inhábil, se prorroga al primer día hábil siguiente. Se aplica también a los plazos por meses y años. |
| **Ejemplo**          | Notificación 30 de enero de 2026, 1 mes → 28 de febrero, que es sábado → vence el lunes 2 de marzo.                       |

### 2.6 Efectos de la notificación electrónica

|                      |                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Precepto**         | art. 43.2 Ley 39/2015                                                                                                                                                                            |
| **Regla programada** | La notificación surte efecto en la fecha de acceso; si transcurren **10 días naturales** desde la puesta a disposición sin acceder, se entiende rechazada y esa fecha es la que inicia el plazo. |
| **Ejemplo**          | Puesta a disposición el 2 de marzo, sin acceso → efectos el 12 de marzo.                                                                                                                         |
| **Salvaguarda**      | El sistema **propone** esta fecha; una persona la confirma antes de que ningún plazo empiece a correr.                                                                                           |

### 2.7 Encadenamiento de plazos dentro de un procedimiento

|                      |                                                                                                                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Precepto**         | Ninguno: es una regla nuestra, no legal. Por eso la señalamos aparte.                                                                                                                                            |
| **Regla programada** | Al abrir un expediente desde una plantilla se instancian todos sus hitos de golpe. **Cada paso cuenta desde el anterior, no desde la apertura.**                                                                 |
| **Por qué**          | El plazo para recurrir corre desde la resolución que se recurre. Calcularlo desde la apertura mostraría una ventana de recurso cerrándose semanas antes de que exista la resolución.                             |
| **Ejemplo**          | Notificación el 6 de agosto → alegaciones (10 días hábiles) vencen el 20 de agosto → resolución estimada 45 días después, el 4 de octubre → recurso de reposición (1 mes) vence el 4 de noviembre.               |
| **Salvaguarda**      | En cuanto la cadena pasa por una fecha **estimada** (la resolución del ejemplo), todo lo posterior se marca como cálculo incompleto y lo dice en pantalla, por muy correcta que sea la aritmética de calendario. |

---

## 3. Lo que el sistema deliberadamente NO hace

- **No decide si un asunto es urgente** a efectos de la inhabilidad de agosto.
- **No fija plazos por sí solo.** Un plazo mencionado en un correo genera una
  detección para revisión humana, nunca un plazo vivo.
- **No presenta como firme** ningún cálculo apoyado en un calendario sin
  verificar.

---

## 4. Preguntas que no hemos sabido resolver

### 4.1 Plazos por meses: ¿desde qué día?

Programamos que un plazo de un mes notificado el 16 de marzo vence el 16 de
abril (de fecha a fecha desde la notificación). La lectura alternativa —
empezar el día siguiente, art. 30.3, y contar el mes desde ahí — daría el 17 de
abril. **¿Cuál es la correcta?** Un día de diferencia en un plazo preclusivo lo
decide todo.

### 4.2 ¿Qué calendario local prevalece?

Cuando el interesado y el órgano están en municipios distintos, ¿qué festivos
locales cuentan: los del domicilio del interesado, los de la sede del órgano, o
los de ambos? Hoy el sistema aplica el calendario del municipio del **órgano**.
Es la decisión con más impacto práctico, porque nuestros clientes operan en
muchos municipios a la vez.

### 4.3 Alcance real de la inhabilidad de agosto

Excluimos agosto entero en la vía judicial. ¿Es correcto para todos los órdenes
jurisdiccionales que nos afectan — contencioso-administrativo y social — o hay
diferencias? ¿Y qué actuaciones concretas de las que gestionamos entran en la
excepción de urgencia?

### 4.4 Recurso especial en materia de contratación

El plazo del recurso especial (art. 50 LCSP) ¿se computa en días hábiles
administrativos como el resto, o tiene reglas propias? ¿Y el cómputo cambia
según el acto recurrido?

### 4.5 Suspensión e interrupción

Tenemos modelado que la papeleta de conciliación **suspende** el plazo de
caducidad de la acción de despido (20 días hábiles, art. 59.3 ET). ¿Suspende o
interrumpe? ¿Cuándo se reanuda exactamente?

### 4.6 ¿Desde cuándo cuenta el paso siguiente?

Cuando un trámite tiene plazo (por ejemplo, 10 días hábiles para alegar), el
sistema hace arrancar el paso siguiente el día del **vencimiento** de ese plazo,
porque es la fecha más tardía posible y la más prudente para planificar. En la
práctica el escrito suele presentarse antes. **¿Es aceptable como estimación de
planificación**, entendiendo que se sustituye por la fecha real en cuanto se
registra el trámite, o induce a error?

### 4.7 Traslados de festivos

Cuando un festivo nacional cae en domingo y se traslada, ¿el día trasladado es
inhábil a todos los efectos, o sólo laboralmente? Afecta a cómo cargamos los
calendarios.

---

## 5. Qué haremos con las respuestas

Cada respuesta se traduce en: la regla corregida en el código, un test que la
fija con un ejemplo concreto, y la cita del precepto en el propio resultado que
ve el usuario. El motor devuelve siempre el fundamento junto a la fecha, de modo
que quien reciba un aviso pueda comprobar de dónde sale.

Cuando este documento esté firmado, los calendarios pasarán a verificados y la
interfaz podrá presentar los vencimientos como fechas firmes.

---

## 6. Anexo — cómo comprobar un cálculo

Los tests en `lib/domain/plazos/computo.test.ts` están escritos con fechas
reales de 2026 y comentarios en castellano explicando el recuento día a día.
Cualquiera de ellos se puede verificar con un calendario delante. Ejemplo:

```
Notificación: jueves 5 de marzo de 2026
Plazo: 3 días hábiles administrativos
Cómputo: viernes 6 (1), sábado 7 y domingo 8 excluidos, lunes 9 (2), martes 10 (3)
Vencimiento: martes 10 de marzo de 2026
```
