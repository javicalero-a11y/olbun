# Olbun — Riesgo, incidencias y litigios para contratistas de servicios públicos (España)

> **This document supersedes the original SPEC.md** (UK public-sector assurance platform, git `b1e9d5b`). It was redirected on 2026-08-11 after the product brief changed: Spain rather than the UK, correspondence-driven risk detection rather than a general assurance register, and litigation progression as a first-class entity.
>
> **What carries over unchanged from the original** and is not restated here: §3 technology stack, §7 security and application hardening, §8 non-functional requirements, §9 UX and visual design direction, §13 testing requirements, §14 per-milestone output order, §15 working method. Those sections were sound and are still binding. Everything else is replaced by what follows.
>
> **Status:** M0 (foundation) is built and green against this stack. M1 onwards follows the milestone plan in §8 below, not the original §12.

---

## 0. Mission

Olbun is a multi-tenant SaaS for Spanish companies that deliver services to the public sector — Lude Servicios, EBONE, BPX Sport, Calmart Servicios, EULEN and their peers.

These companies run dozens of concurrent contracts with ayuntamientos, diputaciones, comunidades autónomas, servicios de salud and public enterprises. Their commercial risk is not that they deliver badly — it is that a problem visible in a mailbox in March becomes a *penalidad* in June, an *expediente sancionador* in September, and a *recurso contencioso-administrativo* the following year, with nobody having connected the four. Meanwhile a *plazo* nobody diarised expires and the right to challenge is lost.

**The promise:** *"Cada incidencia que detectamos, cada plazo que corre, y cada expediente abierto — con su cronología completa y sin un solo vencimiento perdido."*

Three things the product does, in dependency order:

1. **Compute deadlines correctly.** Días hábiles under Ley 39/2015, per the calendario laboral of the right comunidad autónoma and municipio, with the dies a quo derived from the electronic notification. This is the engine everything else sits on.
2. **Track disputes as they progress.** Every expediente as a timeline of procedural milestones (hitos) with their plazos, rendered as a Gantt, scaffolded automatically from a template for its procedure type.
3. **Surface problems before they become disputes.** Ingest operational correspondence, detect the signals that precede a claim — requerimientos, preavisos de penalidad, reclamaciones — and route them to a human who confirms or dismisses.

---

## 1. Users

| Persona | Rol | Necesita | Pantallas |
|---|---|---|---|
| **Director de Operaciones** | `ORG_ADMIN` | Exposición total por litigios, provisiones, contratos en riesgo | Cuadro de mando, mapa de riesgos |
| **Responsable de contrato** | `GESTOR_CONTRATO` | Sus contratos: incidencias, requerimientos pendientes, penalidades | Espacio de contrato, bandeja |
| **Asesoría jurídica (interna)** | `JURIDICO` | Todos los expedientes, plazos, escritos, coordinación con despacho externo | Expedientes, calendario de plazos |
| **Despacho externo** | `LETRADO_EXTERNO` | Acceso limitado a sus expedientes y documentación | Expediente en modo alcance limitado |
| **Responsable de calidad / PRL** | `CALIDAD` | Incidencias, no conformidades, acciones correctoras | Incidencias, acciones |
| **RRHH / Relaciones laborales** | `RRHH` | Subrogaciones, reclamaciones laborales, papeleta de conciliación | Subrogación, expedientes sociales |
| **Administración** | `ADMIN_CONTABLE` | Facturas impagadas, intereses de demora, provisiones | Impagos, provisiones |
| **Supervisor de servicio** | `CONTRIBUTOR` | Reportar incidencias desde el móvil, adjuntar fotos | Alta rápida de incidencia |

---

## 2. Principios de producto

1. **El plazo manda.** Todo cálculo de plazo cita su fundamento jurídico y es auditable. Un plazo no verificado por una persona nunca se presenta como definitivo.
2. **La IA propone, la persona dispone.** Ninguna detección automática abre un expediente, fija un plazo ni notifica al cliente sin confirmación humana explícita. Toda detección guarda la cita literal que la justifica.
3. **Todo cuelga de un Contrato.** Servicios, incidencias, expedientes, plazos y costes son hijos de un contrato (o, excepcionalmente, de la organización).
4. **Trazabilidad total.** Toda mutación escribe un evento de auditoría inmutable. Nada se borra en duro salvo por retención o derecho de supresión, ambos auditados.
5. **Configurable, no cableado.** Tipos de expediente, plantillas de procedimiento, escalas de riesgo, calendarios y campos personalizados son datos del tenant.
6. **Correo funcional, no personal.** La ingesta por defecto es sobre buzones funcionales. El acceso a buzones individuales exige política interna documentada y consulta con la representación de los trabajadores (LOPDGDD art. 87) — el sistema lo bloquea hasta registrar ambas.

---

## 3. Stack — deltas sobre el original

Todo lo del §3 original sigue vigente. Añadidos:

- **IA:** `@anthropic-ai/sdk`, modelo `claude-opus-5`. Clasificación y extracción sobre correspondencia en español. Adaptive thinking; `effort` ajustado por ruta (`low` para triaje, `high` para extracción de plazos).
- **Salida estructurada:** `output_config.format` con esquema JSON generado desde Zod (`zodOutputFormat`), de modo que el esquema de validación y el esquema del modelo son el mismo objeto.
- **Coste:** caché de prompt sobre el prompt de sistema y la taxonomía (mínimo cacheable 512 tokens en Opus 5); Batch API (50% de descuento) para la carga inicial de histórico de buzón. Estimación: ~0,022 €/correo sin optimizar, ~0,006 € con caché + batch.
- **Ingesta de correo:** Microsoft Graph y Gmail API (buzones funcionales, OAuth), alias de reenvío por contrato, y carga manual `.eml`/`.msg`/PDF. Las tres, según el brief.
- **i18n:** `next-intl` con `es-ES` como locale primario y único en v1. Fechas `dd/MM/yyyy`, moneda EUR, zona `Europe/Madrid`.

**Convención de nomenclatura (decisión):** los modelos cuyo término español *es* el término jurídico de referencia conservan el nombre español — `Expediente`, `Plazo`, `Notificacion`, `Penalidad`, `Subrogacion`, `Hito`. La infraestructura genérica va en inglés — `Organisation`, `User`, `Document`, `Task`. Traducir "expediente" a "case" pierde precisión legal y genera errores; mezclar idiomas en infraestructura genérica no aporta nada. La regla se documenta en `AGENTS.md`.

---

## 4. Modelo de dominio

Reglas de columnas, índices, cuid2, soft-delete y modelos append-only: según ADR 0003 y ADR 0004 ya aceptados. Sin arrays de claves ajenas.

### 4.1 Tenancy e identidad

Sin cambios sobre el original (`Organisation`, `User`, `Membership`, `Team`, `ApiKey`, `AccessGrant`), con estos añadidos:

- **Organisation** — `nif`, `cnae`, `domicilioSocial`, `esPyme`, `codigoROLECE`.
- **AccessGrant** — se usa para `LETRADO_EXTERNO`: alcance a expedientes concretos, con caducidad.

### 4.2 Cliente público y contrato

