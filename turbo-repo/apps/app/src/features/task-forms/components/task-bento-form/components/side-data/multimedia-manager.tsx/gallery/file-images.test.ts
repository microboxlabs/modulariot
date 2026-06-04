import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  extractImageUrlFromDrop,
  isValidImageUrl,
  fetchImageAsFile,
  ALLOWED_FILE_TYPES,
  ALLOWED_IMAGE_EXTENSIONS,
} from "./file-images";

// Helper to create a mock DataTransfer object
function createMockDataTransfer(data: Record<string, string>): DataTransfer {
  return {
    getData: (type: string) => data[type] || "",
    setData: vi.fn(),
    clearData: vi.fn(),
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: Object.keys(data),
    dropEffect: "none",
    effectAllowed: "none",
  } as unknown as DataTransfer;
}

describe("extractImageUrlFromDrop", () => {
  describe("text/uri-list extraction", () => {
    it("should extract first URL from text/uri-list", () => {
      const dataTransfer = createMockDataTransfer({
        "text/uri-list": "https://example.com/image.jpg",
      });
      const result = extractImageUrlFromDrop(dataTransfer);
      expect(result).toBe("https://example.com/image.jpg");
    });

    it("should extract first URL from multiple URLs in text/uri-list", () => {
      const dataTransfer = createMockDataTransfer({
        "text/uri-list":
          "https://example.com/image1.jpg\nhttps://example.com/image2.png\nhttps://example.com/image3.jpeg",
      });
      const result = extractImageUrlFromDrop(dataTransfer);
      expect(result).toBe("https://example.com/image1.jpg");
    });

    it("should skip commented lines (starting with #) in text/uri-list", () => {
      const dataTransfer = createMockDataTransfer({
        "text/uri-list":
          "# This is a comment\nhttps://example.com/actual-image.jpg\n# Another comment",
      });
      const result = extractImageUrlFromDrop(dataTransfer);
      expect(result).toBe("https://example.com/actual-image.jpg");
    });

    it("should handle only commented lines and return null", () => {
      const dataTransfer = createMockDataTransfer({
        "text/uri-list": "# Comment 1\n# Comment 2\n# Comment 3",
      });
      const result = extractImageUrlFromDrop(dataTransfer);
      expect(result).toBeNull();
    });

    it("should skip empty lines in text/uri-list", () => {
      const dataTransfer = createMockDataTransfer({
        "text/uri-list":
          "\n\nhttps://example.com/image.jpg\n\nhttps://example.com/image2.png",
      });
      const result = extractImageUrlFromDrop(dataTransfer);
      expect(result).toBe("https://example.com/image.jpg");
    });
  });

  describe("text/plain extraction", () => {
    it("should extract http URL from text/plain when no text/uri-list", () => {
      const dataTransfer = createMockDataTransfer({
        "text/plain": "http://example.com/image.jpg",
      });
      const result = extractImageUrlFromDrop(dataTransfer);
      expect(result).toBe("http://example.com/image.jpg");
    });

    it("should extract https URL from text/plain when no text/uri-list", () => {
      const dataTransfer = createMockDataTransfer({
        "text/plain": "https://example.com/image.png",
      });
      const result = extractImageUrlFromDrop(dataTransfer);
      expect(result).toBe("https://example.com/image.png");
    });

    it("should return null for text/plain that does not start with http/https", () => {
      const dataTransfer = createMockDataTransfer({
        "text/plain": "just some random text",
      });
      const result = extractImageUrlFromDrop(dataTransfer);
      expect(result).toBeNull();
    });

    it("should return null for ftp:// URLs in text/plain", () => {
      const dataTransfer = createMockDataTransfer({
        "text/plain": "ftp://example.com/image.jpg",
      });
      const result = extractImageUrlFromDrop(dataTransfer);
      expect(result).toBeNull();
    });

    it("should prioritize text/uri-list over text/plain", () => {
      const dataTransfer = createMockDataTransfer({
        "text/uri-list": "https://priority.com/uri-list.jpg",
        "text/plain": "https://fallback.com/plain.jpg",
      });
      const result = extractImageUrlFromDrop(dataTransfer);
      expect(result).toBe("https://priority.com/uri-list.jpg");
    });
  });

  describe("text/html extraction (img src)", () => {
    it("should extract img src from text/html with double quotes", () => {
      const dataTransfer = createMockDataTransfer({
        "text/html":
          '<img src="https://example.com/image.jpg" alt="test image">',
      });
      const result = extractImageUrlFromDrop(dataTransfer);
      expect(result).toBe("https://example.com/image.jpg");
    });

    it("should extract img src from text/html with single quotes", () => {
      const dataTransfer = createMockDataTransfer({
        "text/html":
          "<img src='https://example.com/image.png' alt='test image'>",
      });
      const result = extractImageUrlFromDrop(dataTransfer);
      expect(result).toBe("https://example.com/image.png");
    });

    it("should extract img src from complex HTML", () => {
      const dataTransfer = createMockDataTransfer({
        "text/html":
          '<div class="wrapper"><img class="image" src="https://cdn.example.com/photos/image.jpeg" width="100"></div>',
      });
      const result = extractImageUrlFromDrop(dataTransfer);
      expect(result).toBe("https://cdn.example.com/photos/image.jpeg");
    });

    it("should return null when HTML has no img tag", () => {
      const dataTransfer = createMockDataTransfer({
        "text/html": '<div><a href="https://example.com">Link</a></div>',
      });
      const result = extractImageUrlFromDrop(dataTransfer);
      expect(result).toBeNull();
    });

    it("should prioritize text/uri-list over text/html", () => {
      const dataTransfer = createMockDataTransfer({
        "text/uri-list": "https://priority.com/uri-list.jpg",
        "text/html": '<img src="https://fallback.com/html.jpg">',
      });
      const result = extractImageUrlFromDrop(dataTransfer);
      expect(result).toBe("https://priority.com/uri-list.jpg");
    });
  });

  describe("no valid data", () => {
    it("should return null when all data types are empty", () => {
      const dataTransfer = createMockDataTransfer({});
      const result = extractImageUrlFromDrop(dataTransfer);
      expect(result).toBeNull();
    });

    it("should return null when all data types have empty strings", () => {
      const dataTransfer = createMockDataTransfer({
        "text/uri-list": "",
        "text/plain": "",
        "text/html": "",
      });
      const result = extractImageUrlFromDrop(dataTransfer);
      expect(result).toBeNull();
    });
  });
});

