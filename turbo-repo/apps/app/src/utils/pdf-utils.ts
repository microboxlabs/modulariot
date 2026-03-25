import { promises as fs } from "fs";
import path from "path";
import { logger } from "../lib/logger";

/**
 * Utility function to save base64 PDF content to a file
 * @param base64Content - The base64-encoded PDF content
 * @param filename - The filename to save (without extension)
 * @returns The path to the saved PDF file
 */
export async function saveBase64ToPDF(
  base64Content: string,
  filename: string
): Promise<string> {
  try {
    // Ensure the storage directory exists
    const storageDir = path.join(process.cwd(), "public", "storage");
    await fs.mkdir(storageDir, { recursive: true });

    // Create the full file path
    const filePath = path.join(storageDir, `${filename}.pdf`);

    // Convert base64 to buffer and write to file
    const buffer = Buffer.from(base64Content, "base64");
    await fs.writeFile(filePath, new Uint8Array(buffer));

    return `/storage/${filename}.pdf`;
  } catch (error) {
    logger.error(error, "Error saving PDF file:");
    throw new Error("Failed to save PDF file");
  }
}

/**
 * Utility function to read PDF content from a file
 * @param filePath - The path to the PDF file
 * @returns The base64-encoded PDF content
 */
export async function readPDFAsBase64(filePath: string): Promise<string> {
  try {
    const fullPath = path.join(process.cwd(), "public", "storage", filePath);
    const buffer = await fs.readFile(fullPath);
    return buffer.toString("base64");
  } catch (error) {
    logger.error(error, "Error reading PDF file:");
    throw new Error("Failed to read PDF file");
  }
}
