import MapVisualization from "../map-visualization/map-visualization";
import { ScatterplotLayer } from "@deck.gl/layers";

// Function to generate random positions around Santiago, Chile area
function generateRandomPositions(count: number) {
  const baseLatitude = -33.45; // Santiago latitude
  const baseLongitude = -70.65; // Santiago longitude
  const latRange = 0.1; // ~11km range
  const lngRange = 0.1; // ~8km range (considering latitude)

  return Array.from({ length: count }, (_, index) => ({
    id: index,
    position: [
      baseLongitude + (Math.random() - 0.5) * lngRange,
      baseLatitude + (Math.random() - 0.5) * latRange,
    ],
  }));
}

export default function MapHistoryView({
  dict,
  messages,
}: {
  dict: any;
  messages: any;
}) {
  // Generate 20 random positions (you can change this number)
  const numberOfPositions = 100000;
  const test_data = generateRandomPositions(numberOfPositions);

  const layers = [
    new ScatterplotLayer({
      id: "test-positions",
      data: test_data,
      getPosition: (d: any) => d.position,
      getRadius: 50,
      getFillColor: [255, 0, 0, 180], // Red color
      pickable: true,
      radiusMinPixels: 3,
      radiusMaxPixels: 30,
    }),
  ];

  console.log("Rendering again the container");

  return (
    <div className="bg-red-500 w-full h-full relative">
      <MapVisualization mapStyle="satellite" layers={layers} />
    </div>
  );
}