- **PoderAdjudicador** — `nombre`, `nif`, `codigoDIR3` (Directorio Común de Unidades Orgánicas — identificador real y estable), `tipo` (AYUNTAMIENTO, DIPUTACION, CABILDO_CONSELL, COMUNIDAD_AUTONOMA, AGE, ORGANISMO_AUTONOMO, ENTIDAD_PUBLICA_EMPRESARIAL, SERVICIO_SALUD, UNIVERSIDAD, CONSORCIO, MANCOMUNIDAD, EMPRESA_PUBLICA, OTRO), `comunidadAutonoma`, `provincia`, `municipio` (código INE — necesario para el calendario laboral), `sedeElectronicaUrl`, `perfilContratanteUrl`.
- **ContactoPoderAdjudicador** — `nombre`, `cargo`, `email`, `telefono`, `esResponsableContrato`, `esEscalado`.
- **Contrato** — `numeroExpediente` (el del órgano de contratación), `objeto`, `tipo` (SERVICIOS, OBRAS, SUMINISTROS, CONCESION_SERVICIOS, CONCESION_OBRAS, MIXTO, PRIVADO), `procedimiento` (ABIERTO, ABIERTO_SIMPLIFICADO, ABIERTO_SIMPLIFICADO_ABREVIADO, RESTRINGIDO, NEGOCIADO_SIN_PUBLICIDAD, LICITACION_CON_NEGOCIACION, DIALOGO_COMPETITIVO, ASOCIACION_INNOVACION, CONTRATO_MENOR, ACUERDO_MARCO, SISTEMA_DINAMICO, ENCARGO_MEDIO_PROPIO), `lote`, `cpv[]`, `enlacePLACSP`, `fechaAdjudicacion`, `fechaFormalizacion`, `fechaInicio`, `duracionInicialMeses`, `prorrogas` (JSONB: número, duración, preaviso en días), `fechaFinPrevista`, `importeAdjudicacion`, `importeMaximo`, `iva`, `revisionDePrecios` (bool + fórmula), `garantiaDefinitiva`, `plazoGarantiaMeses`, `responsableDelContratoId`, `haySubrogacionPersonal`, `regimenPenalidades` (JSONB), `estado` (LICITACION, ADJUDICADO, FORMALIZADO, EN_EJECUCION, PRORROGADO, SUSPENDIDO, EN_LIQUIDACION, FINALIZADO, RESUELTO, PERDIDO).
- **Modificado** — `contratoId`, `referencia`, `tipo` (MODIFICADO_PREVISTO, MODIFICADO_NO_PREVISTO, REVISION_PRECIOS, REEQUILIBRIO, PRORROGA, SUSPENSION), `descripcion`, `importe`, `porcentajeSobreAdjudicacion`, `fechaSolicitud`, `fechaAprobacion`, `estado`, `expedienteId` (si acaba en litigio).
- **Servicio** — unidad de ejecución dentro del contrato: `contratoId`, `nombre`, `centroDeTrabajo`, `municipio`, `responsableId`, `plantillaPrevista`, `estado`.
- **Subcontrata** — `nombre`, `nif`, `objeto`, `importe`, `porcentaje`, `comunicadaAlOrgano`, `fechaComunicacion`.

### 4.3 Correspondencia e ingesta

- **BuzonConectado** — `tipo` (MS365_FUNCIONAL, GOOGLE_FUNCIONAL, IMAP, ALIAS_REENVIO, CARGA_MANUAL), `direccion`, `contratoId` (nullable), `estadoOAuth`, `ultimaSincronizacion`, `politicaInternaDocumentoId`, `consultaRepresentacionFechaId`. **Los dos últimos campos son obligatorios para tipos que accedan a buzones de persona física; la aplicación rechaza la conexión sin ellos.**
- **Comunicacion** — `buzonId`, `messageIdRFC` (único por organización — deduplicación), `threadId`, `direccion` (ENTRANTE/SALIENTE), `de`, `para[]`, `cc[]`, `asunto`, `fechaEnvio`, `fechaRecepcion`, `cuerpoTexto`, `cuerpoHtmlSanitizado`, `origen`, `contratoId`, `expedienteId`, `confianzaVinculacion`, `estadoRevision`, `esConfidencial`.
- **Adjunto** — `comunicacionId`, `nombre`, `mimeType`, `tamano`, `storageKey`, `sha256`, `estadoAntivirus`, `textoExtraido`.
- **Notificacion** — **la pieza crítica.** La notificación electrónica es lo que hace nacer el plazo: `origen` (NOTIFICA_DEHU, SEDE_ELECTRONICA, PLACSP, LEXNET, PAPEL, COMPARECENCIA), `poderAdjudicadorId`, `contratoId`, `referencia`, `asunto`, `fechaPuestaADisposicion`, `fechaAcceso`, `fechaRechazoTacito` (calculada: puesta a disposición + 10 días naturales, art. 43.2 Ley 39/2015), `fechaEfectosNotificacion` (la que se usa como dies a quo, derivada y **confirmada por una persona**), `documentoId`, `expedienteId`.

### 4.4 Detección (IA)

- **Deteccion** — `comunicacionId` o `notificacionId`, `tipo` (REQUERIMIENTO_FORMAL, PREAVISO_PENALIDAD, INCUMPLIMIENTO_ALEGADO, RECLAMACION_USUARIO, QUEJA_FORMAL, IMPAGO_FACTURA, SOLICITUD_MODIFICADO, AMENAZA_RESOLUCION, INICIO_EXPEDIENTE_SANCIONADOR, ASUNTO_LABORAL, SUBROGACION, SINIESTRO, PLAZO_MENCIONADO, RIESGO_PRL), `confianza` (0–1), `extractos` (JSONB: array de `{texto, inicioChar, finChar}` — citas literales verificadas), `datosExtraidos` (JSONB tipado por `tipo`: importes, fechas, artículos citados, plazo mencionado), `estado` (NUEVA, CONFIRMADA, DESCARTADA, CONVERTIDA), `revisadaPorId`, `revisadaEn`, `motivoDescarte`, `modelId`, `promptVersion`, `costeTokens`.

**Restricción técnica y su solución.** La función de *citations* de la API y la salida estructurada JSON son mutuamente excluyentes (devuelve 400). Como necesitamos ambas cosas — un objeto tipado *y* una cita verificable — el pipeline usa salida estructurada y pide al modelo que devuelva los extractos como campos del esquema. **Cada extracto se verifica en servidor por coincidencia exacta de subcadena contra el texto original antes de persistirse**; un extracto que no case se descarta y baja la confianza de la detección. Así la cita es comprobable sin depender de la buena fe del modelo. Documentar en ADR.

### 4.5 Expedientes y litigios — el núcleo

- **Expediente** — `referencia` (auto `EXP-2026-0001`), `titulo`, `jurisdiccion` (ADMINISTRATIVA, CONTENCIOSO_ADMINISTRATIVA, SOCIAL, CIVIL, PENAL, ARBITRAJE, EXTRAJUDICIAL), `tipo`:
  - *Vía contractual:* PENALIDAD, EXPEDIENTE_SANCIONADOR, RESOLUCION_CONTRATO, MODIFICADO, REEQUILIBRIO_ECONOMICO, REVISION_PRECIOS, LIQUIDACION, DEVOLUCION_GARANTIA, IMPAGO_MOROSIDAD
  - *Vía impugnación:* RECURSO_ESPECIAL_CONTRATACION, RECURSO_ALZADA, RECURSO_REPOSICION, RECURSO_CONTENCIOSO, RECLAMACION_PREVIA
  - *Vía laboral:* SUBROGACION, DESPIDO, RECLAMACION_CANTIDAD, CONFLICTO_COLECTIVO, SANCION_ITSS, ACCIDENTE_TRABAJO
  - *Terceros:* RESPONSABILIDAD_PATRIMONIAL, RECLAMACION_TERCERO, SINIESTRO

  Más: `contratoId`, `servicioId`, `poderAdjudicadorId`, `parteContraria`, `organoCompetente` (texto libre + `organoTipo`: TACRC, TARC_AUTONOMICO, JUZGADO_CONTENCIOSO, TSJ, AUDIENCIA_NACIONAL, JUZGADO_SOCIAL, SMAC_CMAC, ITSS, ORGANO_CONTRATACION, TRIBUNAL_ARBITRAL), `numeroAutos`, `cuantia`, `cuantiaIndeterminada`, `provisionContable`, `probabilidadExito` (ALTA/MEDIA/BAJA/REMOTA — alineado con criterio de provisión), `estado` (BORRADOR, ABIERTO, EN_TRAMITE, SUSPENDIDO, PENDIENTE_RESOLUCION, RESUELTO, RECURRIDO, ARCHIVADO), `faseActual`, `responsableInternoId`, `despachoExternoId`, `origenDeteccionId`, `riesgoId`, `fechaApertura`, `fechaResolucion`, `sentido` (ESTIMATORIA_TOTAL, ESTIMATORIA_PARCIAL, DESESTIMATORIA, ALLANAMIENTO, DESISTIMIENTO, ACUERDO, CADUCIDAD, INADMISION), `importeReclamado`, `importePagado`, `importeRecuperado`, `costeDefensa`, `esConfidencial`, `visibleParaCliente`.
