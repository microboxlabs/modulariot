import { ExtendedTaskViewProps } from "@/features/task-forms/components/task-form/task-form.types";
import { Card } from "flowbite-react";

const TaskHeader = ({ title, endTime }: { title: string; endTime: string }) => (
  <Card className="pb-4">
    <div className="flex justify-between items-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <span className="text-sm text-muted-foreground">
        {(new Date(endTime), "PPpp")}
      </span>
    </div>
  </Card>
);

export function GeneralTripView({ task, msg }: ExtendedTaskViewProps) {
  return (
    <Card className="pb-4 dark:bg-gray-800 dark:text-white">
      <TaskHeader
        title={task.mintral_key as string}
        endTime={task.bpm_status ?? ""}
      />
      <div className="space-y-6 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium mb-2">{msg.serviceDetails as string}</h3>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-semibold">
                  {msg.serviceType as string}:
                </span>{" "}
                {task.mintral_serviceType} - {task.mintral_serviceKind}
              </p>
              <p>
                <span className="font-semibold">{msg.client as string}:</span>{" "}
                {task.mintral_clientAbbreviation}
              </p>
              <p>
                <span className="font-semibold">{msg.supplier as string}:</span>{" "}
                {task.mintral_supplierName}
              </p>
              <p>
                <span className="font-semibold">{msg.distance as string}:</span>{" "}
                {task.mintral_distance} km
              </p>
              <p>
                <span className="font-semibold">{msg.speed as string}:</span>{" "}
                {task.mintral_speed} km/h
              </p>
            </div>
          </div>
          <div>
            <h3 className="font-medium mb-2">
              {msg.routeInformation as string}
            </h3>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-semibold">{msg.origin as string}:</span>{" "}
                {task.mintral_originDelegateCode}
              </p>
              <p>
                <span className="font-semibold">
                  {msg.destination as string}:
                </span>{" "}
                {task.mintral_destinationDelegateCode}
              </p>
              <p>
                <span className="font-semibold">
                  {msg.expectedDeparture as string}:
                </span>{" "}
                {new Date(task.mintral_expectedDepartureDate).toLocaleString()}
              </p>
              <p>
                <span className="font-semibold">
                  {msg.estimatedArrival as string}:
                </span>{" "}
                {new Date(task.mintral_estimatedArrivalDate).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium mb-2">
              {msg.vehicleInformation as string}
            </h3>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-semibold">
                  {msg.truckLicense as string}:
                </span>{" "}
                {task.mintral_truckLicensePlate}
              </p>
              <p>
                <span className="font-semibold">
                  {msg.trailerLicense as string}:
                </span>{" "}
                {task.mintral_trailerLicensePlate}
              </p>
            </div>
          </div>
          <div>
            <h3 className="font-medium mb-2">
              {msg.driverInformation as string}
            </h3>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-semibold">{msg.driver as string}:</span>{" "}
                {task.mintral_driver1Name}
              </p>
              <p>
                <span className="font-semibold">{msg.rut as string}:</span>{" "}
                {task.mintral_driver1Rut}
              </p>
              <p>
                <span className="font-semibold">{msg.phone as string}:</span>{" "}
                {task.mintral_driver1Phone}
              </p>
            </div>
          </div>
        </div>

        {task.bpm_description && (
          <div>
            <h3 className="font-medium mb-2">
              {msg.additionalInformation as string}
            </h3>
            <p className="text-sm text-muted-foreground">
              {task.bpm_description}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
