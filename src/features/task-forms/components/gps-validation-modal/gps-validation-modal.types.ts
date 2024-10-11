import { DriverVerifiedCardProps } from "../driver-verified-card/driver-verified-card.types";

export type GpsValidationModalProps = {
  openModal: boolean;
  setOpenModal: (openModal: boolean) => void;
} & DriverVerifiedCardProps;
