import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TagManager from "./tag-manager";
import { plateTag } from "./map-view/prototype/header-chip";
import es from "@/lang/es.json";

afterEach(() => vi.restoreAllMocks());

describe("truck change header layout", () => {
  it.each([
    { width: 200, visible: false },
    { width: 500, visible: true },
  ])(
    "fits both plates within a $width pixel container",
    ({ width, visible }) => {
      vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
        function (this: HTMLElement) {
          return this.style.visibility === "hidden"
            ? (this.textContent?.length ?? 0) * 8
            : width;
        }
      );
      vi.spyOn(window, "requestAnimationFrame").mockImplementation(
        (callback) => {
          callback(0);
          return 0;
        }
      );

      render(
        <TagManager
          tags={[plateTag(false, "TRUCK1", "TRUCK2", es)]}
          tag_style=""
        />
      );

      if (visible) {
        expect(screen.getByText(/Viaje ahora en TRUCK2/)).toBeInTheDocument();
        expect(screen.queryByText("+1")).not.toBeInTheDocument();
      } else {
        expect(screen.getByText("+1")).toBeInTheDocument();
      }
    }
  );
});
