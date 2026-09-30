/** Browser-only download; call in response to a user's export action. */
export function downloadCsv(csvContent: string, filename: string): void {
  const forbidden = new Set(String.raw`/\:*?"<>|`);
  const safeName =
    Array.from(filename, (char) =>
      (char.codePointAt(0) ?? 0) < 32 || forbidden.has(char) ? "_" : char,
    )
      .join("")
      .trim()
      .slice(0, 240) || "dashboard.csv";
  const blob = new Blob(["\uFEFF", csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName;
  anchor.hidden = true;
  try {
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    // Give the browser time to consume the download before releasing the URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
