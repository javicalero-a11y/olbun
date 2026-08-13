/**
 * The signed-out shell.
 *
 * A single soft wash of the brand gradient sits behind everything — the one
 * decorative use of it besides the marketing hero. It is a background, never a
 * surface for text: everything readable sits on a card or on the cover above
 * it, where the contrast is known.
 *
 * The card itself is no longer here. `/acceso` opens with a full-height cover
 * and brings its own frame; the rest of the signed-out pages wrap themselves
 * in `PanelAuth`.
 *
 * No `overflow` on the wrapper: it would make this the scroll container and
 * stop the cover's `position: sticky` pinning to the viewport. The gradient is
 * fixed, so the viewport clips it on its own.
 */
export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      {/* Decorative only, and kept away from assistive technology. */}
      <div
        aria-hidden="true"
        className="fondo-degradado pointer-events-none fixed -top-40 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
      />
      {children}
    </div>
  );
}
