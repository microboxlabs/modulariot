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
const mockToBlob = vi.fn((cb: (b: Blob | null) => void) => {
  cb(new Blob(["fake-png-bytes"], { type: "image/png" }));
});
const mockCanvas = {
  toDataURL: mockToDataURL,
  toBlob: mockToBlob,
  width: 1200,
  height: 600,
};
type MockCanvas = typeof mockCanvas;
const mockHtml2canvas = vi.fn((_el: HTMLElement, _opts?: Record<string, unknown>): Promise<MockCanvas> => Promise.resolve(mockCanvas));

vi.mock("html2canvas-pro", () => ({
  default: (...args: [HTMLElement, Record<string, unknown>]) => mockHtml2canvas(...args),
}));

// Mock jspdf — dynamically imported
const mockPdfSave = vi.fn();
const mockPdfText = vi.fn();
const mockPdfSetFontSize = vi.fn();
const mockPdfSetTextColor = vi.fn();
const mockPdfAddImage = vi.fn();
const mockPdfOutput = vi.fn(() => new Blob(["fake-pdf-bytes"], { type: "application/pdf" }));

vi.mock("jspdf", () => {
  class MockJsPDF {
    internal = { pageSize: { getWidth: () => 595, getHeight: () => 842 } };
    setFontSize = mockPdfSetFontSize;
    text = mockPdfText;
    setTextColor = mockPdfSetTextColor;
    addImage = mockPdfAddImage;
    save = mockPdfSave;
    output = mockPdfOutput;
  }
  return { jsPDF: MockJsPDF };
});

// Web Share API mocks — installed fresh in each beforeEach so share buttons can render.
const mockShare = vi.fn((_data: ShareData) => Promise.resolve());
const mockCanShare = vi.fn((_data: ShareData) => true);

