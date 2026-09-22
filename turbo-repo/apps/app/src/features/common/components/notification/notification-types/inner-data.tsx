import { I18nRecord } from "@/features/i18n/i18n.service.types";

function hasValue(value: unknown): value is string {
  return typeof value === "string" && value !== "" && value !== "-";
}

function PropertyBadge({ label, value }: { label: string; value?: string }) {
  if (!hasValue(value)) return null;

  return (
    <div className="flex flex-row gap-1 whitespace-nowrap rounded-md bg-gray-200 p-0.5 px-1.5 text-xs dark:bg-gray-700">
      {label}:{" "}
      <div className="text-gray-800 dark:text-gray-200">{value}</div>
    </div>
  );
}

export default function InnerData({
  data,
  dictionary,
}: {
  data: any;
  dictionary: I18nRecord;
}) {
  const cleanFecha = (fecha: string, arribo: boolean) => {
    if (arribo) {
      return fecha.replace(/^Fecha de arribo:\s*/, "");
    } else {
      return fecha.replace(/^Fecha de salida:\s*/, "");
    }
  };

  const notifications = (dictionary as I18nRecord).notifications as I18nRecord;
  const originDestination =
    data.properties.origen !== "" && data.properties.destino
      ? `${data.properties.origen}-${data.properties.destino}`
      : undefined;

  return (
    <div className="mb-2 flex flex-col gap-1">
      <div className="flex flex-col">
        <div className="text-md font-semibold text-gray-800 dark:text-gray-200">
          {data.title}
        </div>
        <div className="rounded-md text-xs text-gray-800 dark:text-gray-200">
          {data.message}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-1 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
        <PropertyBadge
          label={notifications.service as string}
          value={data.properties.identificadorServicio}
        />
        <PropertyBadge
          label={notifications.client as string}
          value={data.properties.cliente}
        />
        <PropertyBadge
          label={notifications.client_code as string}
          value={data.properties.codigoCliente}
        />
        <PropertyBadge
          label={notifications.origin_destination as string}
          value={originDestination}
        />
        <PropertyBadge
          label={notifications.truck_license_plate as string}
          value={data.properties.patenteCamion}
        />
        <PropertyBadge
          label={notifications.trailer_license_plate as string}
          value={data.properties.patenteRemolque}
        />
        <PropertyBadge
          label={notifications.estimated_arrival_date as string}
          value={
            hasValue(data.properties.fechaEstimadaArribo)
              ? cleanFecha(data.properties.fechaEstimadaArribo, true)
              : undefined
          }
        />
        <PropertyBadge
          label={notifications.estimated_arrival_date as string}
          value={
            hasValue(data.properties.fechaEstimadaSalida)
              ? cleanFecha(data.properties.fechaEstimadaSalida, false)
              : undefined
          }
        />
        <PropertyBadge
          label={notifications.service_type as string}
          value={data.properties.tipoServicio}
        />
        <PropertyBadge
          label={notifications.reason as string}
          value={data.properties.reason}
        />
        <PropertyBadge
          label={notifications.reject_reason as string}
          value={data.properties.rejectReason}
        />
      </div>
    </div>
  );
}
