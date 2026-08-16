# Changelog

## 2026-08-14 — Corrección de la demo LAN

- Las cabeceras HSTS y `upgrade-insecure-requests` ahora dependen del protocolo
  público configurado, no solo de `NODE_ENV`. La demo de producción por HTTP en
  red local vuelve a cargar estilos y ya no redirige Safari a un HTTPS inexistente.
- Los despliegues reales con `APP_URL=https://…` mantienen ambas protecciones.

All notable changes to Olbun are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); milestones map to
SPEC §12.

## M12 — Absentismo y cobertura (primera tanda, 2026-08-15)

- **Ausencias con los diecisiete tipos de SPEC §4.8**, de la IT al crédito
  horario sindical, cada uno con lo que significa: si computa absentismo, si
  hay que cubrir el turno y si la paga la empresa.
- Dos distinciones que el módulo entero sostiene y que es fácil confundir:
  - **Disponibilidad no es absentismo.** Las vacaciones quitan a alguien del
    turno igual que una baja —las horas hay que cubrirlas— pero no son
    absentismo. Un índice que las metiera dentro diría que una empresa que
    cumple falla cada agosto, y alguien lo citaría en una reunión como si no.
  - **Los días se cuentan dos veces y a propósito.** Un parte de viernes a
    lunes son cuatro naturales y dos laborables: la Seguridad Social pide el
    primer número y un déficit de cobertura el segundo. Se calculan al grabar,
    contra el calendario de entonces, porque un festivo añadido después no
    puede reescribir un dato ya declarado.
- **La huelga no propone sustituto.** Sustituir a quien la secunda es ilegal
  (art. 6.5 RDL 17/1977) y el producto no puede sugerirlo como un turno que
  cubrir. El crédito sindical tampoco computa: poner número al ejercicio de un
  derecho no es medir nada.
- **Cobertura real por categoría y centro**, que es lo que M11 no podía
  responder: no quién está adscrito en el papel, sino cuántas horas de cada
  categoría hubo de verdad una vez descontadas las ausencias. Dos ausencias el
  mismo día no restan dos veces.
- El reparto de la semana entre cinco días es una simplificación declarada en
  el código y en la pantalla: quien hace 3×12 pierde más por día ausente. Los
  turnos reales llegan en M13, cuando haya fichajes de donde leerlos.
- No se guarda el diagnóstico. Es dato de salud del artículo 9 y no hace falta
  para cubrir un turno: basta el tipo, las fechas y el número de parte.
- Verificado con 1.359 pruebas unitarias y de integración contra Postgres real
  —aislamiento RLS de la tabla nueva incluido— y 166 E2E contra una compilación
  de producción.
- **El motor de detección deja de mirar sólo el correo.** Tres de las señales
  de SPEC §4.4 se calculan ya sobre los datos del propio tenant: cobertura por
  debajo del pliego, personal clave ausente sin sustituto y certificación
  obligatoria caducada en persona adscrita. Van a la misma cola, con la misma
  revisión humana y sin abrir nada por su cuenta.
- Estas detecciones no traen cita porque no hay texto: su prueba es el cálculo,
  y se guarda entero para que quien revisa pueda rehacerlo a mano en vez de
  creerse una puntuación. La confianza es 1 y no es una fanfarronada — el motor
  no adivina si las horas cuadran, las ha sumado. Lo que sigue siendo de la
  persona es qué significan: un déficit sobre el papel puede ser un cuadrante
  que el software todavía no ve.
- Reevaluar es seguro y está pensado para hacerse a menudo: refresca lo que
  sigue pendiente y **nunca resucita lo que alguien ya descartó**. Volver a
  preguntar algo ya decidido enseña a cerrar la cola sin leerla.
- La huelga no se señala como puesto sin cubrir. Sustituir a quien la secunda
  es ilegal, así que sacarla ahí sería invitar a hacer justo lo que no se puede.
- Una tolerancia de una hora antes de avisar: repartir la jornada semanal entre
  días laborables deja fracciones, y una cola que salta por un cuarto de hora
  es una cola que se cierra sin mirar.
