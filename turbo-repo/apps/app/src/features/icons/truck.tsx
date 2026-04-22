import { ComponentProps } from "react";
import { FaTruck } from "react-icons/fa6";

export default function TruckIcon(props: Readonly<ComponentProps<"svg">>) {
  return <FaTruck className="w-5 h-5" {...props} />;
}
