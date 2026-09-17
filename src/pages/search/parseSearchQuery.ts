export type SearchScope =
  | "all"
  | "music"
  | "page"
  | "youtube"
  | "imdb"
  | "genius"
  | `online-${string}`;

export interface ParsedSearchQuery {
  scope: SearchScope;
  term: string;
}

/**
 * Parses the search syntax from the spec:
 *   @music: name_of_audio_local
 *   @page: search_page_and_click_events_redirect_to_it
 *   @youtube: query
 *   @online-<service>: query   (e.g. @online-spotify: query)
 *   @imdb: query
 *   @genius: query
 *
 * Anything without a recognized `@scope:` prefix searches everything ("all").
 */
export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const match = raw.trim().match(/^@([a-z0-9-]+):\s*(.*)$/i);
  if (!match) {
    return { scope: "all", term: raw.trim() };
  }

  const [, scopeRaw, term] = match;
  const scope = scopeRaw.toLowerCase();
  const knownScopes: SearchScope[] = ["music", "page", "youtube", "imdb", "genius"];

  if ((knownScopes as string[]).includes(scope)) {
    return { scope: scope as SearchScope, term: term.trim() };
  }
  if (scope.startsWith("online-")) {
    return { scope: scope as SearchScope, term: term.trim() };
  }

  return { scope: "all", term: raw.trim() };
}
