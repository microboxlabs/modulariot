import Image from "next/image";
import observation from "@assets/conditions/en-observacion.svg";
import compromised from "@assets/conditions/comprometida.svg";
import critical from "@assets/conditions/alerta-critica.svg";
import codeBlack from "@assets/conditions/codigo-negro.svg";

/** The four ICU levels as the maintainer draws them: ring, fill and bar colour. */
export const LEVEL_STYLES = [
  {
    icu: 1,
    icon: observation,
    ring: "border-rose-700 bg-white",
    bar: "bg-rose-200",
  },
  {
    icu: 2,
    icon: compromised,
    ring: "border-rose-700 bg-rose-50",
    bar: "bg-rose-400",
  },
  {
    icu: 3,
    icon: critical,
    ring: "border-red-500 bg-rose-200",
    bar: "bg-red-500",
  },
  {
    icu: 4,
    icon: codeBlack,
    ring: "border-black bg-gray-200 dark:border-gray-200",
    bar: "bg-black dark:bg-gray-200",
  },
] as const;

export function levelStyle(icu: number) {
  return LEVEL_STYLES[Math.min(Math.max(icu, 1), 4) - 1];
}

/** A level's icon in its ring; `empty` draws the dashed placeholder of a level that does not apply. */
export function LevelIcon({
  icu,
  label,
  size = "h-7 w-7",
  empty = false,
}: Readonly<{ icu: number; label?: string; size?: string; empty?: boolean }>) {
  if (empty) {
    return (
      <span
        title={label}
        className={`flex shrink-0 rounded-full border-2 border-dashed border-gray-300 bg-white opacity-40 dark:border-gray-600 dark:bg-gray-800 ${size}`}
      />
    );
  }
  const style = levelStyle(icu);
  return (
    <span
      title={label}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 ${style.ring} ${size}`}
    >
      <Image src={style.icon} alt="" className="h-full w-full" />
    </span>
  );
}
