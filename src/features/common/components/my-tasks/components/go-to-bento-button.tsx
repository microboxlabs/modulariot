import { Button } from "flowbite-react";
import Link from "next/link";
import { tr } from "@/features/i18n/tr.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export function GoToBentoButton({
  taskId,
  dict,
  handleMouseEnter,
  handleMouseLeave,
}: {
  taskId: string;
  dict: I18nRecord;
  handleMouseEnter: () => void;
  handleMouseLeave: () => void;
}) {
  return (
    <Link href={`/task/edit/${taskId}`} className="w-fit h-fit hover-trigger">
      <Button
        className="h-8 flex justify-center items-center !text-xs overflow-hidden relative"
        color="blue"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        theme={{
          color: {
            blue: "bg-blue-700 text-white focus:ring-blue-300 dark:bg-blue-600 dark:focus:ring-blue-800",
          },
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r bg-black/30 dark:bg-white/30 translate-x-[-100%] group-hover:translate-x-0 pointer-events-none transition-transform group-hover:duration-1000 duration-0 ease-out" />
        <div className="flex items-center gap-2 relative z-10 whitespace-nowrap">
          <p>{tr(`bento.go_to_bento`, dict)}</p>
        </div>
      </Button>
    </Link>
  );
}