- `modelId` y `promptVersion` también en las de sistema (`reglas-sistema-1`),
  para que «la cola empeoró la semana pasada» siga siendo una pregunta con
  respuesta.
- **Planificador de cobertura**: personas en vertical, semanas en horizontal,
  con lo comprometido, lo que se lleva una ausencia y lo que queda. La rejilla
  se gana el sitio porque enseña lo que una lista no puede — quien está en dos
  contratos al 60 % está sobreasignado sobre el papel mucho antes de que se
  note en la calle.
- Cada celda lleva color **y** texto. El estado no se codifica nunca sólo en
  color, y esto lo audita cualquier comprador público.
- La proyección es una multiplicación explicable, no un modelo: el porcentaje
  de horas que este contrato perdió de verdad en los tres meses anteriores,
  aplicado a lo planificado. Con menos de 160 horas de historia la pantalla
  dice que no hay base suficiente en vez de imprimir una cifra sacada de una
  semana suelta, que es la clase de número que acaba citándose en una reunión
  como si significara algo.
- **La rejilla se lee, no se arrastra.** El SPEC describe reasignar arrastrando;
  eso debe una alternativa por teclado (WCAG 2.2 AA, 2.5.7) diseñada a la vez,
  y entregar primero la mitad inaccesible habría sido entregar la mitad mala.
  Las adscripciones se editan en el formulario que ya existe y la pantalla dice
  por qué.
- Queda para la siguiente tanda: reasignar arrastrando —con su equivalente por
  teclado— y las señales de §4.4 que dependen de hitos posteriores.

## M11 — Personal, convenio y adscripción (completo, 2026-08-15)

- Directorio de personal con alta, estado laboral, jornada, antigüedad,
  subrogación, categoría profesional y convenio aplicable. Los listados no
  descifran datos protegidos.
- Convenios colectivos, categorías y tablas salariales versionadas por año y
  vigencia. El precio de hora ordinaria se calcula como regla de dominio y el
  convenio aplicable se vincula expresamente a cada contrato.
- Plantilla mínima exigida por pliego y adscripción por contrato, centro,
  categoría, turno, horas y porcentaje. Se advierte al superar el 100 % y se
  bloquea una carga solapada superior al 150 %.
- Cobertura base compara horas exigidas y adscritas sin ocultar déficits. Las
  bajas, vacaciones y fichajes se descontarán en M12, por lo que la pantalla
  etiqueta expresamente el cálculo actual como base estática.
- Tipos y matriz de certificaciones con caducidad calculada por día civil en la
  zona de la organización. El alta de una organización incorpora tipos
  iniciales útiles.
- NIF/NIE, afiliación, CCC, complemento individual, discapacidad reconocida,
  referencias de certificados y personas implicadas en incidencias se guardan
  con AES-256-GCM. El NIF usa un índice ciego HMAC para detectar duplicados sin
  texto claro; cada lectura protegida exige permiso específico y genera un
  evento de auditoría.
- Rotación de claves operable con `ENCRYPTION_PREVIOUS_KEYS`: las claves
  retiradas permanecen temporalmente legibles, las escrituras usan solo la
  vigente y la validación de arranque rechaza material que no sea AES-256.
- Demo ampliada con 46 personas ficticias, cinco convenios con categorías y
  tablas, adscripciones y mínimos contractuales con déficits visibles, y 46
  certificaciones repartidas entre válidas, próximas y caducadas.
- ADR 0012, inventario de protección de datos y seis pruebas de integración
  con Postgres documentan cifrado, aislamiento RLS y decisiones de modelado.
  TypeScript, ESLint, Prettier y Prisma están verdes, con 1.334 pruebas
  unitarias y de integración contra Postgres real y 160 pruebas E2E contra una
  compilación de producción.
