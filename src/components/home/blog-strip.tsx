"use client";

import { useState, type FocusEvent } from "react";

import { BlogStripSlice, type BlogStripPost } from "./blog-strip-slice";

// Hover / keyboard-focus accordion (Figma component set 170:11950): the slice under the pointer
// expands (flex-grow 780 vs 195.667), the others collapse. Resting state = slice 1 expanded (S1).
// `active` only changes on pointer-enter / focus of a slice and resets when the pointer / focus
// leaves the whole strip, so slices resizing under a stationary pointer cannot cause flicker: the
// hovered slice only ever grows, so it keeps covering the pointer. Below `lg` the strip is a
// plain stacked card grid and `active` has no visible effect.
const DEFAULT_ACTIVE = 0;

export function BlogStrip({ posts }: { posts: BlogStripPost[] }) {
  const [active, setActive] = useState(DEFAULT_ACTIVE);

  const reset = () => setActive(DEFAULT_ACTIVE);
  const handleBlur = (event: FocusEvent<HTMLUListElement>) => {
    // Focus moving to another slice keeps the strip "in use"; only leaving it resets.
    if (!event.currentTarget.contains(event.relatedTarget)) reset();
  };

  return (
    <ul
      onPointerLeave={reset}
      onBlur={handleBlur}
      // >= lg: Figma strip is 1367 x 871 (aspect kept at every width; 871px tall at the 1368px column).
      className="@container grid w-full gap-4 sm:grid-cols-2 lg:flex lg:aspect-[1367/871] lg:gap-0"
    >
      {posts.map((post, i) => (
        <BlogStripSlice
          key={post.key}
          post={post}
          index={i}
          expanded={i === active}
          onActivate={() => setActive(i)}
        />
      ))}
    </ul>
  );
}
