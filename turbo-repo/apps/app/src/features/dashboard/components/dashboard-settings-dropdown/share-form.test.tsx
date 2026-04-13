import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockShowNotification = vi.fn();
const mockOnClose = vi.fn();

let mockSearchParams = new URLSearchParams();
let mockPathname = "/en/home/myDashboard";

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
  usePathname: () => mockPathname,
}));

vi.mock("@/features/notifications/notification", () => ({
  ShowNotification: (...args: unknown[]) => mockShowNotification(...args),
}));

// Mock html2canvas-pro — dynamically imported
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

// Mock jspdf — dynamically imported
const mockPdfSave = vi.fn();
const mockPdfText = vi.fn();
const mockPdfSetFontSize = vi.fn();
const mockPdfSetTextColor = vi.fn();
const mockPdfAddImage = vi.fn();

vi.mock("jspdf", () => {
  class MockJsPDF {
    internal = { pageSize: { getWidth: () => 595, getHeight: () => 842 } };
    setFontSize = mockPdfSetFontSize;
    text = mockPdfText;
    setTextColor = mockPdfSetTextColor;
    addImage = mockPdfAddImage;
    save = mockPdfSave;
  }
  return { jsPDF: MockJsPDF };
});

// Import after mocks
const { ShareForm } = await import("./share-form");

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  mockPathname = "/en/home/myDashboard";

  Object.defineProperty(globalThis.navigator, "clipboard", {
    value: { writeText: vi.fn(() => Promise.resolve()) },
    writable: true,
    configurable: true,
  });

  Object.defineProperty(globalThis, "location", {
    value: { origin: "https://app.example.com" },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  // Remove any leftover grid elements
  document.querySelectorAll(".dashboard-root-grid").forEach((el) => el.remove());
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
      render(<ShareForm dashboardName="Test Dashboard" onClose={mockOnClose} />);
      fireEvent.click(screen.getByText("Copy link"));

      await waitFor(() => {
        expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalledWith(
          "https://app.example.com/en/home/myDashboard?kiosk=true"
        );
      });
    });

    it("preserves existing search params and adds kiosk=true", async () => {
      mockSearchParams = new URLSearchParams("asset_id=42&status=active");

      render(<ShareForm dashboardName="Test Dashboard" onClose={mockOnClose} />);
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
      render(<ShareForm dashboardName="Test Dashboard" onClose={mockOnClose} />);
      fireEvent.click(screen.getByText("Copy link"));

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith({
          type: "success",
          message: "Kiosk link copied to clipboard",
        });
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it("shows error notification when clipboard write fails", async () => {
      (globalThis.navigator.clipboard.writeText as Mock).mockRejectedValueOnce(
        new Error("Clipboard blocked")
      );

      render(<ShareForm dashboardName="Test Dashboard" onClose={mockOnClose} />);
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
    it("shows error when dashboard grid element is not found", async () => {
      // querySelector returns null for .dashboard-root-grid by default (no element in jsdom)
      render(<ShareForm dashboardName="Test Dashboard" onClose={mockOnClose} />);
      fireEvent.click(screen.getByText("Download as image"));

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith({
          type: "error",
          message: "Dashboard content not found",
        });
      });
      // html2canvas should not have been called
      expect(mockHtml2canvas).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // exporting / disabled / loading UI states
  // --------------------------------------------------------------------------

  describe("exporting UI states", () => {
    it("shows 'Capturing...' and disables buttons while exporting image", async () => {
      let resolveCapture: ((v: unknown) => void) | undefined;
      const pendingPromise = new Promise((resolve) => { resolveCapture = resolve; });
      mockHtml2canvas.mockReturnValueOnce(pendingPromise);

      const gridEl = document.createElement("div");
      gridEl.className = "dashboard-root-grid";
      document.body.appendChild(gridEl);

      render(<ShareForm dashboardName="Test Dashboard" onClose={mockOnClose} />);
      fireEvent.click(screen.getByText("Download as image"));

      await waitFor(() => {
        expect(screen.getByText("Capturing...")).toBeInTheDocument();
      });

      // The other export buttons should be disabled
      const pdfButton = screen.getByText("Download as PDF").closest("button")!;
      expect(pdfButton).toBeDisabled();

      // Resolve and wait for state to settle before teardown
      resolveCapture!(mockCanvas);
      await waitFor(() => {
        expect(screen.getByText("Download as image")).toBeInTheDocument();
      });
    });

    it("shows 'Generating...' and disables buttons while exporting PDF", async () => {
      let resolveCapture: ((v: unknown) => void) | undefined;
      const pendingPromise = new Promise((resolve) => { resolveCapture = resolve; });
      mockHtml2canvas.mockReturnValueOnce(pendingPromise);

      const gridEl = document.createElement("div");
      gridEl.className = "dashboard-root-grid";
      document.body.appendChild(gridEl);

      render(<ShareForm dashboardName="Test Dashboard" onClose={mockOnClose} />);
      fireEvent.click(screen.getByText("Download as PDF"));

      await waitFor(() => {
        expect(screen.getByText("Generating...")).toBeInTheDocument();
      });

      const imageButton = screen.getByText("Download as image").closest("button")!;
      expect(imageButton).toBeDisabled();

      // Resolve and wait for state to settle before teardown
      resolveCapture!(mockCanvas);
      await waitFor(() => {
        expect(screen.getByText("Download as PDF")).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Successful image download
  // --------------------------------------------------------------------------

  describe("handleDownloadImage", () => {
    it("captures the dashboard, triggers download, and notifies success", async () => {
      const gridEl = document.createElement("div");
      gridEl.className = "dashboard-root-grid";
      document.body.appendChild(gridEl);

      render(<ShareForm dashboardName="Test Dashboard" onClose={mockOnClose} />);
      fireEvent.click(screen.getByText("Download as image"));

      await waitFor(() => {
        expect(mockHtml2canvas).toHaveBeenCalledWith(gridEl, expect.objectContaining({
          useCORS: true,
          scale: 2,
        }));
        expect(mockToDataURL).toHaveBeenCalledWith("image/png");
        expect(mockShowNotification).toHaveBeenCalledWith({
          type: "success",
          message: "Image downloaded",
        });
        expect(mockOnClose).toHaveBeenCalled();
      });

      document.body.removeChild(gridEl);
    });
  });

  // --------------------------------------------------------------------------
  // Successful PDF download
  // --------------------------------------------------------------------------

  describe("handleDownloadPdf", () => {
    it("captures the dashboard, generates PDF with title, and notifies success", async () => {
      const gridEl = document.createElement("div");
      gridEl.className = "dashboard-root-grid";
      document.body.appendChild(gridEl);

      render(<ShareForm dashboardName="Test Dashboard" onClose={mockOnClose} />);
      fireEvent.click(screen.getByText("Download as PDF"));

      await waitFor(() => {
        expect(mockHtml2canvas).toHaveBeenCalled();
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
        expect(mockOnClose).toHaveBeenCalled();
      });

      document.body.removeChild(gridEl);
    });
  });
});
