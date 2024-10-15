import { DriverVerifiedCardProps } from "../driver-verified-card/driver-verified-card.types";

export type GpsValidationModalProps = {
  openModal: boolean;
  setOpenModal: (openModal: boolean) => void;
} & DriverVerifiedCardProps;

export type MapComponentProps = {
  // eslint-disable-next-line no-undef
  pointer: google.maps.LatLng | google.maps.LatLngLiteral;
};
