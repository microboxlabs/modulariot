import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockShowNotification = vi.fn();
const mockOnClose = vi.fn();

let mockSearchParams = new URLSearchParams();
let mockPathname = "/en/home/myDashboard";

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
  usePathname: () => mockPathname,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useParams: () => ({ lang: "en", slug: "myDashboard" }),
}));

vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: (...args: unknown[]) => mockShowNotification(...args),
}));

vi.mock("@/features/i18n/tr.service", () => ({
  tr: (key: string) => key,
}));

vi.mock("@/features/common/providers/client-api.provider", () => ({
  deleteDashboardConfigClient: vi.fn(),
  useUserGroups: () => ({ data: [], isLoading: false }),
}));

vi.mock("../../context/dashboard-context", () => ({
  useDashboard: () => ({
    dashboardName: "Test Dashboard",
    setDashboardName: vi.fn(),
    filters: [],
    setFilters: vi.fn(),
    exportDashboard: vi.fn(() => "{}"),
    importDashboard: vi.fn(),
    downloadDashboard: vi.fn(),
    dictionary: {},
    siteId: "test-site",
    refreshInterval: 0,
    setRefreshInterval: vi.fn(),
    order: undefined,
    setOrder: vi.fn(),
    allowedGroups: [],
    setAllowedGroups: vi.fn(),
    plannerDefinitions: [],
    addPlannerRequest: vi.fn(),
    updatePlannerRequest: vi.fn(),
    removePlannerRequest: vi.fn(),
  }),
}));

vi.mock("../planner-manager/planner-manager", () => ({
  PlannerManagerForm: () => <div data-testid="planner-form" />,
}));

// Mock html2canvas-pro and jspdf — they are dynamically imported
const mockToDataURL = vi.fn(() => "data:image/png;base64,fakedata");
const mockCanvas = {
  toDataURL: mockToDataURL,
  width: 1200,
  height: 600,
};
const mockHtml2canvas = vi.fn(() => Promise.resolve(mockCanvas));

vi.mock("html2canvas-pro", () => ({
  default: (...args: unknown[]) => mockHtml2canvas(...args),
}));

const mockPdfSave = vi.fn();
const mockPdfText = vi.fn();
const mockPdfSetFontSize = vi.fn();
const mockPdfSetTextColor = vi.fn();
const mockPdfAddImage = vi.fn();
const mockJsPDF = vi.fn(() => ({
  internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } },
  setFontSize: mockPdfSetFontSize,
  text: mockPdfText,
  setTextColor: mockPdfSetTextColor,
  addImage: mockPdfAddImage,
  save: mockPdfSave,
}));

vi.mock("jspdf", () => ({
  jsPDF: (...args: unknown[]) => mockJsPDF(...args),
}));

// Dynamically import after all mocks are set up
const { default: DashboardSettingsDropdown } = await import(
  "./dashboard-settings-dropdown"
);

// ── Helpers ────────────────────────────────────────────────────────────────

/** Open the settings panel and navigate to the Share section */
async function openShareSection() {
  render(<DashboardSettingsDropdown />);
  // Click gear icon to open
  fireEvent.click(screen.getByTitle("Dashboard settings"));
  // Click the Share Dashboard section
  const shareButton = screen.getByText("Share Dashboard");
  fireEvent.click(shareButton);
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  mockPathname = "/en/home/myDashboard";

  // navigator.clipboard mock
  Object.defineProperty(globalThis.navigator, "clipboard", {
    value: { writeText: vi.fn(() => Promise.resolve()) },
    writable: true,
    configurable: true,
  });

  // globalThis.location mock
  Object.defineProperty(globalThis, "location", {
    value: { origin: "https://app.example.com" },
    writable: true,
    configurable: true,
  });
});

// ============================================================================
// Tests
// ============================================================================

