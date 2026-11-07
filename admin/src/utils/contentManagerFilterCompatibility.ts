/** Maximum bracket depth used by Strapi Admin's default `qs.parse` call. */
export const CONTENT_MANAGER_FILTER_QUERY_DEPTH = 5;

/** Returns the deepest filter key in a serialized Content Manager query. */
export function getMaxFilterQueryDepth(queryString: string): number {
  let maxDepth = 0;
  const params = new URLSearchParams(queryString);

  for (const key of params.keys()) {
    if (!key.startsWith('filters[')) continue;
    const depth = key.match(/\[/g)?.length ?? 0;
    maxDepth = Math.max(maxDepth, depth);
  }

  return maxDepth;
}

/** Checks whether Strapi Admin can parse every filter key without truncating it. */
export function isFilterQuerySupportedByContentManager(queryString: string): boolean {
  return getMaxFilterQueryDepth(queryString) <= CONTENT_MANAGER_FILTER_QUERY_DEPTH;
}