// Import after mocks
const { ShareForm, sanitizeBaseName } = await import("./share-form");

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  mockPathname = "/en/home/myDashboard";
  mockShare.mockImplementation(() => Promise.resolve());
  mockCanShare.mockImplementation(() => true);

  Object.defineProperty(globalThis.navigator, "clipboard", {
    value: { writeText: vi.fn(() => Promise.resolve()) },
    writable: true,
    configurable: true,
  });

  Object.defineProperty(globalThis.navigator, "share", {
    value: mockShare,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(globalThis.navigator, "canShare", {
    value: mockCanShare,
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
      let resolveCapture: ((v: MockCanvas) => void) | undefined;
      const pendingPromise = new Promise<MockCanvas>((resolve) => { resolveCapture = resolve; });
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
      let resolveCapture: ((v: MockCanvas) => void) | undefined;
      const pendingPromise = new Promise<MockCanvas>((resolve) => { resolveCapture = resolve; });
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

  // --------------------------------------------------------------------------
  // Share via OS (Web Share API)
  // --------------------------------------------------------------------------

  describe("Share via OS", () => {
    it("hides share buttons when navigator.canShare is undefined", async () => {
      Object.defineProperty(globalThis.navigator, "canShare", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      render(<ShareForm dashboardName="Test Dashboard" onClose={mockOnClose} />);

      // Wait a tick for the feature-detect effect to run; then assert absence.
      await waitFor(() => {
        expect(screen.getByText("Copy link")).toBeInTheDocument();
      });
      expect(screen.queryByText("Share image...")).not.toBeInTheDocument();
      expect(screen.queryByText("Share PDF...")).not.toBeInTheDocument();
    });

    it("hides the PDF share button when canShare rejects a PDF file", async () => {
      mockCanShare.mockImplementation((data: ShareData) => {
        const file = data.files?.[0];
        return file?.type !== "application/pdf";
      });

      render(<ShareForm dashboardName="Test Dashboard" onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText("Share image...")).toBeInTheDocument();
      });
      expect(screen.queryByText("Share PDF...")).not.toBeInTheDocument();
    });

    it("renders both share buttons when canShare returns true for both types", async () => {
      render(<ShareForm dashboardName="Test Dashboard" onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText("Share image...")).toBeInTheDocument();
        expect(screen.getByText("Share PDF...")).toBeInTheDocument();
      });
    });

    it("shares a PNG file via navigator.share with the sanitized filename", async () => {
      const gridEl = document.createElement("div");
      gridEl.className = "dashboard-root-grid";
      document.body.appendChild(gridEl);

      render(<ShareForm dashboardName="Fleet Status / Q2 2025" onClose={mockOnClose} />);
      await waitFor(() => screen.getByText("Share image..."));
      fireEvent.click(screen.getByText("Share image..."));

      await waitFor(() => {
        expect(mockShare).toHaveBeenCalledTimes(1);
      });

      const shareArg = mockShare.mock.calls[0][0] as ShareData & { files: File[] };
      expect(shareArg.files).toHaveLength(1);
      const file = shareArg.files[0];
      expect(file).toBeInstanceOf(File);
      expect(file.type).toBe("image/png");
      expect(file.name).toMatch(/^Fleet_Status_Q2_2025_\d{4}-\d{2}-\d{2}\.png$/);
      expect(shareArg.title).toBe("Fleet Status / Q2 2025");

      expect(mockShowNotification).toHaveBeenCalledWith({
        type: "success",
        message: "Shared",
      });
      expect(mockOnClose).toHaveBeenCalled();

      document.body.removeChild(gridEl);
    });

    it("shares a PDF file via navigator.share with the sanitized filename", async () => {
      const gridEl = document.createElement("div");
      gridEl.className = "dashboard-root-grid";
      document.body.appendChild(gridEl);

      render(<ShareForm dashboardName="Fleet Status / Q2 2025" onClose={mockOnClose} />);
      await waitFor(() => screen.getByText("Share PDF..."));
      fireEvent.click(screen.getByText("Share PDF..."));

      await waitFor(() => {
        expect(mockShare).toHaveBeenCalledTimes(1);
      });

      expect(mockPdfOutput).toHaveBeenCalledWith("blob");
      const shareArg = mockShare.mock.calls[0][0] as ShareData & { files: File[] };
      expect(shareArg.files).toHaveLength(1);
      const file = shareArg.files[0];
      expect(file).toBeInstanceOf(File);
      expect(file.type).toBe("application/pdf");
      expect(file.name).toMatch(/^Fleet_Status_Q2_2025_\d{4}-\d{2}-\d{2}\.pdf$/);

      document.body.removeChild(gridEl);
    });

    it("does not show an error toast when the user cancels the share sheet (AbortError)", async () => {
      const gridEl = document.createElement("div");
      gridEl.className = "dashboard-root-grid";
      document.body.appendChild(gridEl);

      const abortErr = new Error("User cancelled");
      abortErr.name = "AbortError";
      mockShare.mockRejectedValueOnce(abortErr);

      render(<ShareForm dashboardName="Test Dashboard" onClose={mockOnClose} />);
      await waitFor(() => screen.getByText("Share image..."));
      fireEvent.click(screen.getByText("Share image..."));

      await waitFor(() => {
        expect(mockShare).toHaveBeenCalled();
      });

      expect(mockShowNotification).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" }),
      );
      expect(mockOnClose).not.toHaveBeenCalled();

      document.body.removeChild(gridEl);
    });

    it("shows an error toast when navigator.share rejects with a non-abort error", async () => {
      const gridEl = document.createElement("div");
      gridEl.className = "dashboard-root-grid";
      document.body.appendChild(gridEl);

      mockShare.mockRejectedValueOnce(new Error("network borked"));

      render(<ShareForm dashboardName="Test Dashboard" onClose={mockOnClose} />);
      await waitFor(() => screen.getByText("Share image..."));
      fireEvent.click(screen.getByText("Share image..."));

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith({
          type: "error",
          message: "Failed to share dashboard",
        });
      });

      document.body.removeChild(gridEl);
    });

    it("disables all action buttons while a share is in flight", async () => {
      const gridEl = document.createElement("div");
      gridEl.className = "dashboard-root-grid";
      document.body.appendChild(gridEl);

      let resolveShare: (() => void) | undefined;
      mockShare.mockImplementationOnce(
        () => new Promise<void>((r) => { resolveShare = r; }),
      );

      render(<ShareForm dashboardName="Test Dashboard" onClose={mockOnClose} />);
      await waitFor(() => screen.getByText("Share image..."));
      fireEvent.click(screen.getByText("Share image..."));

      await waitFor(() => {
        expect(screen.getByText("Preparing...")).toBeInTheDocument();
      });

      expect(screen.getByText("Copy link").closest("button")!).toBeDisabled();
      expect(screen.getByText("Share PDF...").closest("button")!).toBeDisabled();
      expect(screen.getByText("Download as image").closest("button")!).toBeDisabled();
      expect(screen.getByText("Download as PDF").closest("button")!).toBeDisabled();

      resolveShare!();
      await waitFor(() => {
        expect(screen.getByText("Share image...")).toBeInTheDocument();
      });

      document.body.removeChild(gridEl);
    });
  });
});

// ============================================================================
// sanitizeBaseName
// ============================================================================

describe("sanitizeBaseName", () => {
  it("replaces whitespace with underscores", () => {
    expect(sanitizeBaseName("My Dashboard")).toBe("My_Dashboard");
  });

  it("strips filesystem-unsafe characters", () => {
    expect(sanitizeBaseName('a/b\\c:d*e?f"g<h>i|j')).toBe("abcdefghij");
  });

  it("strips control characters", () => {
    expect(sanitizeBaseName("abc\x00\x1fdef")).toBe("abcdef");
  });

  it("collapses consecutive underscores", () => {
    expect(sanitizeBaseName("a___b")).toBe("a_b");
  });

  it("collapses whitespace then underscores together", () => {
    expect(sanitizeBaseName("a  _  b")).toBe("a_b");
  });

  it("trims leading dots and underscores", () => {
    expect(sanitizeBaseName("..._name")).toBe("name");
  });

  it("trims trailing dots and underscores", () => {
    expect(sanitizeBaseName("name_..")).toBe("name");
  });

  it("returns 'dashboard' for empty input after sanitization", () => {
    expect(sanitizeBaseName("")).toBe("dashboard");
    expect(sanitizeBaseName("???")).toBe("dashboard");
    expect(sanitizeBaseName("...")).toBe("dashboard");
  });

  it("handles a realistic dashboard name", () => {
    expect(sanitizeBaseName("Fleet Status / Q2 2025")).toBe("Fleet_Status_Q2_2025");
  });
});
