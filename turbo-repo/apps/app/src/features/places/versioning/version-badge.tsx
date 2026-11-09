// Versión vigente de una geocerca o trayecto, junto a su título o nombre.
import { twMerge } from "tailwind-merge";
import { usePlacesT } from "../i18n/places-i18n";

export default function VersionBadge({
  version,
  className,
}: Readonly<{ version: string | null | undefined; className?: string }>) {
  const t = usePlacesT();
  if (!version) return null;
  return (
    <span
      title={t("versioning.version_n", { version })}
      className={twMerge(
        "rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300",
        className
      )}
    >
      v{version}
    </span>
  );
}
