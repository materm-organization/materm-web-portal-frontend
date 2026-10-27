import { getTranslations } from "next-intl/server";

import { BlogContainer } from "@/components/blog/blog-container";
import { CategoryTabs } from "@/components/blog/category-tabs";
import { PostCard } from "@/components/blog/post-card";
import { CtaLink } from "@/components/site/cta-link";
import { Reveal, revealDelay } from "@/components/site/motion";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

import type { SectionComponentProps } from "./types";

// `post_list`: blog index body = category strip (a <nav> of links, `?category=`) + a shadcn Card
// grid + empty state. The posts arrive already filtered for the active category (pagination is
// PF-5). Shell strings (`blog.index.*`) are UI strings.
export async function PostList({
  domId,
  showCategoryTabs = true,
  showAllTab = true,
  categories,
  activeCategory,
  posts,
}: SectionComponentProps<"post_list">) {
  const t = await getTranslations("blog");
  const activeLabel = categories.find((category) => category.key === activeCategory)?.label ?? "";

  return (
    <BlogContainer id={domId} className="pt-12 pb-16 lg:pb-[100px]">
      {showCategoryTabs ? (
        <Reveal y={16}>
          <CategoryTabs
            active={activeCategory ?? undefined}
            categories={categories}
            showAll={showAllTab}
          />
        </Reveal>
      ) : null}

      <div className="mt-10 lg:mt-14">
        {posts.length > 0 ? (
          <ul
            aria-label={t("index.listLabel")}
            className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-x-[39px] lg:gap-y-10"
          >
            {posts.map((post, index) => (
              <Reveal as="li" key={post.href} delay={revealDelay(index % 3)}>
                <PostCard post={post} priority={index === 0} />
              </Reveal>
            ))}
          </ul>
        ) : (
          <Reveal>
            <Empty className="border border-site-line">
              <EmptyHeader>
                <EmptyTitle className="text-site-ink">{t("index.empty.title")}</EmptyTitle>
                <EmptyDescription className="text-site-muted">
                  {t("index.empty.description", { category: activeLabel })}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {/* Same page as the category tabs: keep the scroll position. */}
                <CtaLink href="/blog" scroll={false}>
                  {t("index.empty.action")}
                </CtaLink>
              </EmptyContent>
            </Empty>
          </Reveal>
        )}
      </div>
    </BlogContainer>
  );
}