describe("isValidImageUrl", () => {
  describe("valid URLs (syntactic validation only)", () => {
    it("should return true for https URL with .jpg extension", () => {
      expect(isValidImageUrl("https://example.com/photo.jpg")).toBe(true);
    });

    it("should return true for https URL with .png extension", () => {
      expect(isValidImageUrl("https://example.com/photo.png")).toBe(true);
    });

    it("should return true for https URL without extension", () => {
      expect(isValidImageUrl("https://example.com/image")).toBe(true);
    });

    it("should return true for http URL", () => {
      expect(isValidImageUrl("http://example.com/photo.jpg")).toBe(true);
    });

    it("should return true for URL with query parameters", () => {
      expect(isValidImageUrl("https://example.com/serve?id=123")).toBe(true);
    });

    it("should return true for URL with hash", () => {
      expect(isValidImageUrl("https://example.com/photo#section")).toBe(true);
    });

    it("should return true for CDN URLs without file extensions", () => {
      expect(isValidImageUrl("https://cdn.example.com/serve/12345")).toBe(true);
    });

    it("should return true for URLs with any file extension (MIME validated by fetch)", () => {
      // These are syntactically valid URLs - actual content type is validated by fetchImageAsFile
      expect(isValidImageUrl("https://example.com/animation.gif")).toBe(true);
      expect(isValidImageUrl("https://example.com/image.webp")).toBe(true);
      expect(isValidImageUrl("https://example.com/document.pdf")).toBe(true);
    });
  });

  describe("invalid URLs", () => {
    it("should return false for empty string", () => {
      expect(isValidImageUrl("")).toBe(false);
    });

    it("should return false for null/undefined coerced to string", () => {
      expect(isValidImageUrl(null as unknown as string)).toBe(false);
      expect(isValidImageUrl(undefined as unknown as string)).toBe(false);
    });

    it("should return false for plain text that is not a URL", () => {
      expect(isValidImageUrl("just some text")).toBe(false);
    });

    it("should return false for relative path", () => {
      expect(isValidImageUrl("/images/photo.jpg")).toBe(false);
    });

    it("should return false for malformed URL", () => {
      expect(isValidImageUrl("ht tp://example.com/photo.jpg")).toBe(false);
    });
  });

  describe("ALLOWED_IMAGE_EXTENSIONS constant", () => {
    it("should contain exactly jpg, jpeg, png", () => {
      expect(ALLOWED_IMAGE_EXTENSIONS).toEqual(new Set(["jpg", "jpeg", "png"]));
    });
  });
});

