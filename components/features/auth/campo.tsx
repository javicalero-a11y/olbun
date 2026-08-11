import { cn } from '@/lib/utils';

interface CampoProps extends React.InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  nombre: string;
  errores?: string[] | undefined;
  ayuda?: string;
}

/**
 * A labelled input with its error wired up for assistive technology: the error
 * is referenced by `aria-describedby` and announced politely, and the field is
 * marked `aria-invalid` so it is not signalled by colour alone (SPEC §8).
 */
export function Campo({ etiqueta, nombre, errores, ayuda, className, ...props }: CampoProps) {
  const errorId = `${nombre}-error`;
  const ayudaId = `${nombre}-ayuda`;
  const invalido = Boolean(errores?.length);

  const describedBy = [ayuda ? ayudaId : null, invalido ? errorId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-1.5">
      <label htmlFor={nombre} className="block text-sm font-medium">
        {etiqueta}
      </label>

      <input
        id={nombre}
        name={nombre}
        aria-invalid={invalido}
        aria-describedby={describedBy || undefined}
        className={cn(
          'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          invalido && 'border-destructive',
          className,
        )}
        {...props}
      />

      {ayuda ? (
        <p id={ayudaId} className="text-xs text-muted-foreground">
          {ayuda}
        </p>
      ) : null}

      {invalido ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {errores?.[0]}
        </p>
      ) : null}
    </div>
  );
}

export function BotonEnviar({
  children,
  pendiente,
}: {
  children: React.ReactNode;
  pendiente: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pendiente}
      className={cn(
        'w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
        'disabled:opacity-60',
      )}
    >
      {pendiente ? 'Un momento…' : children}
    </button>
  );
}

export function ErrorGeneral({ mensaje }: { mensaje?: string | undefined }) {
  if (!mensaje) return null;

  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      {mensaje}
    </p>
  );
}
