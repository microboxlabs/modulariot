import Image from "next/image";
// eslint-disable-next-line import/no-unresolved
import logoImage from "@assets/logo-mintral-1.png";

interface AppLogoProps {
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

export default function AppLogo({
  width = 150,
  height,
  className = "mr-3",
  priority = false,
}: AppLogoProps) {
  return (
    <Image
      src={logoImage}
      className={className}
      alt="Mintral Coordinador - Sistema de Gestión de Viajes"
      width={width}
      height={height}
      priority={priority}
    />
  );
}