- Al cerrar el hito aparecieron tres fallos que las pruebas unitarias no podían
  ver, porque estaban justo en la costura entre el formulario y el esquema:
  - **El alta de empleados no funcionaba en absoluto.** El ayudante compartido
    `casilla()` devuelve un booleano y el esquema sólo aceptaba el «on» crudo
    del HTML, así que cuatro casillas tumbaban el alta entera. El esquema
    acepta ahora las dos formas, en personal y en riesgos.
  - **Y fallaba en silencio**: los errores de esas casillas no tenían dónde
    enseñarse, de modo que el formulario ni guardaba ni decía por qué. Cualquier
    error de campo devuelve ahora también un mensaje general.
  - **Los tipos de certificación sólo se sembraban en la primera empresa
    registrada.** La comprobación de «¿ya existe este código?» corría sobre el
    cliente elevado sin filtrar por organización, así que encontraba el código
    de otra empresa y no creaba nada; ninguna organización posterior podía
    registrar un certificado. Cubierto con una prueba de integración de dos
    organizaciones.

## M10 — Riesgos e incidencias (completo, 2026-08-14)

- Registro vivo ordenado por exposición vigente y matriz interactiva 5×5 con
  enlaces a cada celda. El residual sólo sustituye al inherente cuando una
  persona lo ha valorado; «sin valorar» nunca se disfraza de control eficaz.
- Categorías y cuatro bandas configurables por organización, con pantalla de
  administración, validación de cobertura 1–25 y auditoría. Cada alta recibe
  nueve categorías útiles y una matriz coherente.
- Valoraciones y revisiones periódicas inmutables mediante triggers de sólo
  inserción. Cada snapshot conserva la matriz aplicada, de modo que cambiar un
  umbral no reescribe el significado del histórico.
- Riesgo redactado como causa → evento → consecuencia, responsable, respuesta,
  cadencia y fecha de revisión. El detalle explica inherente, residual,
  reducción, controles y evolución.
- Controles preventivos, detectivos, correctivos y directivos con eficacia y
  fechas de prueba. Acciones correctoras con prioridad, responsable, progreso,
  bloqueo, cierre y verificación de eficacia.
- Incidencias con investigación, causa raíz, lecciones, comunicación al órgano
  y referencia de notificación a autoridad. Olbun señala el trabajo pendiente,
  pero no decide ni envía una notificación regulatoria automáticamente.
- La confirmación de detecciones desemboca de verdad en riesgo o incidencia y
  aplica una categoría tenant estable; todos los accesos respetan alcance de
  contrato, RBAC, DAL tenant y RLS.
- Demo enriquecida con 12 riesgos, 8 incidencias, controles, acciones y fechas
  plausibles. ADR 0011 y metodología operativa documentan el modelo y sus
  límites.
- Las 20 migraciones pasan desde una base vacía. 1.296 pruebas unitarias e
  integración y 152 recorridos E2E de producción —76 en escritorio y 76 en
  móvil— quedan verdes. Cobertura: 63,89% líneas, 66,28% funciones, 53,57%
  ramas y 63,61% sentencias; el ratchet de CI sube con el resultado.

## M9 — Documentos y evidencia (completo, 2026-08-14)

- ClamAV oficial en Docker y CI. Cada versión se envía por `INSTREAM`; solo un
  veredicto `LIMPIO` permite descargar, extraer o exportar. Una caída queda
  `NO_ANALIZADO`, bloqueada y reintentable: nunca se pinta de verde.
- Cuarentena real comprobada con EICAR. Las versiones infectadas no ofrecen
  enlace, no pasan por parsers y se excluyen expresamente de los expedientes.
- OCR local en español con Tesseract, sin API ni transferencia a terceros.
  Renderiza PDF escaneado, guarda páginas, confianza y resultado completo o
  parcial, y vuelve buscable el texto desde la tabla.
- Búsqueda full-text española mediante `tsvector` generado e índice GIN. Busca
  en todas las versiones limpias, ordena por relevancia y se ejecuta bajo RLS;
  la integración prueba flexiones y aislamiento entre tenants.
