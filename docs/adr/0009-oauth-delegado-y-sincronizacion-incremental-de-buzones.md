# ADR 0009: OAuth delegado y sincronización incremental de buzones

- **Estado:** Aceptada
- **Fecha:** 2026-08-14
- **Hito:** M8

## Contexto

Olbun necesita leer buzones funcionales de Google Workspace y Microsoft 365 sin
conocer contraseñas y sin pedir permiso de escritura. La sincronización debe
continuar cuando la persona que conectó el buzón no esté presente. Los mensajes
son evidencia y pueden contener datos laborales; un token expuesto equivaldría
a exponer el buzón completo.

## Decisión

1. Usar Authorization Code de servidor, `state` de un solo uso y PKCE S256 en
   ambos proveedores. El `state` se almacena únicamente como SHA-256 y caduca en
   diez minutos.
2. Usar clientes OAuth de correo separados de los clientes de inicio de sesión.
   Evita mezclar la autenticación de Olbun con el consentimiento de lectura de
   un buzón y permite retirar uno sin romper el otro.
3. Solicitar solo Gmail readonly o `Mail.Read` delegado, junto con
   `offline_access`. No se pide escritura ni envío.
4. Cifrar access token, refresh token y PKCE verifier con AES-256-GCM. Nunca
   aparecen en HTML, logs ni eventos de auditoría.
5. Gmail conserva el `historyId`; Graph conserva los `deltaLink` opacos de
   Inbox y Sent Items por separado. Solo se siguen enlaces HTTPS de los hosts
   oficiales para impedir SSRF si un cursor fuera manipulado.
6. Limitar la primera carga a un año y a lotes de 500 mensajes por ejecución.
   Las siguientes ejecuciones retoman incluso la página intermedia pendiente,
   por lo que no se pierde el mensaje 501 ni es necesario mantener una
   transacción abierta durante llamadas externas.
7. Reclamar el buzón durante quince minutos antes de sincronizar. Un segundo
   proceso no repite la descarga; la unicidad de Message-ID/huella sigue siendo
   la última defensa contra duplicados.
8. La descarga y el análisis de MIME ocurren fuera de la transacción. La
   escritura de mensajes, cursor, credenciales renovadas y auditoría ocurre
   después en una transacción tenant. El correo nuevo recibe una detección
   determinista inmediata. Cuando hay clave Anthropic, el histórico aprobado
   queda pendiente para Claude Message Batches: hasta 500 mensajes por lote,
   identificados individualmente, con modelo y versión de prompt persistidos.
   Los resultados vuelven a pasar por la verificación literal de citas antes
   de crear una señal. Sin clave no se envía correspondencia a terceros.
9. Un booleano `esPersonal` distingue el propósito laboral sin multiplicar los
   tipos de proveedor. Si es verdadero, conexión y sincronización exigen tanto
   política interna documentada como fecha de consulta a la representación.

## Consecuencias

- Hace falta registrar redirects exactos para cada entorno. Una IP privada HTTP
  no es un despliegue OAuth de producción; la prueba real requiere un dominio
  HTTPS o un túnel controlado.
- Google puede exigir verificación de la pantalla de consentimiento por tratarse
  de un scope de Gmail. Microsoft puede aplicar consentimiento de administrador
  según las políticas del tenant cliente.
- Message Batches es asíncrono y puede tardar hasta 24 horas. Sus garantías de
  conservación no son las de Zero Data Retention; Anthropic debe constar como
  encargado/subencargado aprobado en la evaluación de impacto antes de enviar
  correspondencia real.
- Los webhooks push quedan para una mejora posterior. La semántica incremental
  ya está construida, por lo que un webhook solo tendrá que solicitar una
  sincronización. Hasta M12, sincronización y recogida de lotes son manuales.

## Fuentes técnicas

- Google, OAuth para aplicaciones web de servidor:
  <https://developers.google.com/identity/protocols/oauth2/web-server>
- Google, sincronización de Gmail:
  <https://developers.google.com/workspace/gmail/api/guides/sync>
- Microsoft Graph, acceso delegado:
  <https://learn.microsoft.com/en-us/graph/auth-v2-user>
- Microsoft Graph, delta de mensajes:
  <https://learn.microsoft.com/en-us/graph/delta-query-messages>
- Anthropic, Message Batches:
  <https://platform.claude.com/docs/en/build-with-claude/batch-processing>
