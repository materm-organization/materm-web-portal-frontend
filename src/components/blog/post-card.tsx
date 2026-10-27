import Image from "next/image";
import Link from "next/link";

import type { LocalizedBlogPost } from "@/components/blog/localize-post";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

interface PostCardProps {
  post: LocalizedBlogPost;
  /** Hero image of the first cards can be eager-loaded by the caller. */
  priority?: boolean;
}

// Blog index card (an addition, not in the Figma design): hero image, category
// badge, date + location, title. The title link is stretched over the whole
// card (`after:absolute after:inset-0`) so the card is one click target
// without nesting interactive elements.
export function PostCard({ post, priority }: PostCardProps) {
  return (
    <Card className="group relative h-full gap-0 overflow-hidden rounded-site-card border-site-line bg-white py-0 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-site-green-700">
      <AspectRatio ratio={16 / 9} className="bg-site-line">
        <Image
          src={post.heroImage.src}
          alt={post.heroImage.alt}
          fill
          priority={priority}
          sizes="(min-width: 1432px) 430px, (min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </AspectRatio>
      <CardContent className="flex flex-1 flex-col items-start gap-3 p-5">
        <Badge
          variant="outline"
          className="border-site-green-700 px-3 py-1 text-sm font-medium text-site-green-700"
        >
          {post.categoryLabel}
        </Badge>
        <CardTitle
          role="heading"
          aria-level={2}
          className="text-xl leading-[1.2] font-bold text-site-ink uppercase lg:text-[22px]"
        >
          <Link
            href={`/blog/${post.slug}`}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {post.title}
          </Link>
        </CardTitle>
        <CardDescription className="text-base text-site-muted">
          <time dateTime={post.isoDate}>{post.displayDate}</time>
          <span aria-hidden="true"> | </span>
          {post.location}
        </CardDescription>
        <p className="line-clamp-3 font-site-manrope text-base leading-[1.7] text-site-ink-strong/85">
          {post.intro[0]}
        </p>
      </CardContent>
    </Card>
  );
}
