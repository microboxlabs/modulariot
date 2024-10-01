import { tr } from "@/features/i18n/tr.service";
import { StepperNavigationProps } from "./stepper-navigation.types";
import BadgeCheckIcon from "@/features/icons/badge-check";
import { twMerge } from "tailwind-merge";
import ErrorCircleIcon from "@/features/icons/error-circle";

export default function StepperNavigation({
  routePaths,
  currentStep,
  isError = false,
  msg,
  trParams,
}: StepperNavigationProps) {
  return (
    <div className="flex items-center gap-4  py-5">
      {routePaths.map((routePath, index) => {
        const stepEnabled = routePath === currentStep;
        return [
          <div key={`step-${index}`} className="flex gap-0.5 items-center">
            {stepEnabled && !isError && <BadgeCheckIcon />}
            {stepEnabled && isError && <ErrorCircleIcon />}
            <span
              className={twMerge(
                stepEnabled && !isError
                  ? "text-blue-600"
                  : stepEnabled && isError
                    ? "text-red-500"
                    : "text-gray-500",
              )}
            >
              {tr(routePath, msg, trParams ? trParams[routePath] : undefined)}
            </span>
          </div>,
          index < routePaths.length - 1 && (
            <span
              key={`separator-${index}`}
              className="bg-gray-200 h-px w-3"
            ></span>
          ),
        ];
      })}
    </div>
  );
}
