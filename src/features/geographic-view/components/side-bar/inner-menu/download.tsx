import { Button, Label } from "flowbite-react";
import { FaCamera } from "react-icons/fa6";
/* import { FaRegFile } from "react-icons/fa";
import { RiFileChartLine } from "react-icons/ri"; */
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useState } from "react";
import { captureAndDownloadMap } from "../../../utils/map-screenshot";

export default function Download({ dict }: { dict: I18nRecord }) {
  const [status, setStatus] = useState<string>("");
  const [isCapturing, setIsCapturing] = useState(false);

  // Function to take a screenshot of the map
  const handleScreenshot = async () => {
    setIsCapturing(true);
    setStatus("Preparing screenshot...");

    try {
      // Use the native map screenshot approach with combined canvases
      const success = await captureAndDownloadMap({
        filename: `map-screenshot-${new Date().toISOString().slice(0, 10)}.png`,
        fileType: "image/png",
        debugMode: true, // Keep debug mode enabled temporarily
        onStatusChange: (newStatus) => {
          setStatus(newStatus);
        },
      });

      if (!success) {
        setStatus("Failed to capture screenshot");
        console.error("Screenshot capture failed");
      } else {
        setStatus("Screenshot saved!");
      }
    } catch (error) {
      console.error("Screenshot error:", error);
      setStatus(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      // Reset status after a delay
      setTimeout(() => {
        setIsCapturing(false);
        setStatus("");
      }, 2000);
    }
  };

  /* const handleSVGDownload = async () => {
    setIsCapturing(true);
    setStatus("Preparing SVG download...");
    try {
      // Use the native map screenshot approach with combined canvases
      const success = await captureAndDownloadMap({
        filename: `map-screenshot-${new Date().toISOString().slice(0, 10)}.svg`,
        fileType: "image/svg+xml",
        debugMode: true, // Keep debug mode enabled temporarily
        onStatusChange: (newStatus) => {
          setStatus(newStatus);
        },
      });

      if (!success) {
        setStatus("Failed to capture screenshot");
        console.error("Screenshot capture failed");
      } else {
        setStatus("Screenshot saved!");
      }
    } catch (error) {
      console.error("Screenshot error:", error);
      setStatus(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      // Reset status after a delay
      setTimeout(() => {
        setIsCapturing(false);
        setStatus("");
      }, 2000);
    }
  }; */

  return (
    <div className="w-full flex flex-col gap-4">
      <Label className="w-full flex text-left text-lg">
        {(dict.symptoms as I18nRecord).downloadable_elements as string}
      </Label>
      <div className="w-full flex flex-col gap-2">
        <Button
          color="blue"
          className="flex align-middle justify-center"
          onClick={handleScreenshot}
          disabled={isCapturing}
        >
          <FaCamera className="h-4 w-4 mr-2" />{" "}
          {isCapturing
            ? status || "..."
            : ((dict.symptoms as I18nRecord).screenshot as string)}
        </Button>
        {/* <Button
          color="blue"
          className="flex align-middle justify-center"
          onClick={handleSVGDownload}
          disabled={isCapturing}
        >
          <RiFileChartLine className="h-4 w-4 mr-2" />
          {isCapturing
            ? status || "..."
            : ((dict.symptoms as I18nRecord).svg_document as string)}
        </Button>
        <Button color="blue" className="flex align-middle justify-center">
          <FaRegFile className="h-4 w-4 mr-2" />{" "}
          {(dict.symptoms as I18nRecord).other as string}
        </Button> */}
      </div>
    </div>
  );
}