- **PlantillaProcedimiento** — configurable por tenant, sembrada con las secuencias estándar por `tipo` de expediente. Define la lista ordenada de hitos y, para cada uno, el plazo asociado (días, cómputo y fundamento). Abrir un expediente instancia su plantilla y genera el Gantt completo de golpe. **Es la palanca de valor del producto.**
- **Hito** — `expedienteId`, `plantillaHitoId`, `nombre`, `orden`, `tipo` (PRESENTACION_ESCRITO, RECEPCION_NOTIFICACION, VISTA_JUICIO, PRUEBA, RESOLUCION, PAGO, ACTUACION_INTERNA), `fechaPrevista`, `fechaReal`, `estado` (PENDIENTE, EN_CURSO, CUMPLIDO, VENCIDO, NO_APLICA), `esPlazoLegal`, `responsableId`, `documentoId`, `notas`.
- **Plazo** — `expedienteId`, `hitoId`, `descripcion`, `fundamento` (texto: p. ej. *"art. 44.2 LCSP — 15 días hábiles desde la notificación"*), `fechaInicio` (dies a quo), `dias`, `computo` (HABILES_ADMINISTRATIVO, HABILES_JUDICIAL, NATURALES, MESES, ANOS), `ambitoCalendarioId`, `fechaVencimientoCalculada`, `fechaVencimientoConfirmada`, `confirmadaPorId`, `confirmadaEn`, `esPreclusivo`, `estado` (VIGENTE, CUMPLIDO, VENCIDO, SUSPENDIDO, AMPLIADO, INTERRUMPIDO), `suspensiones` (relación a `SuspensionPlazo`).
- **SuspensionPlazo** — `plazoId`, `motivo`, `fechaDesde`, `fechaHasta`, `documentoId`.
- **Actuacion** — el "docket": `expedienteId`, `fecha`, `tipo`, `descripcion`, `autorId`, `documentoId`, `notificacionId`, `esHitoProcesal`.
- **DespachoExterno** — `nombre`, `nif`, `contactoPrincipal`, `email`, `tarifa`, `expedientesAsignados`.

### 4.5b Calendario laboral

- **Calendario** — `ano`, `ambito` (NACIONAL, AUTONOMICO, LOCAL), `codigo` (código CCAA o código INE de municipio), `nombre`, `fuente`, `verificadoEn`.
- **Festivo** — `calendarioId`, `fecha`, `nombre`, `esSustituible`.

Un `ambitoCalendarioId` en `Plazo` referencia la combinación nacional + autonómico + local aplicable. Los calendarios se siembran desde el BOE (nacional), los boletines autonómicos y, para los municipios donde el tenant opera, carga manual verificada. **Un plazo cuyo calendario municipal no esté cargado y verificado se marca como `calendarioIncompleto` y no se presenta como definitivo.**

### 4.6 Riesgos, incidencias, personal, documentos

- **Riesgo** — versión reducida del modelo original: `causa`/`evento`/`consecuencia`, `categoriaId`, `contratoId`, `probabilidad`, `impacto`, puntuaciones inherente/residual, `respuesta`, `estado`, revisión periódica, `expedienteId` (si se materializó). Matriz configurable 5×5.
- **Incidencia** — hecho operativo: `contratoId`, `servicioId`, `tipo` (ACCIDENTE, INCIDENTE_SIN_BAJA, DANO_MATERIAL, FALLO_SERVICIO, QUEJA_USUARIO, AGRESION, MEDIOAMBIENTAL, VEHICULO, SEGURIDAD_DATOS), `gravedad`, `fechaHecho`, `fechaComunicacion`, `lugar`, `descripcion`, `medidasInmediatas`, `personasImplicadas` (JSONB cifrado), `comunicadaAlOrgano`, `esNotificableAAutoridad`, `expedienteId`.
- **Empleado**, **AsignacionServicio**, **Certificacion**, **TipoCertificacion** — como el original, adaptados: certificados de profesionalidad, carné profesional, formación PRL por puesto, reconocimiento médico, vigilancia de la salud.
- **Subrogacion** — `contratoId`, `sentido` (ENTRANTE/SALIENTE), `empresaContraria`, `fechaEfecto`, `convenioAplicable`, `trabajadores` (relación), `documentacionRecibidaCompleta`, `discrepancias`, `expedienteId`.
- **Document**, **DocumentVersion**, **DocumentType**, **Folder**, **RetentionPolicy** — como el original. Tipos sembrados en español: Pliego (PCAP/PPT), Oferta, Contrato formalizado, Acta de inicio, Modificado, Certificación mensual, Factura, Requerimiento, Alegaciones, Recurso, Resolución, Sentencia, Póliza, Certificado ISO, Plan de prevención, Evaluación de riesgos, DPIA.

### 4.7 Económico

- **Factura** — `contratoId`, `numero`, `fechaEmision`, `fechaRegistroFACe`, `importe`, `estado` (EMITIDA, REGISTRADA, CONFORMADA, PAGADA, IMPAGADA, DISPUTADA), `fechaPago`, `diasDemora`, `interesesDemora`, `expedienteId`. FACe es el punto de registro que fija el cómputo de morosidad.
- **Penalidad** — `contratoId`, `expedienteId`, `concepto`, `importe`, `fechaImposicion`, `deducidaDeFacturaId`, `recurrida`.
- **Provision** — `expedienteId`, `ejercicio`, `importe`, `criterio`, `revisadaPorId`.

### 4.8 Transversal

`Task`, `Comment`, `Notification`, `AuditEvent`, `CustomFieldDefinition`, `SavedView`, `Tag`, `ImportJob`/`ExportJob` — como el original.

---

## 4.9 Módulo de personal, coste laboral y absentismo — PROPUESTA

> **Estado: propuesto, pendiente de validación.** Añadido el 2026-08-11 a petición del brief. Sustituye y amplía lo esbozado en §4.6 para personal.

**La tesis.** En limpieza, jardinería, conserjería, catering escolar y gestión deportiva, el coste de personal es el 70–85% del contrato. De ahí se sigue casi todo lo demás: la plantilla mínima la fija el pliego y quedarse corto es una penalidad; el absentismo es lo que hace quedarse corto; la subida del convenio es lo que destruye el margen y a la vez es la base de una reclamación de reequilibrio; y el grueso de los litigios es laboral. Un módulo de personal que sólo cuente cabezas no sirve. Este conecta plantilla, coste y absentismo con el eje de contratos y expedientes que ya existe. La funcionalidad correspondiente está en §5.9 y las reglas de cálculo en §6.6.

