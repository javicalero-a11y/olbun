# Runbook: documentos, antivirus y OCR

## Servicios locales

```bash
pnpm db:up
docker compose ps postgres minio clamav
docker exec olbun-clamav clamdscan --ping 1
```

ClamAV puede tardar alrededor de un minuto en quedar sano la primera vez,
mientras carga o actualiza firmas. La definición persiste en el volumen
`clamav-data`; MinIO conserva objetos en `minio-data`.

## Estados que puede ver soporte

| Estado          | Significado                          | Acción                                                       |
| --------------- | ------------------------------------ | ------------------------------------------------------------ |
| `LIMPIO`        | ClamAV respondió OK                  | Puede descargarse e indexarse                                |
| `INFECTADO`     | Una firma coincidió                  | Cuarentena; no descargar ni exportar                         |
| `NO_ANALIZADO`  | Daemon caído, timeout o error        | Recuperar ClamAV y pulsar «Reanalizar»                       |
| `OCR_PENDIENTE` | PDF limpio sin capa de texto         | Pulsar «Ejecutar OCR»                                        |
| `OCR_PARCIAL`   | Se alcanzó `OCR_MAX_PAGES`           | Revisar el límite y volver a procesar con un worker ampliado |
| `ERROR`         | Parser u OCR no pudo leer el fichero | Revisar `motivoIndexacion` y la integridad del PDF           |

Una caída de ClamAV no pierde la subida. El objeto queda en MinIO y la versión
en Postgres, pero no hay enlace de descarga hasta obtener un veredicto limpio.

## Diagnóstico de ClamAV

```bash
docker compose logs --tail=200 clamav
docker exec olbun-clamav freshclam --version
```

Comprobar que el puerto 3310 solo es accesible desde la red de aplicación en
producción. `clamd` no ofrece autenticación: nunca debe exponerse a Internet.
Las firmas necesitan salida HTTPS desde el contenedor para actualizarse.

## Diagnóstico de OCR

- El modelo `spa` está instalado como dependencia y no usa CDN.
- `OCR_MAX_PAGES` vale 30 por defecto. Subirlo aumenta CPU y memoria por
  petición; para lotes grandes se debe usar el worker de M12.
- `ocrPaginas`, `ocrConfianza`, `indexadoEn` y `motivoIndexacion` permiten
  distinguir un resultado completo, parcial o fallido.
- El OCR se ejecuta únicamente después de `LIMPIO`.

## Borrado, bloqueo y conservación

- **Papelera:** reversible; conserva todas las versiones y bytes; exige motivo.
- **Bloqueo legal:** impide papelera y purga; exige motivo al aplicar y retirar.
- **Purga:** irreversible; solo aparece tras el plazo de conservación y exige
  escribir `PURGAR`. Un objeto compartido por hash no se elimina mientras otra
  versión viva lo use.

Antes de purgar en producción, comprobar el expediente, cualquier hold legal y
la política de conservación validada por el cliente. Olbun aplica reglas; no
sustituye el criterio jurídico del responsable.
