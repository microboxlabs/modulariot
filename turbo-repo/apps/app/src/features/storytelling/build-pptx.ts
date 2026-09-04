import "server-only";
import pptxgen from "pptxgenjs";
import type { DeckContent, DeckSlide } from "./storytelling.types";

const INK = "111827"; // gray-900
const MUTED = "9CA3AF"; // gray-400
const BODY = "374151"; // gray-700
const HEADER_FILL = "F3F4F6"; // gray-100
const BORDER = "E5E7EB"; // gray-200

function addSlide(pres: pptxgen, slide: DeckSlide): void {
  const s = pres.addSlide();

  switch (slide.type) {
    case "title":
      s.background = { color: INK };
      s.addText(slide.title, {
        x: 0.5, y: 2.0, w: 9, h: 1.2,
        fontSize: 40, bold: true, color: "FFFFFF", fontFace: "Arial",
      });
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 0.5, y: 3.1, w: 9, h: 0.6,
          fontSize: 16, color: MUTED, fontFace: "Arial",
        });
      }
      break;

    case "bullets":
      s.addText(slide.title, {
        x: 0.5, y: 0.4, w: 9, h: 0.7, fontSize: 28, bold: true, color: INK,
      });
      s.addText(
        slide.items.map((text) => ({ text, options: { bullet: true, breakLine: true } })),
        { x: 0.7, y: 1.3, w: 8.5, h: 3, fontSize: 20, color: BODY }
      );
      break;

    case "table":
      s.addText(slide.title, {
        x: 0.5, y: 0.4, w: 9, h: 0.7, fontSize: 28, bold: true, color: INK,
      });
      s.addTable(
        [
          slide.headers.map((text) => ({
            text,
            options: { bold: true, fill: { color: HEADER_FILL } },
          })),
          ...slide.rows.map((row) => row.map((cell) => ({ text: cell }))),
        ],
        {
          x: 0.5, y: 1.3, w: 9, fontSize: 14, color: BODY,
          border: { type: "solid", color: BORDER, pt: 1 },
        }
      );
      break;
  }
}

/** Builds a real .pptx from structured slide content — the same DeckContent
 * the in-app slide viewer (previewers/ppt/ppt-previewer.tsx) renders, so the
 * download always matches what was previewed. Server-only: pptxgenjs's
 * Node output path (outputType: "nodebuffer") needs the Node APIs it wraps. */
export async function buildPptx(deck: DeckContent): Promise<Buffer> {
  const pres = new pptxgen();
  pres.author = "MIOT Storytelling";
  for (const slide of deck.slides) addSlide(pres, slide);
  const data = await pres.write({ outputType: "nodebuffer" });
  return data as Buffer;
}
