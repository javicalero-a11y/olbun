/**
 * A business rule tied to one input field.
 *
 * This lives below the Server Action layer so application services can use it
 * without importing Next.js, Auth.js or request infrastructure.
 */
export class ErrorDeCampo extends Error {
  constructor(
    readonly campo: string,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorDeCampo';
  }
}