### 4.9.1 Convenio colectivo y retribución

- **ConvenioColectivo** — `ambito` (ESTATAL, AUTONOMICO, PROVINCIAL, EMPRESA, CENTRO), `sector`, `provincia`, `codigoBoletin`, `fechaPublicacion`, `vigenciaDesde`, `vigenciaHasta`, `enUltraactividad`, `urlBoletin`, `documentoId`. Un contrato puede regirse por más de uno si opera en varias provincias — relación N:M con `Contrato`.
- **CategoriaProfesional** — `convenioId`, `grupo`, `nivel`, `denominacion`, `grupoCotizacionSS` (1–11).
- **TablaSalarial** — `convenioId`, `ano`, `categoriaId`, `salarioBaseMensual`, `numeroPagas`, `jornadaAnualHoras`, `precioHoraOrdinaria` (derivado), `precioHoraExtra`, `vigenciaDesde`.
- **ConceptoRetributivo** — `codigo`, `denominacion`, `tipo` (SALARIO_BASE, ANTIGUEDAD, PLUS_TRANSPORTE, PLUS_PENOSIDAD_TOXICIDAD, PLUS_NOCTURNIDAD, PLUS_FESTIVOS, PLUS_DISPONIBILIDAD, HORAS_EXTRA, COMPLEMENTO_AD_PERSONAM, INCENTIVO, DIETAS, ESPECIE), `esCotizable`, `esAbsorbible`, `esCompensable`, `prorrateaPagas`.
- **RevisionConvenio** — `convenioId`, `ano`, `incrementoPorcentaje`, `incrementoPorCategoria` (JSONB), `fechaPublicacion`, `fechaEfectosRetroactivos`, `atrasosCalculados`, `expedienteReequilibrioId`. **Cuando se registra una revisión con efectos retroactivos, el sistema calcula los atrasos por empleado y por contrato y ofrece abrir un expediente de reequilibrio económico con el dossier ya montado.**

### 4.9.2 Empleado — campos añadidos

Sobre el `Empleado` de §4.6: `numeroAfiliacionSS`, `nif`, `categoriaId`, `convenioId`, `codigoContratoSEPE` (100, 189, 200, 401, 501…), `grupoCotizacion`, `codigoCuentaCotizacion` (CCC — la clave de imputación por centro), `jornadaPorcentaje`, `horasSemanales`, `antiguedadReconocida` (puede diferir del alta si viene subrogado), `complementoAdPersonam`, `esSubrogado`, `contratoOrigenSubrogacionId`, `tieneReduccionJornada`, `motivoReduccion` (GUARDA_LEGAL, LACTANCIA, CUIDADO_FAMILIAR), `tieneDiscapacidadReconocida` (para cómputo de la cuota de reserva del 2%), `esRepresentanteTrabajadores` (goza de garantías y afecta a la gestión de despidos y sanciones).

### 4.9.3 Plantilla exigida frente a plantilla real

- **PlantillaExigida** — `contratoId`, `servicioId`, `categoriaId`, `numeroPersonas`, `horasSemanales`, `fuente` (PCAP, PPT, OFERTA, MODIFICADO), `clausula` (cita literal del pliego), `esVinculante`, `penalidadAsociada` (JSONB: fórmula o importe por incumplimiento).
- **AdscripcionContrato** — sustituye a `AsignacionServicio`: `empleadoId`, `contratoId`, `servicioId`, `centroTrabajo`, `categoriaId`, `horasSemanales`, `porcentajeDedicacion`, `fechaAlta`, `fechaBaja`, `esPersonalClave` (nombrado en la oferta — su baja no cubierta suele ser causa de penalidad expresa), `turno`.
- **CoberturaPlantilla** — instantánea calculada (diaria en contratos críticos, mensual en el resto): `contratoId`, `fecha`, `exigidoHoras`, `realHoras`, `porcentajeCobertura`, `deficitPorCategoria` (JSONB), `causasDeficit` (JSONB: bajas, vacantes, vacaciones), `generoDeteccion`. **Es la tabla que convierte una ausencia en un riesgo contractual medible.**

### 4.9.4 Absentismo

- **Ausencia** — `empleadoId`, `tipo` (IT_CONTINGENCIA_COMUN, IT_CONTINGENCIA_PROFESIONAL, ACCIDENTE_TRABAJO, ACCIDENTE_IN_ITINERE, ENFERMEDAD_PROFESIONAL, NACIMIENTO_CUIDADO_MENOR, RIESGO_EMBARAZO, RIESGO_LACTANCIA, PERMISO_RETRIBUIDO, PERMISO_NO_RETRIBUIDO, EXCEDENCIA, VACACIONES, HUELGA, SANCION, AUSENCIA_INJUSTIFICADA, FORMACION, CREDITO_HORARIO_SINDICAL), `subtipo` (para permisos del art. 37 ET: matrimonio, fallecimiento de familiar, traslado, deber inexcusable…), `fechaInicio`, `fechaFinPrevista`, `fechaFinReal`, `diasNaturales`, `diasLaborables`, `contingencia`, `numeroParteSS`, `parteBajaDocumentoId`, `mutua`, `esRecaida`, `requiereSustitucion`, `sustitucionCubiertaPorId`, `costeEmpresa`, `costePagadoPorSSoMutua`, `incidenciaId` (para accidentes: enlaza con el parte y con Delt@), `estado`.
- **CuotaAbsentismo** — indicador materializado por contrato y mes: tasa general, tasa por IT común, tasa por contingencia profesional, índice de incidencia, índice de frecuencia y de gravedad (los que pide la ITSS y las auditorías ISO 45001), coste directo y coste de sustitución.

### 4.9.5 Jornada y horas extra

Desde el RD-ley 8/2019 el registro diario de jornada es obligatorio y su ausencia es infracción grave sancionable por la ITSS.

- **RegistroJornada** — `empleadoId`, `fecha`, `horaEntrada`, `horaSalida`, `pausas` (JSONB), `horasOrdinarias`, `horasExtra`, `horasNocturnas`, `horasFestivas`, `origen` (TERMINAL_FICHAJE, APP_MOVIL, GEOLOCALIZACION, MANUAL, IMPORTADO), `validadoPorEmpleado`, `validadoPorResponsableId`, `hashIntegridad`. **Append-only con encadenamiento de hash**: la ITSS puede exigir demostrar que el registro no ha sido alterado a posteriori, y un registro editable no prueba nada.
- **BolsaHorasExtra** — control del límite anual de 80 horas por trabajador (art. 35.2 ET), con aviso al 70% y bloqueo con justificación por encima del límite.

### 4.9.6 Coste laboral e imputación

- **CosteLaboralMensual** — `contratoId`, `mes`, y por categoría: `brutoSalarial`, `cotizacionEmpresa`, `costeIT`, `costeSustituciones`, `indemnizaciones`, `formacion`, `epis`, `total`. Comparado contra `costeOfertado` del contrato para obtener desviación de margen.
- **ImportacionNomina** — origen (A3NOM, SAGE, META4, NOMINAPLUS, CSV_GENERICO), periodo, mapeo de columnas, filas procesadas, incidencias.
- **FicheroRNT / FicheroRLC** — importación de los ficheros del Sistema RED (Relación Nominal de Trabajadores y Recibo de Liquidación de Cotizaciones, antiguos TC2 y TC1). **Cuando la empresa abre un código de cuenta de cotización por contrato o centro — práctica habitual en el sector — el RNT da la plantilla y el coste reales, autoritativos y ya conciliados con la Seguridad Social, sin depender de que nadie mantenga una hoja de cálculo.** Es la vía de imputación más fiable y debe ser la preferente.

