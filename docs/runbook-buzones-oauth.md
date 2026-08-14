# Runbook: buzones OAuth

## Antes de conectar datos reales

1. Completar y aprobar `docs/dpia.md`.
2. Confirmar que el buzón es funcional. Si es personal, cargar la política
   interna y registrar la consulta a la representación antes de continuar.
3. Usar un dominio HTTPS estable. `192.168.x.x` sirve para la demo local de
   Olbun, pero no debe registrarse como callback OAuth de producción.
4. Crear clientes separados de los utilizados para «Entrar con Google» o
   «Entrar con Microsoft».

## Google Workspace

1. Crear un proyecto en Google Cloud y habilitar Gmail API.
2. Configurar la pantalla de consentimiento y solicitar únicamente
   `https://www.googleapis.com/auth/gmail.readonly`.
3. Crear un cliente OAuth tipo Web.
4. Registrar exactamente:
   `https://DOMINIO/api/buzones/oauth/google/callback`.
5. Definir `GOOGLE_MAIL_CLIENT_ID` y `GOOGLE_MAIL_CLIENT_SECRET`.

Google puede exigir verificación adicional por tratarse de datos de Gmail. No
publicar el cliente como producción hasta completar ese proceso.

## Microsoft 365

1. Registrar una aplicación Web en Microsoft Entra.
2. Añadir permisos delegados `User.Read` y `Mail.Read`; no añadir permisos de
   aplicación ni `Mail.ReadWrite`.
3. Registrar exactamente:
   `https://DOMINIO/api/buzones/oauth/microsoft/callback`.
4. Crear un secreto y definir `MICROSOFT_MAIL_CLIENT_ID`,
   `MICROSOFT_MAIL_CLIENT_SECRET` y `MICROSOFT_MAIL_TENANT_ID`. Para SaaS
   multi-tenant, el valor inicial es `organizations`.

## Comprobación

1. Abrir Comunicaciones como propietario o administrador.
2. Conectar un buzón funcional de pruebas.
3. Comprobar que el proveedor muestra únicamente lectura.
4. Pulsar Sincronizar y verificar nuevos, duplicados y señales.
5. Repetir: la segunda ejecución debe usar el cursor y no duplicar mensajes.
6. Desconectar y verificar que desaparecen los tokens locales. Revocar también
   el consentimiento desde el proveedor durante una baja definitiva.

## Análisis histórico con Claude Message Batches

1. Aprobar expresamente Anthropic como proveedor en la evaluación de impacto y
   en los contratos de tratamiento aplicables. Message Batches no debe tratarse
   como un servicio Zero Data Retention.
2. Definir `ANTHROPIC_API_KEY` solo en el gestor de secretos del entorno. Nunca
   pegarla en una pantalla ni en un ticket.
3. Sincronizar las páginas históricas aprobadas. Cada ejecución importa un
   máximo de 500 y conserva el cursor de la página siguiente.
4. En «Análisis histórico por lotes», enviar los mensajes pendientes. Un mismo
   mensaje tiene una restricción única y no puede entrar en dos lotes.
5. Comprobar el resultado más tarde. Anthropic indica que puede tardar hasta 24
   horas; hasta M12 Olbun no sondea automáticamente.
6. Revisar las señales en la cola humana. El resultado del modelo nunca abre un
   expediente ni fija un plazo por sí solo, y toda cita se vuelve a verificar
   contra el texto almacenado.

Sin `ANTHROPIC_API_KEY`, el histórico se analiza con el motor local y el correo
no sale de la infraestructura de Olbun.

## Incidencias

- `redirect_uri_mismatch`: el esquema, host, puerto, ruta o barra final no
  coincide exactamente con el redirect registrado.
- `REQUIERE_ATENCION`: el refresh token fue revocado o la política del tenant
  cambió; volver a conectar.
- Cursor Gmail 404: Olbun ejecuta automáticamente una sincronización completa
  acotada porque el historial disponible caducó.
- Cursor Graph inválido: no editarlo. Desconectar y conectar de nuevo si el
  proveedor ya no lo acepta.
- Lote todavía en proceso: no volver a enviar los mismos mensajes; usar
  «Comprobar resultado». La API puede tardar hasta 24 horas.
