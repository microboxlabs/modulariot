import { FaGithub } from "react-icons/fa";

const REPO_API = "https://api.github.com/repos/microboxlabs/modulariot";
const REPO_URL = "https://github.com/microboxlabs/modulariot";

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

async function fetchStars(): Promise<number | null> {
  try {
    const res = await fetch(REPO_API, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: unknown };
    return typeof data.stargazers_count === "number"
      ? data.stargazers_count
      : null;
  } catch {
    return null;
  }
}

export async function GitHubStarBadge() {
  const stars = await fetchStars();

  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800"
    >
      <FaGithub aria-hidden className="size-4" />
      <span>Star on GitHub</span>
      {stars !== null ? (
        <span
          aria-label={`${stars.toLocaleString("en")} GitHub stars`}
          className="ml-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-xs tabular-nums text-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          {compact.format(stars)}
        </span>
      ) : null}
    </a>
  );
}