### 4.9.7 Exposición laboral en litigios

- **ExpedienteAfectado** — `expedienteId`, `empleadoId`, `conceptoReclamado`, `importeReclamado`, `importeEstimado`, `importeProvisionado`, `estadoIndividual`, `notas`. Un conflicto colectivo con 47 afectados es un expediente con 47 filas; la exposición es la suma, y el Gantt es común. **Esto responde directamente a "número de empleados en cada litigio".**
- **PapeletaConciliacion** — `expedienteId`, `organismo` (SMAC, o el servicio autonómico correspondiente), `fechaPresentacion`, `fechaActo`, `resultado` (CON_AVENENCIA, SIN_AVENENCIA, INTENTADO_SIN_EFECTO, DESISTIDO), `acuerdoDocumentoId`. **Su presentación suspende el plazo de caducidad de la acción** — el caso de uso que justifica `SuspensionPlazo` en el motor de §6.1, y uno de los puntos a validar con abogado.
- **ActaITSS** — `expedienteId`, `numeroActa`, `tipo` (INFRACCION, LIQUIDACION, ADVERTENCIA, REQUERIMIENTO), `materia` (PRL, SEGURIDAD_SOCIAL, EMPLEO, REGISTRO_JORNADA, DISCRIMINACION), `importePropuesto`, `graduacion`, `fechaNotificacion`, `plazoAlegacionesId`.

### 4.9.9 Cálculo y emisión de nómina

> **Decisión tomada (2026-08-11): alcance completo.** Olbun calcula y emite nómina, además de importar y contrastar. Ver §9.6 para las consecuencias asumidas.

La clave de ingeniería para que esto sea mantenible: **toda la parametría normativa es dato versionado con fecha de efectos, nunca código.** Una subida del SMI, un cambio de tipos de cotización o un nuevo tramo de IRPF se resuelven cargando una fila, no desplegando. Sin esto, el módulo se convierte en una deuda permanente.

- **TablaNormativa** — `ejercicio`, `concepto` (SMI, TOPE_MAXIMO_COTIZACION, TOPE_MINIMO_GRUPO, TIPO_CC_EMPRESA, TIPO_CC_TRABAJADOR, TIPO_DESEMPLEO, TIPO_FOGASA, TIPO_FORMACION, TIPO_MEI, TRAMO_IRPF, REDUCCION_RENDIMIENTO_TRABAJO, MINIMO_PERSONAL_FAMILIAR), `valor` (JSONB), `vigenciaDesde`, `vigenciaHasta`, `fuenteNormativa`, `verificadoPorId`. **Ninguna nómina se calcula con parametría no verificada por una persona.**
- **TarifaPrimasATEP** — tipo de cotización por accidentes de trabajo y enfermedades profesionales según CNAE y ocupación (la tarifa de primas de la disposición adicional cuarta de la Ley 42/2006 y sus revisiones).
- **PeriodoNomina** — `organisationId`, `mes`, `estado` (BORRADOR, CALCULADA, REVISADA, APROBADA, CONTABILIZADA, PAGADA, RECTIFICADA), `fechaCierre`, `aprobadaPorId`, `bloqueado`.
- **ReciboSalario** — `empleadoId`, `periodoId`, `contratoId` (imputación), `lineas` (relación), `baseCC`, `baseCP`, `baseHorasExtra`, `baseIRPF`, `tipoIRPFAplicado`, `totalDevengado`, `totalDeducido`, `liquidoAPercibir`, `costeEmpresa`, `documentoPdfId`, `entregadoEn`, `acuseReciboId`. Append-only: una rectificación crea un recibo nuevo enlazado, nunca modifica el anterior.
- **LineaRecibo** — `reciboId`, `conceptoRetributivoId`, `cantidad`, `precio`, `importe`, `esDevengo`, `cotiza`, `tributa`, `origen` (CONVENIO, CONTRATO, VARIABLE_IMPORTADA, MANUAL, CALCULADA).
- **DatosIRPF** — `empleadoId`, `ejercicio`, situación familiar del modelo 145 (`situacionFamiliar`, `hijosACargo`, `ascendientes`, `discapacidad`, `pensionAlimentos`, `prestamoVivienda`), `tipoCalculado`, `tipoAplicado`, `regularizaciones`.
- **Finiquito** — `empleadoId`, `causa` (BAJA_VOLUNTARIA, FIN_CONTRATO, DESPIDO_OBJETIVO, DESPIDO_DISCIPLINARIO, DESPIDO_IMPROCEDENTE, JUBILACION, NO_SUPERACION_PERIODO_PRUEBA), `fechaEfectos`, `vacacionesNoDisfrutadas`, `pagasProrrateadas`, `preavisoIncumplido`, `indemnizacionId`, `importeTotal`, `documentoId`, `firmadoConReserva`.
- **Indemnizacion** — `finiquitoId` o `expedienteId`, `modalidad` (33_DIAS_IMPROCEDENTE, 45_DIAS_TRAMO_ANTERIOR_2012, 20_DIAS_OBJETIVO, 12_DIAS_FIN_TEMPORAL, PACTADA), `diasPorAno`, `topeMensualidades`, `baseCalculo`, `importe`, `desglose` (JSONB con los tramos, porque la indemnización por despido de contratos anteriores a febrero de 2012 se calcula por tramos).
- **LiquidacionSeguridadSocial** — `periodoId`, `codigoCuentaCotizacion`, `ficheroRNTId`, `ficheroRLCId`, `estadoPresentacion`, `fechaPresentacion`, `justificanteId`. Presentación por Sistema RED/SILTRA.
- **ModeloTributario** — `tipo` (111, 190, 216, 296), `ejercicio`, `periodo`, `importe`, `ficheroId`, `estadoPresentacion`.

**Salvaguardas obligatorias.** Ninguna nómina pasa a APROBADA sin: parametría del ejercicio verificada; cuadre entre suma de recibos y liquidación de cotizaciones; y aprobación humana explícita registrada en auditoría. Un descuadre bloquea el cierre del periodo.

### 4.9.10 Fichaje propio

> **Decisión tomada: ambas vías.** Olbun importa de sistemas existentes *y* ofrece su propio fichaje.

- **TerminalFichaje** — `centroTrabajo`, `tipo` (QR_DINAMICO, NFC, PIN, APP_MOVIL), `identificador`, `ubicacion`, `activo`. **Sin biometría.** La AEPD ha rechazado el uso de huella dactilar y reconocimiento facial para control horario por desproporcionado: es dato de categoría especial y existen alternativas igual de eficaces. El sistema no ofrecerá esa opción.
- **Fichaje** — `empleadoId`, `instante`, `tipo` (ENTRADA, SALIDA, INICIO_PAUSA, FIN_PAUSA), `origen`, `terminalId`, `coordenadas` (opcional, desactivado por defecto), `precisionMetros`, `capturadoOffline`, `sincronizadoEn`, `hashAnterior`, `hash`. Encadenado e inmutable; una corrección genera un `FichajeCorreccion` enlazado con motivo y autor.
- **App de fichaje** — offline-first con cola de sincronización, porque los centros de trabajo del sector (colegios, polideportivos, viales, zonas verdes) tienen cobertura irregular. Un fichaje capturado sin red se firma localmente y conserva su instante real.
- **Geolocalización:** opcional, desactivada por defecto, capturada únicamente en el instante del fichaje —nunca de forma continua—, con la misma puerta de base legal que los buzones individuales: política documentada e información previa registradas antes de poder activarla.

