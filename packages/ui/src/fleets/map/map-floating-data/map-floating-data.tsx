import FloatingDataDisplay from "../../../floating-data-display/floating-data-display";
import { useRef, useEffect, useState } from "react";
import PinData from "./inner-elements/pin-data";

export default function MapFloatingData({
  assets_to_display,
  setSelectedAssets,
  mapContainerRef,
}: {
  assets_to_display: any[];
  setSelectedAssets: (assets: any[]) => void;
  mapContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [initialPosition, setInitialPosition] = useState({ x: 100, y: 100 });
  const prevLengthRef = useRef(0);

  useEffect(() => {
    const currentLength = assets_to_display.length;
    const prevLength = prevLengthRef.current;

    // Check if length changed from 0 to something greater than 0
    if (prevLength === 0 && currentLength > 0) {
      // Calculate center position based on map container
      if (mapContainerRef.current) {
        const rect = mapContainerRef.current.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        setInitialPosition({
          x: centerX,
          y: centerY,
        });
      }
    }

    // Update previous length for next comparison
    prevLengthRef.current = currentLength;
  }, [assets_to_display.length, mapContainerRef]);

  if (assets_to_display.length === 0) return null;


  if (assets_to_display.length > 1) {
    return (
      <FloatingDataDisplay
        initialPosition={initialPosition}
        isOpen={true}
        onClose={() => {}}
        containerRef={mapContainerRef}
      >
        <div>
          A lot of stuff
        </div>
      </FloatingDataDisplay>
    );
  } else if (assets_to_display.length === 1) {
    return (
      <FloatingDataDisplay
        initialPosition={initialPosition}
        isOpen={true}
        onClose={() => {setSelectedAssets([])}}
        containerRef={mapContainerRef}
      >
        <PinData data={assets_to_display[0]} />
      </FloatingDataDisplay>
    );
  }
}
