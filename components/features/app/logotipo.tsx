import Image from 'next/image';

import marca from '@/public/olbun-marca.png';

/**
 * The Olbun lockup: the mark, then the wordmark.
 *
 * The mark is the real artwork with its white background lifted to alpha, so
 * it sits on navy and on white alike. The wordmark is set in type rather than
 * shipped as a second image — at header sizes a 20px-tall PNG of five letters
 * is softer than live text, and live text stays selectable and searchable.
 *
 * `priority` because this is in the header of every page: letting it lazy-load
 * means the first thing a person sees is the space where the logo will be.
 */
export function Logotipo({
  tamano = 'normal',
  className = '',
}: {
  tamano?: 'normal' | 'grande';
  className?: string;
}) {
  const alto = tamano === 'grande' ? 46 : 32;

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src={marca}
        alt=""
        height={alto}
        // Width follows the source ratio; the mark is wider than it is tall.
        width={Math.round(alto * 1.04)}
        priority
        aria-hidden="true"
      />
      <span
        className={`font-semibold tracking-[0.18em] ${
          tamano === 'grande' ? 'text-2xl' : 'text-base'
        }`}
      >
        OLBUN
      </span>
    </span>
  );
}
