import Image from 'next/image';

import marca from '@/public/olbun-marca.png';
import marcaGrande from '@/public/olbun-marca-512.png';

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
const ALTURAS = { normal: 32, grande: 46, portada: 104 } as const;

const TIPOGRAFIA = {
  normal: 'text-base tracking-[0.18em]',
  grande: 'text-2xl tracking-[0.18em]',
  // The cover stacks the mark above the word and lets both breathe, so the
  // letterspacing opens up with the size rather than staying proportional.
  // The negative margin takes back the trailing letterspace, which would
  // otherwise push the word visibly right of centre.
  portada: 'text-5xl tracking-[0.3em] -mr-[0.3em] sm:text-6xl',
} as const;

export function Logotipo({
  tamano = 'normal',
  className = '',
}: {
  tamano?: keyof typeof ALTURAS;
  className?: string;
}) {
  const alto = ALTURAS[tamano];
  const enPortada = tamano === 'portada';

  return (
    <span
      className={`inline-flex items-center ${
        enPortada ? 'flex-col gap-6' : 'gap-2.5'
      } ${className}`}
    >
      <Image
        // The header mark is a 100px source, which would be upscaled and soft
        // on the cover; the 512px one is there for exactly this size.
        src={enPortada ? marcaGrande : marca}
        alt=""
        height={alto}
        // Width follows each source's own ratio.
        width={enPortada ? alto : Math.round(alto * 1.04)}
        priority
        aria-hidden="true"
      />
      <span className={`font-semibold ${TIPOGRAFIA[tamano]}`}>OLBUN</span>
    </span>
  );
}
