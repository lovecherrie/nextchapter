// A reread keeps its own dated review, but contributes no extra vote.
export function latestReviewsByReader<T extends { id: string; user_id: string; created_at: string | null }>(reviews: T[]): T[] {
  const latest = new Map<string, T>();
  for (const review of reviews) {
    const previous = latest.get(review.user_id);
    const date = Date.parse(review.created_at || "") || 0;
    const previousDate = Date.parse(previous?.created_at || "") || 0;
    if (!previous || date > previousDate || (date === previousDate && review.id > previous.id)) latest.set(review.user_id, review);
  }
  return [...latest.values()];
}
