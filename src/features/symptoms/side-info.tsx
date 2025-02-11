import { FaFilePen } from "react-icons/fa6";
import ConditionIcon from "./components/condition-icon";
import ExpandableButton from "./components/expandable-button";
import { Conditions } from "./components/table-item.type";
import { FaClock, FaTruck } from "react-icons/fa";
const data = {
  trip: {
    condition: "code black",
    licensePlate: "XX BB 21",
    date: "2025-01-01 12:00:00",
    trip: "STG-ANF",
    driver: "ANONIMO ANDRÉS",
    service: "V-1406865",
    alertType: "Conducción máxima continua",
  },
  actions: [
    {
      actions: "Aviso preventivo",
      gestion: "Torre de control",
      assigned_to: "pia@mintral.com",
      gestion_time: "00:00:00",
    },
    {
      actions: "Aviso preventivo",
      gestion: "Torre de control",
      assigned_to: "pia@mintral.com",
      gestion_time: "00:00:00",
    },
    {
      actions: "Aviso preventivo",
      gestion: "Torre de control",
      assigned_to: "pia@mintral.com",
      gestion_time: "00:00:00",
    }
  ],
  timeline: [
    {
      date: "2025-01-01",

    },
  ]

};

export default function SideInfo() {
  return (
    <div className="flex flex-col gap-5 p-10  ">
      <ExpandableButton
        icon={<FaTruck />}
        title="Condición"
        description="Información relevante de la detección de anomalías."
      >
        <div className="flex flex-col gap-2">
          <div className={`flex flex-row items-center gap-2 p-1 rounded-md ${Conditions[data.trip.condition as keyof typeof Conditions].bgColor}`}>
            <ConditionIcon condition={data.trip.condition} size="h-7 w-7" />
            <p className={`text-sm font-medium ${Conditions[data.trip.condition as keyof typeof Conditions].textColor}`}>{new Date(data.trip.date).toLocaleString().split(",")[1]}<span className="text-gray-400 text-xs">{" " + data.trip.licensePlate}</span></p>
          </div>
          <p className="text-sm">
            Síntoma observado: <span className="text-gray-500">{data.trip.alertType}</span>
          </p>
          <p className="text-sm">
            Evento: <span className="text-gray-500">4.5 Horas de conducción sin descanso</span>
          </p>
          <p className="text-sm">
            Trayecto: <span className="text-gray-500">{data.trip.trip}</span>
          </p>
          <p className="text-sm">
            Tiempo de trayecto: <span className="text-gray-500">16:33:12 hrs</span>
          </p>
          <p className="text-sm">
            Servicio: <span className="text-gray-500">{data.trip.service}</span>
          </p>
          <p className="text-sm">
            Prescripción recomendada: <span className="text-gray-500">Llamar al conductor</span>
          </p>
        </div>
      </ExpandableButton>
      {/* Registro de acciones */}
      <ExpandableButton
        icon={<FaFilePen />}
        title="Registro de acciones"
        description="Acciones realizadas anteriormente."
      >
        <div className="flex flex-col gap-2">
          {data.actions.map((action, index) => (
            <div key={index} className="flex flex-col gap-2 p-1 ">
              <p className="rounded-md bg-gray-200 w-full p-2 px-5">{index + 1}.</p>
              <div className="grid grid-cols-2 gap-1 px-2">
                <p className="text-sm font-medium w-full">Acciones:<span className="font-light text-gray-500">{" " + action.actions}</span></p>
                <p className="text-sm font-medium w-full">Gestión:<span className="font-light text-gray-500">{" " + action.gestion}</span></p>
                <p className="text-sm font-medium w-full">Encargado:<span className="font-light text-gray-500">{" " + action.assigned_to}</span></p>
                <p className="text-sm font-medium w-full">Hora gestión:<span className="font-light text-gray-500">{" " + action.gestion_time}</span></p>
              </div>
            </div>
          ))}
        </div>
      </ExpandableButton >
      {/* Timeline */}
      <ExpandableButton
        icon={< FaClock />}
        title="timeline"
        description="Historial de condiciones anteriores."
      >
        <div className="flex flex-col gap-2 bg-gray-50 rounded-md p-2">
          {data.timeline.map((item, index) => (
            <div key={index} className="flex flex-col gap-2">
              <div className="flex flex-col bg-gray-100 dark:bg-gray-900 rounded-lg p-3">
                <div className="w-full flex flex-row gap-5 text-sm">
                  <div className="text-black dark:text-white">
                    {formatDate(setted_date)}
                  </div>
                  <div className="flex flex-row flex-grow justify-between">
                    <p className="text-gray-500 dark:text-gray-400">
                      {getRelativeDayText(setted_date)}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400">
                      Síntomas totales: 2210
                    </p>
                  </div>
                </div>
              </div>
              <p> {item.start_hour} - {item.end_hour} </p>
            </div>
          ))}
        </div>
      </ExpandableButton >
    </div >
  );
}
