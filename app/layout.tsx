import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';

import { claseDe, COOKIE_TEMA, leerTema } from '@/lib/tema';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'Olbun',
    template: '%s · Olbun',
  },
  description:
    'Service delivery, risk and assurance for organisations that deliver services to the public sector.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Matches the navy the app actually renders, so the browser chrome on iOS
  // does not sit in a different colour from the page under it.
  themeColor: '#0b1526',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Read on the server so the class is in the first byte of HTML. Deciding
  // this on the client would show every visitor a white flash first.
  const tema = leerTema((await cookies()).get(COOKIE_TEMA)?.value);

  return (
    <html lang="es-ES" className={claseDe(tema)} suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
