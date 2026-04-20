import { ComponentProps } from "react";
import { FaBook } from "react-icons/fa";

export default function FaBookIcon(props: Readonly<ComponentProps<"svg">>) {
  return <FaBook className="w-5 h-5" {...props} />;
}
