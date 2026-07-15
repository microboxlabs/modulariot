// Type declarations for the pagefind browser runtime.
// The actual JS is written to public/pagefind/ at build time by
// scripts/build-search-index.mjs and served as a static file.
declare module "/pagefind/pagefind.js" {
  interface PagefindResultData {
    url: string;
    meta: Record<string, string | undefined>;
  }

  interface PagefindResult {
    data: () => Promise<PagefindResultData>;
  }

  export function search(
    query: string,
  ): Promise<{ results: PagefindResult[] }>;
}
