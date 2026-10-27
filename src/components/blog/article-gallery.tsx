import { GalleryCard } from "@/components/site/gallery-card";
import { Reveal, revealDelay } from "@/components/site/motion";
import { SectionHeading } from "@/components/site/section-heading";

interface ArticleGalleryProps {
  eyebrow: string;
  heading: string;
  description: string;
  photos: readonly { src: string; alt: string }[];
}

// "GALLERY" tick heading + 3-column grid of tall rounded photos (430x562, r12;
// 3 -> 2 -> 1 columns). Eyebrow, title and description each fade up on their
// own (stagger 0/1/2), so the title and description are rendered here with the
// same classes as `SectionHeading` (keep them in sync; the description's
// `lowercase` is the design quirk, drop it for sentence case). The photos
// stagger by grid column (`index % 3`) so rows never chain into a long delay.
export function ArticleGallery({ eyebrow, heading, description, photos }: ArticleGalleryProps) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex w-full flex-col gap-5">
        <Reveal>
          <SectionHeading variant="tick" eyebrow={eyebrow} />
        </Reveal>
        <Reveal as="h2" delay={revealDelay(1)} className="text-2xl font-bold text-site-ink uppercase sm:text-3xl lg:text-[40px]">
          {heading}
        </Reveal>
        <Reveal as="p" delay={revealDelay(2)} className="text-base text-site-ink lowercase sm:text-xl lg:text-[22px]">
          {description}
        </Reveal>
      </div>
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-[39px] lg:gap-y-10">
        {photos.map((photo, index) => (
          <Reveal as="li" key={index} y={32} delay={revealDelay(index % 3)}>
            <GalleryCard
              src={photo.src}
              alt={photo.alt}
              sizes="(min-width: 1432px) 430px, (min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
            />
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
