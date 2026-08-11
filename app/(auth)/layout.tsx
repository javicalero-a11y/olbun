import Link from 'next/link';

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-6 py-6">
        <Link
          href="/"
          className="text-sm font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground"
        >
          Olbun
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-6 pb-24">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
