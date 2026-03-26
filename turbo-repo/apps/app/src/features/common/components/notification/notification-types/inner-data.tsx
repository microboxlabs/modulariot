import { I18nRecord } from "@/features/i18n/i18n.service.types";

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

  return (
    <div className="flex flex-col gap-1 mb-2">
      <div className="text-lg font-normal text-gray-800 dark:text-gray-200">
        {data.title}
      </div>
      <div className="rounded-md text-sm text-gray-800 dark:text-gray-200">
        {data.message}
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400 gap-y-1 gap-x-1 flex flex-wrap">
        {data.properties.identificadorServicio &&
          data.properties.identificadorServicio != "" &&
          data.properties.identificadorServicio != "-" && (
            <div className="p-1 px-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm whitespace-nowrap flex flex-row gap-1">
              {
                ((dictionary as I18nRecord).notifications as I18nRecord)
                  .service as string
              }
              :{" "}
              <div className=" text-gray-800 dark:text-gray-200">
                {data.properties.identificadorServicio}
              </div>
            </div>
          )}
        {data.properties.cliente &&
          data.properties.cliente != "" &&
          data.properties.cliente != "-" && (
            <div className="p-1 px-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm whitespace-nowrap flex flex-row gap-1">
              {
                ((dictionary as I18nRecord).notifications as I18nRecord)
                  .client as string
              }
              :{" "}
              <div className=" text-gray-800 dark:text-gray-200">
                {data.properties.cliente}
              </div>
            </div>
          )}
        {data.properties.codigoCliente &&
          data.properties.codigoCliente != "" &&
          data.properties.codigoCliente != "-" && (
            <div className="p-1 px-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm whitespace-nowrap flex flex-row gap-1">
              {
                ((dictionary as I18nRecord).notifications as I18nRecord)
                  .client_code as string
              }
              :{" "}
              <div className=" text-gray-800 dark:text-gray-200">
                {data.properties.codigoCliente}
              </div>
            </div>
          )}
        {data.properties.origen != "" && data.properties.destino && (
          <div className="p-1 px-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm whitespace-nowrap flex flex-row gap-1">
            {
              ((dictionary as I18nRecord).notifications as I18nRecord)
                .origin_destination as string
            }
            :{" "}
            <div className=" text-gray-800 dark:text-gray-200">
              {data.properties.origen}-{data.properties.destino}
            </div>
          </div>
        )}
        {data.properties.patenteCamion &&
          data.properties.patenteCamion != "" &&
          data.properties.patenteCamion != "-" && (
            <div className="p-1 px-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm whitespace-nowrap flex flex-row gap-1">
              {
                ((dictionary as I18nRecord).notifications as I18nRecord)
                  .truck_license_plate as string
              }
              :{" "}
              <div className=" text-gray-800 dark:text-gray-200">
                {data.properties.patenteCamion}
              </div>
            </div>
          )}
        {data.properties.patenteRemolque &&
          data.properties.patenteRemolque != "" &&
          data.properties.patenteRemolque != "-" && (
            <div className="p-1 px-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm whitespace-nowrap flex flex-row gap-1">
              {
                ((dictionary as I18nRecord).notifications as I18nRecord)
                  .trailer_license_plate as string
              }
              :{" "}
              <div className=" text-gray-800 dark:text-gray-200">
                {data.properties.patenteRemolque}
              </div>
            </div>
          )}
        {data.properties.fechaEstimadaArribo &&
          data.properties.fechaEstimadaArribo != "" &&
          data.properties.fechaEstimadaArribo != "-" && (
            <div className="p-1 px-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm whitespace-nowrap flex flex-row gap-1">
              {
                ((dictionary as I18nRecord).notifications as I18nRecord)
                  .estimated_arrival_date as string
              }
              :{" "}
              <div className=" text-gray-800 dark:text-gray-200">
                {cleanFecha(data.properties.fechaEstimadaArribo, true)}
              </div>{" "}
            </div>
          )}
        {data.properties.fechaEstimadaSalida &&
          data.properties.fechaEstimadaSalida != "" &&
          data.properties.fechaEstimadaSalida != "-" && (
            <div className="p-1 px-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm whitespace-nowrap flex flex-row gap-1">
              {
                ((dictionary as I18nRecord).notifications as I18nRecord)
                  .estimated_arrival_date as string
              }
              :{" "}
              <div className=" text-gray-800 dark:text-gray-200">
                {cleanFecha(data.properties.fechaEstimadaSalida, false)}
              </div>
            </div>
          )}
        {data.properties.tipoServicio &&
          data.properties.tipoServicio != "" &&
          data.properties.tipoServicio != "-" && (
            <div className="p-1 px-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm whitespace-nowrap flex flex-row gap-1">
              {
                ((dictionary as I18nRecord).notifications as I18nRecord)
                  .service_type as string
              }
              :{" "}
              <div className=" text-gray-800 dark:text-gray-200">
                {data.properties.tipoServicio}
              </div>
            </div>
          )}
        {data.properties.reason &&
          data.properties.reason != "" &&
          data.properties.reason != "-" && (
            <div className="p-1 px-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm whitespace-nowrap flex flex-row gap-1">
              {
                ((dictionary as I18nRecord).notifications as I18nRecord)
                  .reason as string
              }
              :{" "}
              <div className=" text-gray-800 dark:text-gray-200">
                {data.properties.reason}
              </div>
            </div>
          )}
        {data.properties.rejectReason &&
          data.properties.rejectReason != "" &&
          data.properties.rejectReason != "-" && (
            <div className="p-1 px-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm whitespace-nowrap flex flex-row gap-1">
              {
                ((dictionary as I18nRecord).notifications as I18nRecord)
                  .reject_reason as string
              }
              :{" "}
              <div className=" text-gray-800 dark:text-gray-200">
                {data.properties.rejectReason}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
