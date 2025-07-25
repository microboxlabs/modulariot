import Link from "next/link";
import { FaRegFilePdf } from "react-icons/fa";

export default function Document({ name }: { name: string }) {
  return (
    <div className="w-full rounded-lg flex flex-row items-center overflow-hidden border border-gray-300 p-2 h-[4.5rem]">
      <div className="h-full bg-gray-200 aspect-square rounded-lg"></div>
      <div className="flex flex-col h-full justify-center p-2 w-full">
        <p className="text-sm text-gray-800 dark:text-gray-200">Padrón</p>
        <Link
          href="/"
          className="flex flex-row gap-1 items-center text-blue-500 hover:underline"
        >
          <FaRegFilePdf className="w-4 h-4" />
          <p className="text-xs">Ver documento</p>
        </Link>
      </div>
    </div>
  );
}
