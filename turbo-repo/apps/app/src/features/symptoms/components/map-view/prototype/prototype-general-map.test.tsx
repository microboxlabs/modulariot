import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import es from "@/lang/es.json";
import PrototypeGeneralMap from "./prototype-general-map";

const nav = vi.hoisted(() => ({
  calls: [] as string[],
  save: { ok: true },
}));

vi.mock("next/navigation", () => {
  const router = {
    push: (url: string) => nav.calls.push(`push ${url}`),
    replace: (url: string) => nav.calls.push(`replace ${url}`),
  };
  return {
    useRouter: () => router,
    useParams: () => ({ lang: "es" }),
    usePathname: () => "/es/symptoms/map-view/-7",
    useSearchParams: () => new URLSearchParams("open=1&menu=ignore_condition"),
  };
});
vi.mock("../../../hooks/use-treatments-general", () => ({
  useTreatmentsGeneral: () => ({
    treatmentData: null,
    loading: false,
    error: null,
  }),
}));
vi.mock("@/features/geographic-view/hooks/use-trip-positions", () => ({
  useTripPositions: () => ({ positions: [], error: null, isLoading: false }),
}));
vi.mock("@/features/common/providers/client-api.provider", () => ({
  useTreatmentsLocation: () => ({ data: null }),
}));
vi.mock("@/features/runtime-config/runtime-config-context", () => ({
  useRuntimeConfig: () => null,
}));
vi.mock("./call-center/call-session", () => ({
  useOptionalCallSession: () => null,
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("../../tag-manager", () => ({ default: () => null }));
vi.mock("@/features/geographic-view/components/map-visualization-trip", () => ({
  default: () => null,
}));
vi.mock("./prototype-side-info", async () => {
  const { useParams, useRouter } = await import("next/navigation");
  return {
    default: function SideInfo({
      isFormOpen,
      setIsFormOpen,
    }: Readonly<{
      isFormOpen: boolean;
      setIsFormOpen: (open: boolean) => void;
    }>) {
      const router = useRouter();
      const { lang } = useParams<{ lang: string }>();
      if (!isFormOpen) return <p>Timeline</p>;
      // Same contract as the treatment forms' save.
      const apply = () => {
        if (!nav.save.ok) return;
        setIsFormOpen(false);
        router.push(`/${lang}/symptoms`);
      };
      return (
        <form aria-label="Treatment form">
          <button type="button" onClick={apply}>
            Apply
          </button>
          <button type="button" onClick={() => setIsFormOpen(false)}>
            Back
          </button>
        </form>
      );
    },
  };
});

function renderCase() {
  render(<PrototypeGeneralMap dict={es as I18nRecord} id="-7" />);
  nav.calls.length = 0;
}

beforeEach(() => {
  nav.calls.length = 0;
  nav.save.ok = true;
});

describe("treatment panel navigation", () => {
  it("lands on the treatments list after a treatment is applied", () => {
    renderCase();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(nav.calls).toEqual([
      "replace /es/symptoms/map-view/-7",
      "push /es/symptoms",
    ]);
  });

  it("keeps the form open when applying fails", () => {
    nav.save.ok = false;
    renderCase();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getByRole("form", { name: "Treatment form" })).toBeVisible();
    expect(nav.calls).toEqual([]);
  });

  it("returns to the timeline when the form is left without applying", () => {
    renderCase();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByText("Timeline")).toBeVisible();
    expect(nav.calls).toEqual(["replace /es/symptoms/map-view/-7"]);
  });
});