describe("fetchImageAsFile", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("successful fetch returning image blob", () => {
    it("should return a File with correct name when URL has filename", async () => {
      const mockBlob = new Blob(["fake image data"], { type: "image/jpeg" });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await fetchImageAsFile(
        "https://example.com/photos/my-photo.jpg"
      );

      expect(result).toBeInstanceOf(File);
      expect(result?.name).toBe("my-photo.jpg");
      expect(result?.type).toBe("image/jpeg");
    });

    it("should synthesize filename for extensionless URL using blob type", async () => {
      const mockBlob = new Blob(["fake image data"], { type: "image/png" });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await fetchImageAsFile(
        "https://example.com/image-server/12345"
      );

      expect(result).toBeInstanceOf(File);
      expect(result?.name).toMatch(/^downloaded-image-\d+\.png$/);
      expect(result?.type).toBe("image/png");
    });

    it("should handle URL with path but no extension", async () => {
      const mockBlob = new Blob(["fake image data"], { type: "image/jpeg" });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await fetchImageAsFile(
        "https://cdn.example.com/serve/image"
      );

      expect(result).toBeInstanceOf(File);
      expect(result?.name).toMatch(/^downloaded-image-\d+\.jpeg$/);
    });
  });

  describe("non-image blob responses", () => {
    it("should return null for text/plain blob", async () => {
      const mockBlob = new Blob(["text content"], { type: "text/plain" });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await fetchImageAsFile(
        "https://example.com/fake-image.jpg"
      );

      expect(result).toBeNull();
    });

    it("should return null for application/json blob", async () => {
      const mockBlob = new Blob(['{"data": "json"}'], {
        type: "application/json",
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await fetchImageAsFile(
        "https://example.com/api/image.jpg"
      );

      expect(result).toBeNull();
    });

    it("should return null for application/pdf blob", async () => {
      const mockBlob = new Blob(["pdf content"], { type: "application/pdf" });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await fetchImageAsFile("https://example.com/document.pdf");

      expect(result).toBeNull();
    });
  });

  describe("disallowed MIME types (from ALLOWED_FILE_TYPES)", () => {
    it("should return null for image/gif (not in ALLOWED_FILE_TYPES)", async () => {
      const mockBlob = new Blob(["gif data"], { type: "image/gif" });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await fetchImageAsFile(
        "https://example.com/animation.gif"
      );

      expect(result).toBeNull();
    });

    it("should return null for image/webp (not in ALLOWED_FILE_TYPES)", async () => {
      const mockBlob = new Blob(["webp data"], { type: "image/webp" });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await fetchImageAsFile("https://example.com/photo.webp");

      expect(result).toBeNull();
    });

    it("should return null for image/svg+xml (not in ALLOWED_FILE_TYPES)", async () => {
      const mockBlob = new Blob(["<svg></svg>"], { type: "image/svg+xml" });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await fetchImageAsFile("https://example.com/icon.svg");

      expect(result).toBeNull();
    });

    it("should accept image/jpeg (in ALLOWED_FILE_TYPES)", async () => {
      const mockBlob = new Blob(["jpeg data"], { type: "image/jpeg" });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await fetchImageAsFile("https://example.com/photo.jpeg");

      expect(result).toBeInstanceOf(File);
    });

    it("should accept image/png (in ALLOWED_FILE_TYPES)", async () => {
      const mockBlob = new Blob(["png data"], { type: "image/png" });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await fetchImageAsFile("https://example.com/photo.png");

      expect(result).toBeInstanceOf(File);
    });
  });

  describe("fetch failures and CORS errors", () => {
    it("should return null when fetch throws an error (CORS)", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("CORS error"));

      const result = await fetchImageAsFile(
        "https://blocked-domain.com/image.jpg"
      );

      expect(result).toBeNull();
    });

    it("should return null when fetch throws network error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await fetchImageAsFile(
        "https://unreachable.com/image.jpg"
      );

      expect(result).toBeNull();
    });

    it("should return null when response is not ok (404)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await fetchImageAsFile(
        "https://example.com/not-found.jpg"
      );

      expect(result).toBeNull();
    });

    it("should return null when response is not ok (500)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await fetchImageAsFile(
        "https://example.com/server-error.jpg"
      );

      expect(result).toBeNull();
    });

    it("should return null when response is not ok (403 Forbidden)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      });

      const result = await fetchImageAsFile(
        "https://example.com/forbidden.jpg"
      );

      expect(result).toBeNull();
    });

    it("should return null when fetch is aborted (AbortError)", async () => {
      const abortError = new DOMException("Aborted", "AbortError");
      global.fetch = vi.fn().mockRejectedValue(abortError);

      const result = await fetchImageAsFile(
        "https://slow-server.com/image.jpg"
      );

      expect(result).toBeNull();
    });

    it("should pass AbortController signal to fetch", async () => {
      const mockBlob = new Blob(["data"], { type: "image/jpeg" });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      await fetchImageAsFile("https://example.com/photo.jpg");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/photo.jpg",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });

  describe("proper File creation", () => {
    it("should create File with blob data", async () => {
      const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
      const mockBlob = new Blob([imageData], { type: "image/png" });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await fetchImageAsFile("https://example.com/image.png");

      expect(result).toBeInstanceOf(File);
      expect(result?.size).toBe(4);
    });

    it("should preserve original filename from URL path", async () => {
      const mockBlob = new Blob(["data"], { type: "image/jpeg" });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await fetchImageAsFile(
        "https://example.com/uploads/my-vacation-photo.jpg"
      );

      expect(result?.name).toBe("my-vacation-photo.jpg");
    });
  });

  describe("ALLOWED_FILE_TYPES constant", () => {
    it("should contain exactly the expected MIME types", () => {
      expect(ALLOWED_FILE_TYPES).toEqual(
        new Set(["image/jpeg", "image/jpg", "image/png", "application/pdf"])
      );
    });
  });
});
