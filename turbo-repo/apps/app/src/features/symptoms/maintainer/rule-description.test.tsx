import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderDescription } from "./rule-description";

const html = (text: string) =>
  renderToStaticMarkup(<>{renderDescription(text)}</>);

describe("renderDescription", () => {
  it("keeps b, i and mark", () => {
    expect(
      html(
        "Se activa <b>en viaje</b> y <i>pesado</i>, sobre <mark>21 km/h</mark>"
      )
    ).toBe(
      'Se activa <b>en viaje</b> y <i>pesado</i>, sobre <mark class="rounded bg-yellow-100 px-0.5 dark:bg-yellow-900/40 dark:text-yellow-100">21 km/h</mark>'
    );
  });

  it("never renders other markup", () => {
    const out = html(
      '<script>alert(1)</script><b onclick="x()">hola</b><img src=x>'
    );
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("onclick");
  });

  it("decodes entities as text", () => {
    expect(html("medida &gt;= 21 &amp; sostenido")).toBe(
      "medida &gt;= 21 &amp; sostenido"
    );
  });
});