### 4.9.8 Subrogación — detalle

Ampliando §4.6. Es la mayor fuente de litigio laboral del sector y donde más dinero se pierde por documentación deficiente.

- **ListaSubrogacion** — `subrogacionId`, `origen` (RECIBIDA_DE_EMPRESA_SALIENTE, ENTREGADA_A_EMPRESA_ENTRANTE, EXIGIDA_POR_PLIEGO), `fechaRecepcion`, `completa`, `documentoId`.
- **TrabajadorSubrogable** — `listaId`, datos declarados por la empresa saliente (`nombre`, `nif`, `categoria`, `antiguedad`, `jornada`, `salarioBruto`, `complementosAdPersonam`, `tipoContrato`, `situacion` — activo, en IT, en excedencia, con reducción de jornada, con reserva de puesto), `aceptado`, `discrepancia` (JSONB), `empleadoId` (una vez incorporado).
- **DiscrepanciaSubrogacion** — `trabajadorSubrogableId`, `campo`, `valorDeclarado`, `valorContrastado`, `fuenteContraste` (RNT, NOMINA_APORTADA, CONTRATO, VIDA_LABORAL), `impacteEconomicoEstimado`, `reclamada`, `expedienteId`. **El contraste automático de la lista recibida contra el RNT y las nóminas aportadas es la función que evita heredar costes ocultos**: antigüedades infladas, complementos no acreditados, trabajadores incorporados a última hora.

---

## 5. Funcionalidad

### 5.1 Motor de plazos (`lib/domain/plazos`)
Puro, sin E/S, exhaustivamente testeado. Expone: cálculo de vencimiento dado inicio, días, cómputo y ámbito de calendario; cómputo inverso (¿cuándo debí presentar?); simulación de suspensión y ampliación; y para cada resultado, la lista de días excluidos y el porqué, para que una persona pueda auditar el cálculo a ojo. Reglas en §6.

### 5.2 Expedientes y Gantt
- Alta de expediente desde plantilla; el Gantt se genera completo con hitos y plazos.
- Gantt horizontal por expediente: hitos como marcas, plazos como barras, vencimientos preclusivos destacados, hoy como línea. Zoom mes/trimestre/año. **Alternativa accesible obligatoria:** tabla cronológica equivalente, navegable por teclado, con las mismas fechas y estados — la vista Gantt no puede ser el único camino a la información (WCAG 2.2 AA).
- Vista cartera: todos los expedientes en una línea temporal común, filtrable por jurisdicción, contrato, responsable y cuantía.
- Detalle: cronología de actuaciones, plazos vivos con cuenta atrás, documentos, comunicaciones vinculadas, coste acumulado, provisión.

### 5.3 Calendario de plazos
Vista calendario y lista de todo lo que vence, por responsable y por expediente. Avisos en −15, −7, −3, −1 y 0 días para plazos preclusivos; −7 y 0 para el resto. Escalado automático al responsable jurídico si un plazo preclusivo llega a −3 sin actuación registrada.

### 5.4 Bandeja de comunicaciones
- Ingesta por las tres vías. Deduplicación por `Message-ID`.
- Vinculación automática a contrato (por dominio del remitente, número de expediente en el asunto, histórico del hilo) con nivel de confianza; vinculación manual siempre disponible.
- Triaje: cola de detecciones ordenada por confianza × gravedad. Cada fila muestra el extracto literal resaltado en su contexto. Acciones: **Confirmar** (crea incidencia, riesgo o expediente según el tipo), **Descartar** (con motivo, que alimenta el ajuste del prompt), **Aplazar**.
- Atajos de teclado para vaciar la cola rápido. Un revisor debe poder despachar 50 detecciones en 15 minutos.

### 5.5 Contratos
Ficha completa, cronología del contrato (formalización, modificados, prórrogas, penalidades, expedientes), avisos de vencimiento y preaviso de prórroga, cuadro de penalidades acumuladas, facturación e impagos.

### 5.6 Cuadro de mando
Exposición total por litigios (reclamado / provisionado / recuperado), expedientes por jurisdicción y estado, próximos vencimientos, detecciones pendientes de revisión, contratos con preaviso de prórroga próximo, morosidad acumulada por poder adjudicador.

### 5.7 Informes
Informe de situación de expediente (para consejo o para despacho), cartera de litigios con provisiones para auditoría de cuentas, historial de penalidades por contrato, informe de morosidad con intereses calculados, y **expediente completo en zip** — índice PDF, cronología, y toda la documentación en carpetas fechadas — para entregar a un letrado externo o a una inspección.

### 5.8 Administración
Organización, usuarios y roles, plantillas de procedimiento, tipos de expediente, calendarios laborales (carga y verificación), buzones conectados y su base legal, matriz de riesgos, tipos documentales y retención, campos personalizados, claves de API, registro de auditoría.

## 5.9 Funcionalidad de personal — PROPUESTA

**Cobertura de plantilla en tiempo real.** Semáforo por contrato: horas exigidas por pliego frente a horas realmente cubiertas hoy, desglosado por categoría y centro. Una baja que deja el contrato por debajo del mínimo genera detección inmediata con la cláusula del pliego citada y la penalidad estimada.

**Planificador de cobertura.** Rejilla empleados × semanas con adscripciones, ausencias previstas y vacaciones. Sobreasignación en rojo, capacidad libre en gris. Proyección: con el absentismo histórico de este contrato en esta época del año, ¿cuántas horas quedarán sin cubrir el mes que viene? Toda interacción de arrastre tiene equivalente por teclado y formulario.

**Cuadro de absentismo.** Tasa por contrato, centro, categoría y causa, con serie de 24 meses, comparativa entre centros y coste directo y de sustitución. Detección de patrones — concentración en lunes y viernes, en un turno concreto, o tras un cambio de mando — presentada como observación para investigar, nunca como acusación ni como base automática de medida disciplinaria.

**Simulador de convenio.** "El convenio provincial de limpieza sube un 3,2% con efectos desde enero": impacto por contrato, márgenes que pasan a negativo, atrasos a abonar, y borrador de solicitud de reequilibrio económico para los contratos donde proceda, con el cálculo adjunto.

**Conciliación de nómina contra convenio.** Cruce mensual de lo abonado contra la tabla salarial aplicable por categoría y antigüedad. Cualquier diferencia a la baja es riesgo de reclamación de cantidad — y prescribe al año, así que detectarla tarde es pagarla entera.

**Contraste de lista de subrogación.** Carga de la lista de la empresa saliente, contraste automático contra RNT y nóminas aportadas, informe de discrepancias con impacto económico estimado y borrador de escrito de reparo.

**Exposición laboral consolidada.** Trabajadores afectados por litigios abiertos, importe reclamado y provisionado, por contrato y por tipo de acción.

**Panel de registro de jornada.** Cumplimiento por centro, incidencias de fichaje, horas extra acumuladas contra el límite legal, y exportación en el formato que suele pedir la ITSS en una visita.

### Detecciones sobre datos estructurados

El motor de §4.4 deja de mirar sólo correo y pasa a evaluar también el estado del sistema. Cada regla genera una `Deteccion` con la misma cola de revisión humana:

