import { FaCheck } from "react-icons/fa";
import { TbExclamationMark } from "react-icons/tb";
import { ValidationStatus } from "./validations.types";

// Validation status icons
export const ValidationIcon = ({
  status,
  isLoading,
  size = "md",
}: {
  status: ValidationStatus;
  isLoading: boolean;
  size?: "sm" | "md";
}) => {
  const outer = size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5";
  const inner = size === "sm" ? "w-2.5 h-2.5" : "w-4 h-4";

  if (isLoading) {
    return (
      <div className={`${outer} bg-gray-500 rounded-full animate-pulse`}></div>
    );
  }

  switch (status) {
    case "ok":
      return (
        <div className={`${outer} text-white bg-gray-400 rounded-full flex items-center justify-center p-1`}>
          <FaCheck className={inner} />
        </div>
      );
    case "not_found":
      return (
        <div className={`${outer} text-white bg-white rounded-full flex items-center justify-center border-2 border-gray-400`}></div>
      );
    case "error":
    default:
      return (
        <div className={`${outer} text-white bg-yellow-400 rounded-full flex items-center justify-center`}>
          <TbExclamationMark className={inner} />
        </div>
      );
  }
};
