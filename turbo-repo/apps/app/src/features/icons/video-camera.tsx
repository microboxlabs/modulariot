import { ComponentProps } from "react";
import { FaVideo } from "react-icons/fa";

export default function VideoCameraIcon(
  props: Readonly<ComponentProps<"svg">>
) {
  return <FaVideo className="w-5 h-5" {...props} />;
}
