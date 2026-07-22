import { VitalSignParam } from "./vital-signs-data";

const inputClasses =
  "rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white";

export default function VitalSignParamField({
  param,
  value,
  onChange,
}: Readonly<{
  param: VitalSignParam;
  value: string;
  onChange: (value: string) => void;
}>) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-600 dark:text-gray-300">
        {param.label}
      </span>
      {param.ui === "number" && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value}
            min={param.min}
            max={param.max}
            onChange={(event) => onChange(event.target.value)}
            className={`w-24 ${inputClasses}`}
          />
          {param.unit && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {param.unit}
            </span>
          )}
        </div>
      )}
      {param.ui === "time" && (
        <input
          type="time"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClasses}
        />
      )}
      {param.ui === "select" && (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClasses}
        >
          {(param.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
      {param.ui === "tri_state" && (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClasses}
        >
          <option value="yes">Yes</option>
          <option value="no">No</option>
          <option value="any">Any</option>
        </select>
      )}
    </div>
  );
}
