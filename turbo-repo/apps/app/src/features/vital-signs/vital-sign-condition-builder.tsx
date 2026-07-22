import { ConditionBuilder, ThresholdOperator, sevByCode } from "./vital-signs-data";

const OPERATORS: ThresholdOperator[] = [">", ">=", "<", "<="];

const selectClasses =
  "rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white";

const inputClasses =
  "w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white";

export type ConditionRowValue = { operator: ThresholdOperator; value: number };

export default function VitalSignConditionBuilder({
  condition,
  rows,
  onChangeRow,
}: Readonly<{
  condition: ConditionBuilder;
  rows: ConditionRowValue[];
  onChangeRow: (severityCode: number, row: ConditionRowValue) => void;
}>) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
        Condition of activation
      </p>
      <div className="flex flex-col gap-2 rounded-md border border-gray-100 p-3 dark:border-gray-700">
        {condition.rows.map((defaultRow, index) => {
          const row = rows[index] ?? {
            operator: defaultRow.operator,
            value: defaultRow.value,
          };
          const severity = sevByCode(defaultRow.severityCode);

          return (
            <div
              key={defaultRow.severityCode}
              className="flex flex-wrap items-center gap-2 text-sm"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: severity.color }}
              />
              <span className="w-24 shrink-0 text-gray-600 dark:text-gray-300">
                {severity.en}
              </span>
              <span className="text-gray-400 dark:text-gray-500">when</span>
              <span className="text-gray-500 dark:text-gray-400">
                {condition.variableLabel}
              </span>
              <select
                value={row.operator}
                onChange={(event) =>
                  onChangeRow(defaultRow.severityCode, {
                    ...row,
                    operator: event.target.value as ThresholdOperator,
                  })
                }
                className={selectClasses}
              >
                {OPERATORS.map((operator) => (
                  <option key={operator} value={operator}>
                    {operator}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={row.value}
                onChange={(event) =>
                  onChangeRow(defaultRow.severityCode, {
                    ...row,
                    value: Number(event.target.value),
                  })
                }
                className={inputClasses}
              />
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {condition.unit}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
