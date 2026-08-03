import { LynxBrand } from "@modulariot/ui/brand/logo";

interface AppLogoProps {
  className?: string;
}

export default function AppLogo({ className = "mr-3" }: AppLogoProps) {
  return (
    <LynxBrand
      className={`${className} text-(--brand-ink)`}
      iconClassName="h-11 w-11"
      wordmarkClassName="h-5 w-auto"
    />
  );
}
