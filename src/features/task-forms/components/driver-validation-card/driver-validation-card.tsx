import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { DriverValidationProps } from "./driver-validation-card.types";
import EllipseIcon from "@/features/icons/ellipse";

export default function DriverValidation({
  msg,
  // driver1,
  driver2,
}: DriverValidationProps) {
  return (
    <div>
      <h5 className="text-sm font-medium leading-loose">
        {(msg.cards as I18nRecord).driverValidation as string}
      </h5>
      <div className="flex">
        <div className="flex-1 flex flex-col gap-2">
          <span className="text-gray-400 text-sm">
            {(msg.cards as I18nRecord).driver1 as string}
          </span>
          <div className="flex gap-2">
            <EllipseIcon />
            <span className="text-gray-400 text-sm">
              {(msg.cards as I18nRecord).alcoholTest as string}
            </span>
          </div>
          <div className="flex gap-2">
            <EllipseIcon />
            <span className="text-gray-400 text-sm">
              {(msg.cards as I18nRecord).drugTest as string}
            </span>
          </div>
          <div className="flex gap-2">
            <EllipseIcon />
            <span className="text-gray-400 text-sm">
              {(msg.cards as I18nRecord).sleepinessTest as string}
            </span>
          </div>
        </div>

        {driver2 && (
          <div className="flex-1 flex flex-col gap-2">
            <span className="text-gray-400 text-sm">
              {(msg.cards as I18nRecord).driver2 as string}
            </span>
            <div className="flex gap-2">
              <EllipseIcon />
              <span className="text-gray-400 text-sm">
                {(msg.cards as I18nRecord).alcoholTest as string}
              </span>
            </div>
            <div className="flex gap-2">
              <EllipseIcon />
              <span className="text-gray-400 text-sm">
                {(msg.cards as I18nRecord).drugTest as string}
              </span>
            </div>
            <div className="flex gap-2">
              <EllipseIcon />
              <span className="text-gray-400 text-sm">
                {(msg.cards as I18nRecord).sleepinessTest as string}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
