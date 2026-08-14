-- A bounded OCR run may index the first pages without claiming the complete
-- document was read. PostgreSQL enum additions must be their own migration.
ALTER TYPE "EstadoIndexacion" ADD VALUE 'OCR_PARCIAL' AFTER 'OCR_COMPLETADO';
