import type { Metadata } from "next";

import { getCompetencies, getStories } from "@/lib/stories/queries";
import { StoriesView } from "@/components/stories/stories-view";

export const metadata: Metadata = { title: "Story bank" };

export default async function StoriesPage() {
  const [stories, competencies] = await Promise.all([
    getStories(),
    getCompetencies(),
  ]);

  return <StoriesView stories={stories} competencies={competencies} />;
}