describe("ShareForm", () => {
  // --------------------------------------------------------------------------
  // handleCopyKioskLink
  // --------------------------------------------------------------------------

  describe("handleCopyKioskLink", () => {
    it("copies a kiosk URL with kiosk=true search param", async () => {
      await openShareSection();

      fireEvent.click(screen.getByText("Copy link"));

      await waitFor(() => {
        expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalledWith(
          "https://app.example.com/en/home/myDashboard?kiosk=true"
        );
      });
    });

    it("preserves existing search params and adds kiosk=true", async () => {
      mockSearchParams = new URLSearchParams("asset_id=42&status=active");

      await openShareSection();
      fireEvent.click(screen.getByText("Copy link"));

      await waitFor(() => {
        const calledUrl = (globalThis.navigator.clipboard.writeText as Mock).mock.calls[0][0] as string;
        const params = new URL(calledUrl).searchParams;
        expect(params.get("kiosk")).toBe("true");
        expect(params.get("asset_id")).toBe("42");
        expect(params.get("status")).toBe("active");
      });
    });

    it("shows success notification and calls onClose on successful copy", async () => {
      await openShareSection();
      fireEvent.click(screen.getByText("Copy link"));

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith({
          type: "success",
          message: "Kiosk link copied to clipboard",
        });
      });
    });

    it("shows error notification when clipboard write fails", async () => {
      (globalThis.navigator.clipboard.writeText as Mock).mockRejectedValueOnce(
        new Error("Clipboard blocked")
      );

      await openShareSection();
      fireEvent.click(screen.getByText("Copy link"));

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith({
          type: "error",
          message: "Failed to copy link",
        });
      });
    });
  });

  // --------------------------------------------------------------------------
  // captureElement error branch
  // --------------------------------------------------------------------------

  describe("captureElement", () => {
    it("shows 'Dashboard content not found' when the grid element is missing", async () => {
      // Ensure querySelector returns null for DASHBOARD_CAPTURE_SELECTOR
      const originalQuerySelector = document.querySelector.bind(document);
      vi.spyOn(document, "querySelector").mockImplementation((sel: string) => {
        if (sel === ".dashboard-root-grid") return null;
        return originalQuerySelector(sel);
      });

      await openShareSection();
      fireEvent.click(screen.getByText("Download as image"));

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith({
          type: "error",
          message: "Dashboard content not found",
        });
      });

      vi.restoreAllMocks();
    });
  });

  // --------------------------------------------------------------------------
  // exporting / disabled / loading UI states
  // --------------------------------------------------------------------------

  describe("exporting UI states", () => {
    it("disables all export buttons while exporting an image", async () => {
      // Make html2canvas hang so we can observe the loading state
      let resolveCapture!: (v: unknown) => void;
      mockHtml2canvas.mockImplementationOnce(
        () => new Promise((resolve) => { resolveCapture = resolve; })
      );

      // Need a real element for querySelector
      const gridEl = document.createElement("div");
      gridEl.className = "dashboard-root-grid";
      document.body.appendChild(gridEl);

      await openShareSection();
      fireEvent.click(screen.getByText("Download as image"));

      // Buttons should show loading text and be disabled
      await waitFor(() => {
        expect(screen.getByText("Capturing...")).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Download as") || b.textContent?.includes("Capturing")
      );
      for (const btn of buttons) {
        expect(btn).toBeDisabled();
      }

      // Resolve to end the loading state
      resolveCapture(mockCanvas);
      document.body.removeChild(gridEl);
    });

    it("shows 'Generating...' while exporting PDF", async () => {
      let resolveCapture!: (v: unknown) => void;
      mockHtml2canvas.mockImplementationOnce(
        () => new Promise((resolve) => { resolveCapture = resolve; })
      );

      const gridEl = document.createElement("div");
      gridEl.className = "dashboard-root-grid";
      document.body.appendChild(gridEl);

      await openShareSection();
      fireEvent.click(screen.getByText("Download as PDF"));

      await waitFor(() => {
        expect(screen.getByText("Generating...")).toBeInTheDocument();
      });

      resolveCapture(mockCanvas);
      document.body.removeChild(gridEl);
    });
  });

  // --------------------------------------------------------------------------
  // Successful image download
  // --------------------------------------------------------------------------

  describe("handleDownloadImage", () => {
    it("creates an anchor element, triggers download, and notifies success", async () => {
      const gridEl = document.createElement("div");
      gridEl.className = "dashboard-root-grid";
      document.body.appendChild(gridEl);

      const clickSpy = vi.fn();
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        if (tag === "a") {
          const anchor = { click: clickSpy, download: "", href: "" } as unknown as HTMLElement;
          return anchor;
        }
        return document.createElement.call(document, tag);
      });

      await openShareSection();
      fireEvent.click(screen.getByText("Download as image"));

      await waitFor(() => {
        expect(mockHtml2canvas).toHaveBeenCalled();
        expect(mockShowNotification).toHaveBeenCalledWith({
          type: "success",
          message: "Image downloaded",
        });
      });

      vi.restoreAllMocks();
      document.body.removeChild(gridEl);
    });
  });

  // --------------------------------------------------------------------------
  // Successful PDF download
  // --------------------------------------------------------------------------

  describe("handleDownloadPdf", () => {
    it("generates a PDF with title, saves it, and notifies success", async () => {
      const gridEl = document.createElement("div");
      gridEl.className = "dashboard-root-grid";
      document.body.appendChild(gridEl);

      await openShareSection();
      fireEvent.click(screen.getByText("Download as PDF"));

      await waitFor(() => {
        expect(mockHtml2canvas).toHaveBeenCalled();
        expect(mockJsPDF).toHaveBeenCalled();
        expect(mockPdfSetFontSize).toHaveBeenCalledWith(14);
        expect(mockPdfText).toHaveBeenCalledWith(
          "Test Dashboard",
          expect.any(Number),
          expect.any(Number)
        );
        expect(mockPdfAddImage).toHaveBeenCalled();
        expect(mockPdfSave).toHaveBeenCalledWith(
          expect.stringMatching(/^Test_Dashboard_\d{4}-\d{2}-\d{2}\.pdf$/)
        );
        expect(mockShowNotification).toHaveBeenCalledWith({
          type: "success",
          message: "PDF downloaded",
        });
      });

      document.body.removeChild(gridEl);
    });
  });
});
