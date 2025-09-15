"use client";

import { I18nRecord } from "@/features/i18n/i18n.service.types";
import GridTable from "../../grid-table/grid-table";
import TaskListElement from "./task-element";
import { Spinner } from "flowbite-react";
import { tr } from "@/features/i18n/tr.service";

export default function TaskList({ dict }: { dict: I18nRecord }) {
  const header = [
    tr("my_tasks.stage", dict),
    tr("my_tasks.duration", dict),
    tr("my_tasks.license_plate", dict),
    tr("my_tasks.route", dict),
    tr("my_tasks.client", dict),
  ];

  const content = [
    <TaskListElement
      key="dato-1"
      type="Viaje Iniciado"
      state="En Progreso"
      service="#1420423-v"
      date="14-08-2025"
      duration="02:22:45 hrs"
      licensePlate="PBHX50"
      route="SLC-MEL"
      client="BHP"
      alert_level={3}
    />,
    <TaskListElement
      key="dato-2"
      type="Viaje Iniciado"
      state="En Progreso"
      service="#1420423-v"
      date="14-08-2025"
      duration="02:22:45 hrs"
      licensePlate="PBHX50"
      route="SLC-MEL"
      client="BHP"
      alert_level={3}
    />,
    <TaskListElement
      key="dato-3"
      type="Viaje Iniciado"
      state="En Progreso"
      service="#1420423-v"
      date="14-08-2025"
      duration="02:22:45 hrs"
      licensePlate="PBHX50"
      route="SLC-MEL"
      client="BHP"
      alert_level={2}
    />,
    <TaskListElement
      key="dato-4"
      type="Viaje Iniciado"
      state="En Progreso"
      service="#1420423-v"
      date="14-08-2025"
      duration="02:22:45 hrs"
      licensePlate="PBHX50"
      route="SLC-MEL"
      client="BHP"
      alert_level={1}
    />,
    <TaskListElement
      key="dato-5"
      type="Viaje Iniciado"
      state="En Progreso"
      service="#1420423-v"
      date="14-08-2025"
      duration="02:22:45 hrs"
      licensePlate="PBHX50"
      route="SLC-MEL"
      client="BHP"
      alert_level={0}
    />,
    <TaskListElement
      key="dato-6"
      type="Viaje Iniciado"
      state="En Progreso"
      service="#1420423-v"
      date="14-08-2025"
      duration="02:22:45 hrs"
      licensePlate="PBHX50"
      route="SLC-MEL"
      client="BHP"
      alert_level={0}
    />,
    <TaskListElement
      key="dato-7"
      type="Viaje Iniciado"
      state="En Progreso"
      service="#1420423-v"
      date="14-08-2025"
      duration="02:22:45 hrs"
      licensePlate="PBHX50"
      route="SLC-MEL"
      client="BHP"
      alert_level={0}
    />,
    <TaskListElement
      key="dato-8"
      type="Viaje Iniciado"
      state="En Progreso"
      service="#1420423-v"
      date="14-08-2025"
      duration="02:22:45 hrs"
      licensePlate="PBHX50"
      route="SLC-MEL"
      client="BHP"
      alert_level={0}
    />,
    <TaskListElement
      key="dato-9"
      type="Viaje Iniciado"
      state="En Progreso"
      service="#1420423-v"
      date="14-08-2025"
      duration="02:22:45 hrs"
      licensePlate="PBHX50"
      route="SLC-MEL"
      client="BHP"
      alert_level={0}
    />,
    <TaskListElement
      key="dato-10"
      type="Viaje Iniciado"
      state="En Progreso"
      service="#1420423-v"
      date="14-08-2025"
      duration="02:22:45 hrs"
      licensePlate="PBHX50"
      route="SLC-MEL"
      client="BHP"
      alert_level={0}
    />,
    <TaskListElement
      key="dato-11"
      type="Viaje Iniciado"
      state="En Progreso"
      service="#1420423-v"
      date="14-08-2025"
      duration="02:22:45 hrs"
      licensePlate="PBHX50"
      route="SLC-MEL"
      client="BHP"
      alert_level={0}
    />,
    <TaskListElement
      key="dato-12"
      type="Viaje Iniciado"
      state="En Progreso"
      service="#1420423-v"
      date="14-08-2025"
      duration="02:22:45 hrs"
      licensePlate="PBHX50"
      route="SLC-MEL"
      client="BHP"
      alert_level={0}
    />,
    <TaskListElement
      key="dato-13"
      type="Viaje Iniciado"
      state="En Progreso"
      service="#1420423-v"
      date="14-08-2025"
      duration="02:22:45 hrs"
      licensePlate="PBHX50"
      route="SLC-MEL"
      client="BHP"
      alert_level={0}
    />,
  ];

  return (
    <div className="w-full h-fit relative">
      <GridTable
        header={header}
        content={content}
        style={{
          gridTemplateColumns: "4fr 1fr 1fr 1fr 1fr",
          minWidth: "600px",
        }}
      />
      <div className="flex justify-center pt-4 pb-2">
        <Spinner size="lg" />
      </div>
    </div>
  );
}
