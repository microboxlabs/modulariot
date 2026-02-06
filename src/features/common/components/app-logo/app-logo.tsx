import Image from "next/image";
// eslint-disable-next-line import/no-unresolved
import logoImage from "@assets/logo.svg";

interface AppLogoProps {
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

export default function AppLogo({
  width = 150,
  height = 32,
  className = "mr-3",
  priority = false,
}: AppLogoProps) {
  return (
    <Image
      src={logoImage}
      className={className}
      alt="Default Logo"
      width={width}
      height={height}
      priority={priority}
      style={{
        width: width,
        height: height,
        maxWidth: width,
        maxHeight: height,
        objectFit: "contain",
      }}
    />
  );
}