- Exportación mejorada: `indice.pdf` imprimible y paginado, cronología Markdown,
  `manifest.csv` con ruta, versión, tamaño y SHA-256, además de los ficheros
  íntegros. Lo omitido siempre deja una incidencia en el índice.
- Papelera recuperable con motivo y restauración de identidad, versiones y
  bytes. La purga por retención sigue siendo la única destrucción irreversible.
- Bloqueo legal operable desde la tabla: registra quién, cuándo y por qué, exige
  motivo también al retirarlo e impide papelera y purga.
- Cinco documentos plausibles con bytes reales, hashes, contratos y un hold
  legal enriquecen el tenant `servicios-guadaira` de la demo.
- ADR 0010 y runbook operativo para ClamAV, OCR, cuarentena, papelera y purga.
- 1.268 pruebas unitarias y de integración, más 146 flujos E2E en escritorio y
  móvil, superan el hito. La cobertura sube a 62,85% de líneas, 62,84% de
  funciones, 52,40% de ramas y 63,01% de sentencias; el ratchet de CI vuelve a
  subir con el resultado real.

## M8 — Buzones conectados (2026-08-14)

- Conexión delegada de buzones funcionales Google Workspace y Microsoft 365
  con Authorization Code, `state` de un solo uso y PKCE S256. Los clientes de
  lectura de correo están separados de «Entrar con Google/Microsoft».
- Permisos mínimos de solo lectura: Gmail readonly o `Mail.Read` delegado. Los
  access tokens, refresh tokens y verificadores PKCE se cifran con AES-256-GCM
  y nunca llegan al navegador, logs ni auditoría.
- Sincronización incremental real: `historyId` de Gmail y `deltaLink` separado
  para Inbox/Sent Items en Graph. Solo se siguen cursores HTTPS de hosts
  oficiales, evitando que un cursor manipulado se convierta en SSRF.
- Carga inicial limitada a un año y 500 mensajes por ejecución. Si quedan más,
  Olbun persiste la página exacta pendiente; no salta del mensaje 500 al correo
  nuevo ni pierde evidencia silenciosamente.
- Reclamación atómica de quince minutos contra sincronizaciones simultáneas,
  descarga fuera de la transacción y persistencia tenant con RLS, deduplicación
  y auditoría dentro de ella.
- Los buzones personales están bloqueados salvo que consten una política
  interna documental y la fecha de consulta a la representación de los
  trabajadores. La plantilla DPIA deja claro que requiere aprobación del
  responsable y su DPD/asesoría; no es un dictamen jurídico.
- El correo nuevo recibe detección local inmediata. Con clave Anthropic, el
  histórico puede procesarse mediante Claude Message Batches, hasta 500 por
  lote y con un único envío por mensaje. Modelo, prompt, coste y resultado se
  conservan, y las citas del modelo se verifican contra el original antes de
  mostrarse a una persona.
- Sin clave Anthropic no se envía correspondencia a terceros. Message Batches
  no se presenta como Zero Data Retention y exige aprobación expresa en la
  DPIA/DPA del cliente.
- Runbook de alta para ambos proveedores, callbacks exactos, incidencias y
  prueba de revocación. Una IP privada HTTP sirve para la demo, pero el
  consentimiento real exige un dominio HTTPS estable.
- La auditoría funciona también desde tareas sin contexto HTTP: conserva el
  evento y omite únicamente IP/agente de usuario.
- 1.233 pruebas superan el hito; la cobertura sube a 60,48% de líneas, 61,26%
  de funciones, 50,31% de ramas y 60,91% de sentencias. El ratchet de CI se
  eleva con ella en lugar de dejar margen para una regresión posterior.

## M6 — Comunicaciones manuales y alias de reenvío (2026-08-14)

- Ingesta manual de `.eml`, `.msg` de Outlook y PDF. En PDF se piden las
  cabeceras que el formato no contiene; `.msg` se comprueba con ficheros reales
  exportados por Outlook.
