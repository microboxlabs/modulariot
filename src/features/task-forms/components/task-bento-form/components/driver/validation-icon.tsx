import { FaCheck } from "react-icons/fa";
import { TbExclamationMark } from "react-icons/tb";
import { ValidationStatus } from "./validations.types";

// Validation status icons
export const ValidationIcon = ({ status }: { status: ValidationStatus }) => {
  switch (status) {
    case "ok":
      return (
        <div className="w-5 h-5 text-white bg-gray-400 rounded-full flex items-center justify-center p-1">
          <FaCheck className="w-4 h-4" />
        </div>
      );
    case "not_found":
      return (
        <div className="w-5 h-5 text-white bg-yellow-400 rounded-full flex items-center justify-center">
          <TbExclamationMark className="w-4 h-4" />
        </div>
      );
    case "error":
    default:
      return (
        <div className="w-5 h-5 text-white bg-yellow-400 rounded-full flex items-center justify-center">
          <TbExclamationMark className="w-4 h-4" />
        </div>
      );
  }
};