| Señal | Origen | Convierte en |
|---|---|---|
| Cobertura por debajo del mínimo del pliego | `CoberturaPlantilla` | Riesgo de penalidad |
| Personal clave de baja sin sustituto | `Ausencia` + `AdscripcionContrato` | Riesgo de penalidad — plazo de cura contractual |
| Nómina por debajo de tabla salarial | `ImportacionNomina` + `TablaSalarial` | Riesgo de reclamación de cantidad |
| Horas extra sobre el límite anual | `BolsaHorasExtra` | Riesgo de sanción ITSS |
| Días sin registro de jornada | `RegistroJornada` | Riesgo de sanción ITSS |
| Certificación obligatoria caducada en persona adscrita | `Certificacion` | Riesgo de penalidad e incumplimiento PRL |
| Convenio revisado con efectos retroactivos | `RevisionConvenio` | Oportunidad de reequilibrio económico |
| Discrepancia en lista de subrogación | `DiscrepanciaSubrogacion` | Reparo a la empresa saliente |
| Cuota de reserva de discapacidad por debajo del 2% | plantilla | Riesgo de sanción — o medidas alternativas |

---

## 6. Reglas de negocio

Funciones puras en `lib/domain`, con tests de frontera exhaustivos.

### 6.1 Cómputo de plazos

> **Advertencia obligatoria.** Las reglas siguientes reflejan mi lectura de la Ley 39/2015 y normas conexas. **Deben ser validadas por un abogado español antes de que el sistema presente ningún plazo como definitivo**, y el motor debe citar siempre su fundamento para que una persona pueda comprobarlo. Un error aquí puede costar una caducidad. Ver §9, punto 1.

- **Días hábiles administrativos** (art. 30.2 Ley 39/2015): se excluyen sábados, domingos y festivos. El festivo aplicable es el del municipio del interesado *o* el de la sede del órgano — hay criterio jurisprudencial en juego y es una de las preguntas para el abogado.
- **Días hábiles judiciales** (art. 182 LOPJ): además, **agosto es inhábil** para las actuaciones judiciales salvo excepciones — y no lo es para la vía administrativa. El motor debe tratar `HABILES_ADMINISTRATIVO` y `HABILES_JUDICIAL` como cómputos distintos, no como el mismo con un flag.
- **Meses y años** (art. 30.4): de fecha a fecha; si en el mes de vencimiento no existe el día equivalente, vence el último día del mes.
- **Inicio** (art. 30.3): el cómputo empieza el día siguiente al de la notificación o publicación.
- **Vencimiento en inhábil** (art. 30.5): se prorroga al primer día hábil siguiente.
- **Notificación electrónica** (art. 43.2): si transcurren 10 días naturales desde la puesta a disposición sin acceder, se entiende rechazada y el trámite continúa. `fechaEfectosNotificacion` es el mínimo entre `fechaAcceso` y `fechaPuestaADisposicion + 10 días naturales` — **propuesto por el sistema, confirmado por una persona.**

Cada cálculo devuelve `{fechaVencimiento, diasExcluidos[], calendariosAplicados[], fundamento, completo}`. `completo: false` si falta el calendario municipal del año en cuestión.

### 6.2 Estado RAG del contrato
ROJO si: expediente abierto con cuantía > umbral configurable; penalidades acumuladas > % del importe de adjudicación; plazo preclusivo vencido sin actuación; factura impagada > 90 días desde conformidad; expediente de resolución de contrato abierto.
ÁMBAR si: detección de alta confianza sin revisar > 7 días; plazo preclusivo a menos de 7 días sin escrito preparado; penalidad impuesta no recurrida dentro de plazo; certificación obligatoria caducada para personal asignado.
Siempre se almacena el array de motivos junto al color. Nunca un color sin explicación.

### 6.3 Puntuación de urgencia
`urgencia = pesoPreclusividad × multiplicadorProximidad × pesoCuantia × pesoCriticidadContrato`. Un plazo preclusivo a 3 días en un contrato crítico domina cualquier otra cosa de la lista. Fórmula documentada en `docs/urgencia.md` y pesos configurables.

### 6.4 Detección
- Confianza < umbral configurable (por defecto 0,6): no se muestra en la cola principal, queda en "baja confianza".
- Extracto que no case por subcadena exacta con el texto fuente: se elimina y se penaliza la confianza. Detección sin ningún extracto válido: se descarta automáticamente y se registra para revisión del prompt.
- Un plazo *mencionado* en un correo nunca crea un `Plazo`. Crea una detección de tipo `PLAZO_MENCIONADO` que una persona convierte, verificando el fundamento.

### 6.5 Morosidad
Intereses de demora según Ley 3/2004: tipo del BCE + 8 puntos, desde el día siguiente al vencimiento del plazo de pago. Para el sector público el plazo es 30 días desde la conformidad, con máximo de 30 días para conformar desde la entrega. El sistema calcula y muestra el desglose; el tipo del BCE se carga por semestre.

### 6.6 Reglas de personal

- **Cobertura** = horas realmente prestadas ÷ horas exigidas por pliego, por categoría y periodo. Una categoría no compensa a otra: cubrir con un peón la plaza de un oficial no cuenta como cobertura.
- **Coste hora empresa** = (bruto anual + cotización empresarial + absentismo repercutido) ÷ horas efectivas anuales. Es el número que hay que comparar con el precio hora ofertado.
- **Tasa de absentismo** = horas perdidas ÷ horas teóricas, calculada por separado para contingencias comunes y profesionales, porque son riesgos distintos con financiación distinta.
- **Atrasos por revisión de convenio** = Σ por empleado del diferencial de tabla × meses con efecto retroactivo, incluida la parte proporcional de pagas.
- **Prescripción de cantidades** (art. 59.2 ET): un año desde que la obligación pudo exigirse. El sistema avisa cuando una diferencia detectada se acerca a prescribir.
- **Caducidad de la acción de despido** (art. 59.3 ET): 20 días hábiles, suspendidos por la papeleta de conciliación. Punto explícito de validación jurídica.



---

---

## 7. Protección de datos (España)

Sustituye al §7.3 original.

- **Base legal de la ingesta de correo.** Buzones funcionales: interés legítimo, con información previa. Buzones de persona física: exige política de uso de medios digitales documentada y consulta a la representación legal de los trabajadores (LOPDGDD art. 87). El sistema almacena ambos documentos y **bloquea la conexión de ese tipo de buzón hasta tenerlos**.
- **Datos de categoría especial.** Datos de salud en accidentes laborales y vigilancia de la salud, y datos de infracciones en expedientes sancionadores: cifrado con envelope encryption, permiso adicional para su lectura, y evento de auditoría `VIEW` en cada acceso.
- **Registro de actividades de tratamiento** (art. 30 RGPD) en `docs/rat.md`: finalidad, base legal, categorías de interesados y datos, destinatarios, plazos de supresión.
- **DPIA obligatoria.** El análisis automatizado de correspondencia laboral es, con alta probabilidad, un tratamiento que exige evaluación de impacto. Plantilla en `docs/dpia.md`, a completar antes de conectar el primer buzón real.
- **Derechos del interesado.** Exportación de todo lo que consta sobre una persona; supresión por anonimización (`[SUPRIMIDO-{id}]`) preservando la integridad del expediente y del registro de auditoría.
- **Conservación.** Correspondencia no vinculada a contrato ni expediente: purga a los 12 meses por defecto, configurable. Expedientes: hasta prescripción de responsabilidades, mínimo 6 años (art. 30 Código de Comercio) y lo que exija el plazo de garantía del contrato.

---

## 8. Milestones

El brief pidió "todo" para la primera versión. La secuencia siguiente es mi recomendación, ordenada de modo que **el bucle completo — correo entra, señal detectada, expediente abierto, Gantt corriendo — sea demostrable al terminar M7**, y la profundidad venga después. Las dependencias mandan: el motor de plazos va antes que los expedientes porque los expedientes no significan nada sin él.