- El original y cada adjunto se conservan en S3/MinIO con tamaño, MIME y
  SHA-256. El HTML se sanea al entrar y nunca carga píxeles remotos.
- Deduplicación transaccional por `Message-ID` y por huella normalizada. Los
  índices únicos son quienes deciden incluso si dos copias llegan a la vez.
- Alias de reenvío generales o vinculados a un contrato. El webhook entrante es
  neutral respecto del proveedor, exige un secreto de 32 caracteres, no permite
  enumerar alias y cambia al cliente RLS del tenant en cuanto resuelve el
  destinatario.
- Transporte SMTP real para invitaciones y enlaces mágicos, manteniendo un
  transporte de consola explícito para desarrollo y pruebas.
- Pruebas E2E de escritorio y móvil alineadas con el servidor de producción:
  cabeceras HSTS, proveedores OAuth no configurados, navegación fresca tras
  mutaciones y menú móvil.
- `next-env.d.ts` queda versionado; una instalación limpia ya reconoce los
  recursos estáticos durante el typecheck.
- Decisión arquitectónica ADR 0007 para la única resolución global necesaria
  antes de conocer el tenant en correo entrante.
- Las mutaciones y su auditoría sí comparten ahora una única transacción física:
  `tenantTransaction()` fija RLS una vez y aplica el scope mediante los delegates
  del cliente transaccional. Una prueba contra Postgres acredita scope, bloqueo
  entre tenants y rollback conjunto.
- La cobertura real sube a 56,79% de líneas y 49,08% de ramas. CI la convierte
  en un ratchet que no puede retroceder; ADR 0008 documenta por qué el antiguo
  umbral nominal del 80% era una puerta permanentemente roja y cómo se llegará
  al objetivo sin fingir cobertura.
- `sharp` y `postcss` quedan fijados a versiones corregidas para eliminar las
  vulnerabilidades transitivas notificadas por npm; la auditoría final no
  encuentra vulnerabilidades conocidas.

## M9 — Documentos y evidencia, primera entrega (2026-08-13)

- MinIO en `docker-compose` y en CI. El mismo código habla con MinIO en local y
  con S3 en producción: sólo cambian el endpoint y las credenciales.
- **Las claves son el sha256 del contenido.** El mismo fichero subido dos veces
  ocupa un objeto, un renombrado no deja nada huérfano y la clave es, además,
  la suma de verificación.
- **Nada se sobrescribe.** Volver a subir crea la versión 2 y deja intacta la 1,
  bytes incluidos. La pregunta suele ser qué decía en marzo.
- Al leer se comprueba la huella y, si no cuadra, no se entrega el fichero: no
  se sirve como prueba algo que no se puede acreditar.
- Descarga por Route Handler con su permiso, su comprobación de tenant y su
  evento de auditoría: quién se llevó qué documento y cuándo.
- Catálogo de tipos documentales sembrado en español, con los años de
  conservación de cada uno. Un documento sin clasificar dice «sin política» en
  vez de aparentar que tiene una.
- Extracción de texto al subir y búsqueda por nombre, descripción y contenido,
  con el fragmento donde coincide. Sin tildes y sin mayúsculas: nadie escribe
  «Alcalá» con tilde en un buscador.
- Lo que no se puede leer se marca «sin indexar» y se dice en la búsqueda
  vacía. Sacar las tiras ASCII de un PDF produce basura verosímil, que es justo
  lo que hace que un resultado deje de ser fiable.
- **Expediente completo en zip**: índice, cronología con hitos, plazos y
  actuaciones, y todos los documentos en carpetas por fecha y versión. Para
  entregar a un despacho o a una inspección.
- El índice y la cronología van en Markdown, legibles dentro de diez años sin
  esta aplicación. Cada plazo dice si lo ha confirmado una persona o sólo lo ha
  calculado el sistema.
- Cada documento se verifica al meterlo en el zip; el que no cuadra se anota en
  el índice en vez de desaparecer sin más.
- Exportar exige `expediente:export`, no `expediente:view`: leer un expediente
  en pantalla y llevarse el archivo entero son cosas distintas.
