import { getTranslations } from "next-intl/server";

import { ABOUT_BLOCKS } from "@/lib/site/our-path-data";

import { AboutBlock } from "./about-block";
import "./our-path.css";

// The about blocks share one continuous off-white band; each block brings its
// own vertical padding so they touch with no gap.
export async function AboutSection() {
  const t = await getTranslations("ourPath.about");

  return (
    <div className="our-path-scope bg-(--our-path-band)">
      {ABOUT_BLOCKS.map((block) => {
        const base = `items.${block.id}`;
        return (
          <AboutBlock
            key={block.id}
            date={t(`${base}.date`)}
            title={t(`${base}.title`)}
            paragraphs={Array.from({ length: block.paragraphCount }, (_, index) =>
              t(`${base}.paragraphs.p${index + 1}`)
            )}
            imageAlt={t(`${base}.imageAlt`)}
            image={block.image}
            imageSide={block.imageSide}
            inset={block.inset}
          />
        );
      })}
    </div>
  );
}
