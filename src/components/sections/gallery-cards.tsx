import { getTranslations } from "next-intl/server";

import {
  HomeGalleryFrame,
  ShowcaseGalleryFrame,
  StandardGalleryFrame,
  type GalleryFrameProps,
} from "./gallery-cards/frames";
import type { SectionComponentProps } from "./types";

// `gallery_cards` (variants `home` | `standard` | `showcase`, doc/04 section 3.4.7): the three
// pre-CMS gallery rows behind one component. Shell strings come from `site.gallery.*`.
export async function GalleryCards({ variant, rowLabel, ...rest }: SectionComponentProps<"gallery_cards">) {
  const t = await getTranslations("site.gallery");

  const frameProps: GalleryFrameProps = {
    ...rest,
    rowLabel: rowLabel ?? t("rowLabel"),
    cardLabel: (index, total) => t("cardLabel", { index, total }),
  };

  switch (variant) {
    case "standard":
      return <StandardGalleryFrame {...frameProps} />;
    case "showcase":
      return <ShowcaseGalleryFrame {...frameProps} />;
    default:
      return <HomeGalleryFrame {...frameProps} />;
  }
}