- Extracción de PDF con pdf.js, que es el motor que aguanta los PDF malformados
  que mandan de verdad las administraciones. Un PDF sin texto se marca como
  escaneado que necesita OCR, no como indexado y vacío.
- Extracción de `.docx` con mammoth: las alegaciones y los escritos llegan casi
  siempre en Word, así que sin esto media biblioteca quedaba fuera del buscador.
  El `.doc` antiguo es otro formato y se sigue marcando como no indexado, porque
  leerlo a medias metería en el índice trozos que parecen el documento y no lo
  son.
- **Conservación y purga.** Dos obligaciones que tiran en sentidos contrarios:
  la contratación pública dice que se guarde el expediente, el RGPD dice que no
  se guarden datos personales más de lo necesario. El plazo cuenta desde el fin
  del contrato cuando lo hay y, si no, desde la fecha del documento: un
  contrato cerrado en 2019 cuyo pliego se escaneó en 2024 no gana cinco años
  por cuándo se escaneó.
- Nada se purga solo. No hay trabajo nocturno que borre pruebas mientras nadie
  mira: la pantalla enseña lo que ha cumplido plazo y una persona con
  `documento:delete` escribe PURGAR para confirmar. Queda en la auditoría quién
  fue y cuándo, sin nada del contenido.
- El bloqueo por litigio gana a cualquier plazo cumplido, y esos documentos ni
  siquiera aparecen en la lista. Se avisa con noventa días de antelación para
  que una purga no sea nunca una sorpresa.
- Sin política no es lo mismo que para siempre: un tipo documental sin plazo se
  cuenta aparte para que alguien lo decida, en vez de caer en una lista de
  borrado porque el nulo ordenó como cero.
- Las filas se borran en blando y los ficheros en duro, y sólo los ficheros que
  no comparte nadie. Como el almacén direcciona por contenido, borrar el objeto
  de una versión caducada habría vaciado el documento idéntico de otro
  expediente.
- Queda para la siguiente tanda: antivirus, OCR de escaneados e índice en PDF.

## M10 — Riesgos e incidencias, primera entrega (2026-08-13)

Cierra el cabo suelto de M7: confirmar una detección cuyo destino era una
incidencia o un riesgo dejaba constancia de la decisión y no creaba nada. Cinco
de los catorce tipos acababan ahí.

- `Incidencia` (lo que ha pasado), `Riesgo` (lo que no ha pasado) y
  `AccionCorrectora`, con RLS y con las comprobaciones en la base de datos: una
  acción cuelga siempre de una incidencia o de un riesgo, y las puntuaciones
  van del 1 al 5.
- En esta primera entrega, matriz 5×5 común calculada en
  `lib/domain/riesgos`; el cierre de M10 la convirtió en configuración tenant y
  empezó a conservar cada versión dentro del histórico inmutable.
- «Sin valorar el residual» y «los controles no cambiaron nada» son cosas
  distintas y el registro las distingue. Ordena por el nivel vigente, que es el
  residual cuando existe y el inherente cuando nadie lo ha valorado.
- Un riesgo se escribe como causa, evento y consecuencia. «Riesgo de penalidad»
  no es algo sobre lo que se pueda actuar.
- Confirmar una queja, una reclamación o un incumplimiento alegado crea la
  incidencia con la cita de la carta como descripción; un riesgo de PRL entra
  en el registro sin valorar, porque el motor no tiene base para puntuarlo.

## M7 — Detección (2026-08-13)

Cierra el bucle: entra un correo, se señala lo que importa con la frase que lo
justifica, una persona lo confirma y el expediente se abre con su cronograma en
marcha.

- `Deteccion`: catorce tipos, con la confianza que dijo el motor y la que quedó
  tras comprobar sus citas, guardadas por separado. RLS como en el resto.
