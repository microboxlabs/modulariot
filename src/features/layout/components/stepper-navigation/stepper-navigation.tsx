import { StepperNavigationProps } from "./stepper-navigation.types";
import BadgeCheckIcon from "@/features/icons/badge-check";
import { twMerge } from "tailwind-merge";

export default function StepperNavigation({
  routePaths,
  currentStep,
  msg
}: StepperNavigationProps) {
  return (
    <div className="flex items-center gap-4  py-5">
      {routePaths.map((routePath, index) => {
        const stepEnabled = routePath === currentStep;
        return (
          <>
            <div className="flex gap-0.5 items-center">
              {stepEnabled && <BadgeCheckIcon />}
              <span
                key={`${index}_route`}
                className={twMerge(
                  stepEnabled ? "text-blue-600" : "text-gray-500",
                )}
              >
                {msg[routePath] as string}
              </span>
            </div>
            {index < routePaths.length - 1 && (
              <span
                key={`${index}_sep`}
                className="bg-gray-200 h-px w-3"
              ></span>
            )}
          </>
        );
      })}
    </div>
  );
}
