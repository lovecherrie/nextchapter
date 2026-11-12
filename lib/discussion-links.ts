export function discussionHref(id: string) {
  return `/discussion/${encodeURIComponent(id)}`;
}

export function validDiscussionId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