| # | Milestone | Definition of done |
|---|---|---|
| **M0** | Fundación | ✅ Completado |
| **M1** | Identidad y tenancy | Alta, acceso, MFA, invitaciones, roles, DAL con scope de organización, RLS, suite de permisos verde |
| **M2** | Auditoría y armazón | Log inmutable con trigger, shell de la app en `es-ES`, `DataTable` y patrones compartidos, paleta de estados |
| **M3** | **Calendarios y motor de plazos** | Calendarios nacional + 17 CCAA + carga municipal; motor puro con tests de frontera; verificación jurídica pendiente registrada |
| **M4** | Poderes adjudicadores y contratos | Modelo LCSP completo, DIR3, modificados, prórrogas, avisos de preaviso |
| **M5** | **Expedientes, hitos y Gantt** | Plantillas de procedimiento sembradas, alta desde plantilla, Gantt + tabla accesible, actuaciones, calendario de plazos con avisos |
| **M6** | Comunicaciones (carga manual + alias) | Ingesta `.eml`/`.msg`/PDF y alias de reenvío, deduplicación, vinculación a contrato, bandeja |
| **M7** | **Detección** | Pipeline Claude con salida estructurada, verificación de extractos, cola de triaje, confirmación → incidencia/riesgo/expediente. **Bucle completo demostrable.** |
| **M8** | Buzones OAuth | Microsoft Graph y Gmail, sincronización incremental, controles de base legal, carga histórica por Batch API |
| **M9** | Documentos y evidencia | Subida, versiones, antivirus, extracción de texto, búsqueda, retención, exportación de expediente en zip |
| **M10** | Riesgos e incidencias | Registro de riesgos, matriz, incidencias, acciones correctoras |
| **M11** | Personal, convenio y adscripción | Empleados, convenios y tablas salariales, categorías, adscripción a contrato, plantilla exigida por pliego, certificaciones y caducidades |
| **M12** | **Absentismo y cobertura** | Ausencias por tipo, cobertura calculada frente al pliego, planificador, detecciones estructuradas de infradotación |
| **M13** | Jornada — importación | Importación desde terminales y apps existentes, encadenamiento de hash, bolsa de horas extra, panel de cumplimiento e informe ITSS |
| **M14** | Coste laboral e importación | Importación de nómina y de ficheros RNT/RLC, imputación por CCC, coste real frente a ofertado, conciliación nómina–tabla salarial |
| **M15** | Simulador de convenio y reequilibrio | Revisiones de convenio, cálculo de atrasos, impacto por contrato, dossier de solicitud de reequilibrio económico |
| **M16** | Subrogación y exposición laboral | Listas de subrogación, contraste contra RNT y nóminas, discrepancias, `ExpedienteAfectado`, papeleta de conciliación y suspensión de plazos, actas ITSS |
| **M17** | Económico | Facturas, FACe, morosidad e intereses, penalidades, provisiones |
| **M18** | Cuadros de mando e informes | Cuadro por rol, feed de urgencia, informes, exportaciones |
| **M19** | Fichaje propio | App móvil offline-first, terminales QR/NFC/PIN, correcciones auditadas, geolocalización opcional tras puerta de base legal. Sin biometría. |
| **M20** | API y webhooks | API v1, OpenAPI, claves, webhooks firmados |
| **M21** | **Nómina — motor de cálculo** | Parametría normativa versionada y verificada, cálculo de devengos y deducciones, bases de cotización, IRPF, recibo en PDF. Ejecución en paralelo con el software actual del cliente durante al menos un ejercicio completo antes de sustituirlo. |
| **M22** | Nómina — presentaciones | Generación de RNT/RLC y presentación por SILTRA, modelos 111 y 190, finiquitos e indemnizaciones por tramos |
| **M23** | Endurecimiento | Rendimiento, accesibilidad WCAG 2.2 AA, pentest, carga, runbooks, recuperación |

**Hitos comerciales dentro del plan.** M7 cierra el bucle completo y es demostrable a un cliente. **M16 es la primera versión realmente vendible**: contratos, expedientes con plazos correctos, detección sobre correo y sobre datos, y el módulo de personal completo salvo cálculo de nómina. M21–M22 son un producto dentro del producto y no deben bloquear la salida al mercado.

---

## 9. Decisiones abiertas

1. **Validación jurídica del motor de plazos (bloquea M3 para producción, no para desarrollo).** Las reglas de §6.1 necesitan revisión de un abogado español, en particular: qué calendario municipal prevalece cuando el interesado y el órgano están en municipios distintos; el alcance exacto de la inhabilidad de agosto por orden jurisdiccional; y el tratamiento de los plazos de la vía especial de contratación. **No soy abogado.** Propongo desarrollar el motor con las reglas actuales, marcar cada resultado como no verificado, y contratar una revisión antes del primer cliente real.
2. **Alcance del acceso a buzones individuales.** Confirmado que se quieren las tres vías, pero los buzones de persona física traen obligaciones LOPDGDD. ¿Se comercializa como función con requisitos previos (política + consulta), o se deja fuera de v1?
3. **Fuente de calendarios laborales.** No hay API oficial consolidada de festivos municipales. Opciones: carga manual verificada por tenant (fiable, laboriosa), scraping de boletines (frágil), o proveedor comercial. Recomiendo carga manual para los municipios donde cada cliente opera realmente — suelen ser pocos — más los calendarios nacional y autonómico sembrados.
4. **Multi-tenant desde el día uno vs. primer cliente.** Confirmado multi-tenant. Vale la pena decir el coste: tenancy, RBAC y aislamiento son aproximadamente M1 completo más una fracción de cada milestone posterior. Si hay un primer cliente concreto esperando, se puede acortar el camino a producción manteniendo el esquema preparado.
5. **Retención de la correspondencia.** ¿12 meses por defecto para correo no vinculado es aceptable comercialmente, o los clientes querrán conservarlo todo? Afecta al coste de almacenamiento y a la superficie de RGPD.
6. **Nómina completa — decidido, con consecuencias asumidas.** Olbun calculará y emitirá nómina (M21–M22), no sólo importarla. Lo que eso implica y que queda aceptado: mantenimiento normativo permanente (SMI, topes y tipos de cotización, tramos de IRPF, convenios — de ahí que la parametría sea dato versionado y no código); responsabilidad sobre importes abonados y sobre presentaciones a la Seguridad Social y a la AEAT; y competir con A3, Sage y Meta4 en su terreno. Mitigaciones incorporadas al plan: es lo último que se construye, no bloquea la salida al mercado en M16, la parametría exige verificación humana por ejercicio, y el motor debe ejecutarse en paralelo con el software actual del cliente durante al menos un ejercicio completo antes de sustituirlo.
7. **Geolocalización en el fichaje — decidido: sí, con puerta de base legal.** Opcional, desactivada por defecto, sólo en el instante del fichaje, nunca continua, y bloqueada hasta registrar política documentada e información previa. **Biometría descartada por diseño**: la AEPD la considera desproporcionada para control horario y es dato de categoría especial.
8. **Datos retributivos individuales — decidido: sí.** Cifrados, con permiso específico y evento de auditoría en cada lectura. Los agregados por categoría y contrato se derivan del detalle. Esto agranda la DPIA y eleva el nivel de las medidas de seguridad: es un condicionante de M11 y del pentest de M23.
9. **Nombre del producto.** "Olbun" viene del documento original. En español, *olbun* arrastra la asociación con "mala olbun" (negligencia profesional), lo que resulta desafortunado en un producto que se vende precisamente para evitar responsabilidad. Cambiarlo ahora cuesta seis ficheros y una base de datos; después de captar clientes, mucho más. Decidir antes de M1.
