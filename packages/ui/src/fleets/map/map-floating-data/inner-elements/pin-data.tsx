import ConditionIcon from "../../../../symptoms/conditions/condition-icon"
import { Conditions, pin_conditions } from "../../../../symptoms/types/table-item.type";
import ConditionalData from "../conditional-data";

export default function PinData({data}: {data: any}) {
  console.log(data)

  return (
    <div>
      <ConditionalData
        label="License Plate"
        value={data.asset_id}
        classname="font-medium text-slate-900 dark:text-slate-50"
      />
      <ConditionalData
        label="Trip"
        value={data.trip_id}
      />
      <ConditionalData
        label="Datetime"
        value={
          data.timestamp
            ? new Date(data.timestamp).toLocaleString()
            : ""
        }
      />
      {data.lost_signal && (
        <div>
          <hr className="my-2 border-slate-200 dark:border-slate-700" />
          <div>
            <div className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg font-light text-sm">
              <span className="text-slate-600 dark:text-slate-300 font-normal">
                {"Signal Status"}:
              </span>{" "}
              <span className="font-light text-red-500 dark:text-red-400">
                {"Lost Signal"}
              </span>
            </div>
            <hr className="my-2 border-slate-200 dark:border-slate-700" />
          </div>
        </div>
      )}

      {/* Conditions and symptoms */}
      {data.symptoms_condition != 0 && (
        <div>
          <div className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
            <ConditionIcon
              condition={pin_conditions[data.symptoms_condition as keyof typeof pin_conditions]?.icon}
              size="w-6 h-6"
            />
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {pin_conditions[data.symptoms_condition as keyof typeof pin_conditions]?.label}
            </div>
          </div>
          <div className="flex flex-wrap flex-col pt-1 text-red-500 dark:text-red-400">
            {data.associate_symptoms.map(
              (symptom: string, index: number) => (
                <div key={index} className="text-sm indent-2">
                  -{" "}{symptom}
                </div>
              )
            )}
          </div>
          <hr className="my-2 border-slate-200 dark:border-slate-700" />
        </div>
      )}
      {/* Speed */}
      <div className="text-sm text-slate-600 dark:text-slate-300">
        {"speed: "}
        <span
          className={`font-bold ${data.speed_limit && data.speed > data.speed_limit ? "text-red-500 dark:text-red-400" : "text-green-500 dark:text-green-400"}`}
        >
          {data.speed} <span className="font-light">km/h</span>
        </span>
        {data.speed_limit &&
        data.speed > data.speed_limit ? (
          <span className="text-red-500 dark:text-red-400">
            {" - "}
            {data.speed - data.speed_limit}km/h{" "}
            {"Over the speed limit"}
          </span>
        ) : (
          ""
        )}
      </div>
      {data.speed_limit && (
        <div
          className={`text-sm text-slate-600 dark:text-slate-300 ${data.speed_limit ? "block" : "hidden"}`}
        >
          {"speed limit: "}
          <span className="text-green-500 dark:text-green-400">
            {data.speed_limit}Km/h
          </span>
        </div>
      )}
      {data.gps_provider && (
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {"gps provider: "}
          <span className="text-green-500 dark:text-green-400">
            {data.gps_provider
              .replace(/_/g, " ")
              .replace(/-/g, " ")}
          </span>
        </div>
      )}
    </div>
  );
}

