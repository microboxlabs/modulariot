/* 
Since the map was loaded on client side, 
we need to make this component client rendered as well else error occurs
*/
"use client";

//Map component Component from library
import { GoogleMap, Marker } from "@react-google-maps/api";
import { MapComponentProps } from "./gps-validation-modal.types";

//Map's styling
export const defaultMapContainerStyle = {
  width: "100%",
  height: "200px",
  borderRadius: "15px 0px 0px 15px",
};

const defaultMapZoom = 18;

const defaultMapOptions = {
  zoomControl: true,
  tilt: 0,
  gestureHandling: "auto",
  mapTypeId: "satellite",
};

export default function MapComponent({ pointer }: MapComponentProps) {
  return (
    <div className="w-full">
      <GoogleMap
        mapContainerStyle={defaultMapContainerStyle}
        center={pointer}
        zoom={defaultMapZoom}
        options={defaultMapOptions}
      >
        <Marker position={pointer} />
      </GoogleMap>
    </div>
  );
}