- **Toda cita se verifica en el servidor por coincidencia exacta contra el texto
  original antes de guardarse.** La que no aparece se descarta y baja la
  confianza; la detección que se queda sin ninguna no llega a la cola y se
  registra como descartada, que es el material para revisar el prompt
  ([ADR 0006](adr/0006-verified-quotes-instead-of-api-citations.md)).
- Los desplazamientos de cada cita los calcula el servidor: al modelo no se le
  piden, porque un resaltado que señala la frase equivocada es peor que ninguno.
- Motor de Claude con salida estructurada (`claude-opus-5`), y motor de reglas
  local para cuando no hay clave. Cada detección guarda cuál de los dos habló.
- Cola de triaje ordenada por confianza × gravedad, con la cita resaltada en su
  contexto, atajos de teclado y un cajón aparte para la baja confianza.
- Confirmar abre el expediente desde su plantilla, con la fecha de cómputo que
  decide la persona. Un plazo citado en un correo sigue sin crear ningún plazo.
- Lo que una persona confirma o descarta no lo cambia un análisis posterior; un
  descarte automático sí puede sustituirlo un motor mejor.
- `MOTOR_DETECCION` fija el motor; la suite de extremo a extremo lo pone en
  `reglas` para no depender de la red ni gastar dinero.

## Portada de acceso (2026-08-13)

- `/acceso` abre a pantalla completa con la marca y el logotipo centrados, y el
  formulario aparece al bajar. Sin JavaScript o con movimiento reducido no hay
  transición: las dos partes se ven y el formulario está a un scroll.

## Entrar con Google y con enlace por correo (2026-08-12)

- Adaptador de Auth.js ajustado al modelo `User` que ya existía: traduce
  `emailVerified`/`image` y da un nombre provisional a quien entra por enlace
  mágico, porque `name` no admite nulos.
- Política de acceso: sólo se vincula una cuenta de Google si el proveedor
  confirma el correo, y ninguna cuenta con doble factor puede entrar por una vía
  que no sepa pedirle el código.
- Google se registra sólo si hay credenciales; sin ellas la aplicación arranca
  igual y no enseña el botón.
- Enlace mágico a través de `lib/mail`, así que en desarrollo se escribe en la
  consola y no hace falta ningún SMTP.
- `/bienvenida`: acepta invitaciones pendientes o crea la organización, que es
  lo que evita que quien entra con Google se quede autenticado y sin sitio.

## M5 — Expedientes, plazos y cronograma (2026-08-12)

- Modelo de expedientes: plantillas de procedimiento, hitos, plazos y actuaciones,
  con RLS en las seis tablas nuevas.
- Cuatro plantillas de sistema (penalidad, recurso especial, impago, despido), que
  ahora se siembran al registrar cada organización nueva.
- `planificarPasos`: encadena las fechas paso a paso — el plazo para recurrir
  arranca de la resolución, no de la apertura — y marca como incompleto todo lo
  que cuelga de una fecha estimada.
- Pantallas de expedientes (lista, alta y detalle) y de plazos, con cronograma
  y su tabla equivalente siempre visible.
- La navegación de secciones ya no se oculta en móvil.

## [Unreleased]

### M1 — Identity & tenancy (en curso)

#### Added

- Identity schema: `User`, `Membership`, `Team`, `TeamMember`, `AccessGrant`,
  plus the Auth.js adapter models. Roles reflect the Spanish personas
  (GESTOR_CONTRATO, JURIDICO, LETRADO_EXTERNO, RRHH, ADMIN_CONTABLE…).
- Permission matrix in `lib/auth/permissions.ts` — 80 permissions across the
  whole domain, mapped per role in one place, never compared inline.
- `can()` / `assertCan()` / `filterAuthorised()`: pure, injectable clock,
  scope-aware. Time-boxed `AccessGrant`s drive external-counsel access.
- **848 generated permission tests** — every role × every permission, plus
  in-scope/out-of-scope, cross-tenant, membership status and grant expiry.
- Tenant-scoped data access layer that rewrites `where` and stamps
  `organisationId` on writes, so application code cannot issue an unfiltered
  query.
