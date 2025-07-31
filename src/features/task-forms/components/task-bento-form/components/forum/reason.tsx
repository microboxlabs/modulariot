import { FaLightbulb } from "react-icons/fa";

export default function Reason({ reason }: { reason: string }) {
  return (
    <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-md text-sm px-2 py-0.5 gap-1 flex flex-row items-center w-fit text-gray-600 dark:text-gray-400">
      <FaLightbulb className="w-3 h-3" />
      <span>{reason}</span>
    </div>
  );
}
