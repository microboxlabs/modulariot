"use client";

const test_data = [
  {
    condition: "code black",
    licensePlate: "TLGK52",
    time: "30 seg.",
    trip: "STG-ANF",
    date: "2025-01-01 12:00:00",
    service: "V1406865",
    alertType: "Conducción máxima continua",
    icon: "example.svg",
    type_of_incidence: "Exceso Velocidad Gravisimo",
    asset_id: "TLGK52",
    trip_id: "14440987",
    client: "BHP",
    driver: "Schumacher Michael",
    items: [
      {
        key: "start",
        value: "2025-02-15 14:10:02+00",
      },
      {
        key: "end",
        value: "2025-02-15 14:30:02+00",
      },
      {
        key: "duration_sec",
        value: 1200,
      },
      {
        key: "signals",
        value: 400,
      },
      {
        key: "signals_per_minute",
        value: 20,
      },
      {
        key: "average_speed",
        value: 96,
      },
      {
        key: "speed_limit_reference",
        value: 60,
      },
      /* {
        key: "geographical_reference_point",
        value: "0101000020E6100000BD3AC780EC9351C050FEEE1D35C637C0",
      }, */
      {
        key: "treatments",
        value: "0",
      },
    ],
  },
];

export default function TimedSymptomsSkeleton({
  initial_state = false,
}: {
  initial_state: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Expandable Button */}
      <div className="flex flex-row gap-2 w-full items-center justify-between transition-all duration-300 rounded-t-lg p-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-row gap-2 items-center justify-center">
          <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="flex flex-col gap-3 text-gray-200 dark:text-gray-700 bg-gray-200 dark:bg-gray-700 rounded-lg">
            5 elementos detectados
          </div>
        </div>
      </div>
      {/* Data */}
      <div
        className={`flex flex-col gap-2 w-full transition-all duration-300 ease-in-out overflow-hidden ${initial_state ? "max-h-[1000px]" : "max-h-0"}`}
      >
        {test_data.map((item) => (
          <div
            key={item.condition}
            className="flex flex-col items-center justify-center mb-2"
          >
            {/* Condition */}
            <div
              className={`flex flex-row items-center p-2 gap-3 text-gray-100 dark:text-gray-800 bg-gray-200 dark:bg-gray-700 w-full rounded-lg`}
            >
              <div className="h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-800" />
              <p className="bg-gray-100 dark:bg-gray-800 rounded-lg">
                ejemplo de dato
              </p>
              |
              <p className="bg-gray-100 dark:bg-gray-800 rounded-lg">
                ejemplo de dato
              </p>
              |
              <p className="bg-gray-100 dark:bg-gray-800 rounded-lg">
                ejemplo de dato
              </p>
              |
              <p className="bg-gray-100 dark:bg-gray-800 rounded-lg">
                ejemplo de dato
              </p>
              |
              <p className="bg-gray-100 dark:bg-gray-800 rounded-lg">
                ejemplo de dato
              </p>
              |
              <p className="bg-gray-100 dark:bg-gray-800 rounded-lg">
                ejemplo de dato
              </p>
              |
            </div>
            {/* Data */}
            <div className="grid grid-cols-3 w-full p-3 gap-2 text-gray-200 dark:text-gray-700">
              <p className="bg-gray-200 dark:bg-gray-700 rounded-lg">
                Texto de ejemplo
              </p>
              <p className="bg-gray-200 dark:bg-gray-700 rounded-lg">
                Texto de ejemplo
              </p>
              <p className="bg-gray-200 dark:bg-gray-700 rounded-lg">
                Texto de ejemplo
              </p>
              <p className="bg-gray-200 dark:bg-gray-700 rounded-lg">
                Texto de ejemplo
              </p>
              <p className="bg-gray-200 dark:bg-gray-700 rounded-lg">
                Texto de ejemplo
              </p>
              <p className="bg-gray-200 dark:bg-gray-700 rounded-lg">
                Texto de ejemplo
              </p>
              <p className="bg-gray-200 dark:bg-gray-700 rounded-lg">
                Texto de ejemplo
              </p>
              <p className="bg-gray-200 dark:bg-gray-700 rounded-lg">
                Texto de ejemplo
              </p>
            </div>
            {/* Diagnose button */}
            <div className="flex flex-row gap-2 w-full justify-end">
              <div className="bg-gray-200 dark:bg-gray-700 text-gray-200 dark:text-gray-700 px-4 py-2 rounded-md">
                diagnostigo
              </div>
              <div className="bg-gray-200 dark:bg-gray-700 text-gray-200 dark:text-gray-700 px-4 py-2 rounded-md">
                vista geográfica
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
