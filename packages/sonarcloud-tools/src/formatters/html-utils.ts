const ENTITY_MAP: Record<string, string> = {
  "&nbsp;": " ",
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&#x2F;": "/",
};

export function stripHtml(html: string): string {
  return html.replaceAll(/<[^>]*>/g, "");
}

export function decodeEntities(text: string): string {
  return text.replaceAll(
    /&(?:nbsp|lt|gt|amp|quot|#39|#x27|#x2F);/g,
    (match) => ENTITY_MAP[match] ?? match,
  );
}

export function wordWrap(text: string, width = 80): string {
  return text
    .split("\n")
    .map((line) => {
      if (line.length <= width) return line;
      const words = line.split(" ");
      const lines: string[] = [];
      let current = "";
      for (const word of words) {
        if (current.length + word.length + 1 > width && current.length > 0) {
          lines.push(current);
          current = word;
        } else {
          current = current ? `${current} ${word}` : word;
        }
      }
      if (current) lines.push(current);
      return lines.join("\n");
    })
    .join("\n");
}

export function cleanHtmlToText(html: string, width = 80): string {
  return wordWrap(decodeEntities(stripHtml(html)), width);
}
