# ADR 0010: Cadena de custodia documental local

- **Estado:** Aceptada
- **Fecha:** 2026-08-14
- **Hito:** M9

## Contexto

Un fichero recibido por Olbun puede ser prueba contractual, contener malware o
ser un PDF escaneado sin capa de texto. La aplicación debe buscar en él sin
enviar su contenido a un tercero, impedir que un resultado no analizado parezca
seguro y conservar la diferencia entre retirar un documento de la interfaz y
destruirlo al cumplir su plazo legal.

## Decisión

1. Guardar versiones inmutables y direccionadas por SHA-256 en S3/MinIO. Nunca
   se sobrescribe un objeto ni se sirve sin volver a comprobar su huella.
2. Analizar cada subida con el daemon oficial ClamAV mediante `INSTREAM`. El
   scanner recibe bytes, no credenciales ni claves S3. Solo `LIMPIO` permite
   descargar, extraer texto o incluir la versión en una exportación.
3. Tratar una caída como `NO_ANALIZADO`, nunca como limpio. El fichero se
   conserva bloqueado y puede reanalizarse cuando el servicio vuelve.
4. Extraer texto de PDF y DOCX solo después del veredicto limpio. Un PDF sin
   texto queda `OCR_PENDIENTE` en vez de aparentar una indexación vacía.
5. Ejecutar Tesseract localmente con el modelo español versionado. El OCR no
   llama a ninguna API ni transfiere documentos. La renderización y el
   reconocimiento ocurren fuera de una transacción larga; resultado y
   auditoría se confirman juntos después.
6. Limitar páginas por ejecución y distinguir `OCR_COMPLETADO` de
   `OCR_PARCIAL`. El límite protege CPU y memoria sin afirmar que se leyó el
   documento entero.
7. Mantener un `tsvector` español generado y un índice GIN sobre el texto de
   cada versión limpia. La consulta raw solo se ejecuta dentro de
   `tenantTransaction()`, con RLS activo.
8. Separar papelera y purga. El borrado ordinario conserva versiones y bytes y
   exige motivo; restaurar conserva ambas acciones en auditoría. La purga por
   retención, confirmada expresamente, elimina bytes cuando nadie más comparte
   su hash.
9. Un bloqueo legal registra quién, cuándo y por qué, e impide tanto papelera
   como purga. Retirarlo también exige motivo y queda auditado.
10. Exportar un expediente con índice PDF, cronología Markdown y manifiesto CSV
    con SHA-256. Las versiones no limpias se excluyen y se declaran como
    incidencia; nunca desaparecen silenciosamente.

## Consecuencias

- ClamAV y sus firmas pasan a ser una dependencia operativa obligatoria. La
  aplicación degrada de forma segura durante una caída, pero las nuevas
  versiones no pueden descargarse ni indexarse hasta reanalizarlas.
- OCR consume CPU. M9 ofrece ejecución explícita y acotada; M12 moverá su
  planificación y reintentos a BullMQ sin cambiar estados ni contratos.
- La papelera aumenta temporalmente el uso de almacenamiento. Es intencionado:
  una retirada accidental debe ser reversible y la destrucción pertenece al
  flujo de retención.
- `.doc` binario antiguo no se interpreta a medias. Se conserva y etiqueta como
  formato sin extractor hasta que exista una herramienta fiable.

## Fuentes técnicas

- ClamAV, protocolo `clamd` e `INSTREAM`:
  <https://docs.clamav.net/manual/Usage/ClamdProtocol.html>
- Imagen oficial ClamAV:
  <https://hub.docker.com/r/clamav/clamav/tags>
- Tesseract.js:
  <https://github.com/naptha/tesseract.js>
- PostgreSQL, búsqueda full-text:
  <https://www.postgresql.org/docs/16/textsearch.html>