- Row-level security on every tenant-owned table, enforced through a dedicated
  non-superuser role. Verified: scoped reads see only their tenant, unscoped
  reads see nothing, cross-tenant writes are rejected by Postgres.
- Case-insensitive unique index on `users.email`.
- ADR 0005 on the three isolation layers and the two-role split.

- Auth.js v5 with credentials, argon2id (64 MiB, 3 iterations) and account
  lockout after 5 failed attempts. Session config split so middleware stays
  edge-safe.
- Sign-up creates person, organisation and OWNER membership in one
  transaction; slug generation strips Spanish accents and legal forms
  ("Servicios Integrales Guadaíra, S.L." → `servicios-integrales-guadaira`).
- Organisation-scoped app shell. The organisation comes from the URL and is
  re-checked against the membership table per request, so a role change takes
  effect immediately rather than at next sign-in.
- Identity plane split from the data plane: sign-up, sign-in and session
  resolution use an elevated connection because they legitimately span
  tenants; everything else stays on the RLS-constrained role.
- HIBP breach check via k-anonymity, failing open.
- 20 end-to-end tests covering sign-up, sign-in, sign-out and cross-tenant 404.

- Invitations: single-use token stored only as a SHA-256 hash, 7-day expiry,
  consumed in the same update that activates the membership. Accepting as an
  existing user adds a membership rather than a second account.
- Mail behind a `MailService` interface. Development logs to the console;
  production refuses to start rather than silently dropping messages. A mail
  failure no longer discards the invitation — the link is handed back to the
  administrator instead.
- Two-factor authentication: TOTP with QR enrolment, ten single-use recovery
  codes, mandatory for OWNER and ORG_ADMIN, integrated into sign-in.
- AES-256-GCM field encryption with a self-describing format that carries its
  version and key id, so a future KMS migration does not require re-encrypting
  everything. Used for TOTP secrets now, personal data from M11.
- Settings: team list, invitations, role changes and suspension, all gated by
  the permission matrix and guarded again server-side. The last owner cannot
  be demoted or suspended.

#### Known gaps

- A person invited before they have an account gets their email local-part as a
  display name; the accept form should ask for it.
- No magic-link sign-in yet.
- `MAIL_TRANSPORT` has no real provider wired up — production will refuse to
  send until one is configured.

### M0 — Foundation

#### Added

- Next.js 15 App Router project with TypeScript in strict mode
  (`noUncheckedIndexedAccess`, `verbatimModuleSyntax` and friends enabled).
- Tailwind CSS v4 with the Olbun design token set: slate foundation, single
  indigo accent, and status colours reserved exclusively for semantics. Dark
  mode via CSS variables from day one.
- Prisma 6 with the `Organisation` tenancy root and the initial migration.
- Postgres 16 via Docker Compose on host port 5433, with an ICU collation fixed
  so ordering matches across machines and CI.
- `GET /api/health` liveness probe that verifies database connectivity and
  leaks no error detail.
- Boot-time environment validation with Zod (`lib/env.ts`); the app refuses to
  start on a missing or malformed variable.
- Structured logging with pino, with credential fields redacted.
- Security headers: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`, `Permissions-Policy`.
- ESLint flat config, including a rule that confines the unscoped Prisma client
  to `lib/db/` ahead of the tenant-scoped DAL in M1.
- Prettier, Husky, lint-staged and commitlint with Conventional Commits.
- Vitest with an 80% coverage threshold on `lib/`, and Playwright with desktop
  and mobile projects.
- GitHub Actions CI: typecheck → lint → format → test → build → E2E, plus a
  dependency audit job.
- ADR template and ADRs 0001–0004.
- `AGENTS.md` recording conventions, current milestone, known gaps and open
  decisions.

#### Deferred

- Redis/BullMQ and MinIO are absent from Docker Compose until M5 and M6 make
  use of them.
- `next-intl`, shadcn/ui component installation and the shared UI patterns land
  with the app shell in M2.
- Testcontainers-backed integration tests land with the first server actions in
  M1.
