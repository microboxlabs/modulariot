//import { Task } from "@/types/Task";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
//import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Card } from "flowbite-react";
//import { DocumentList } from "../document-list";
//import { DownloadSignedDocument } from "../download-signed-document";

interface ExtendedTaskResponse extends TaskResponse {
  mintral_serviceType: string;
  mintral_serviceKind: string;
  mintral_clientAbbreviation: string;
  mintral_supplierName: string;
  mintral_distance: number;
  mintral_speed: number;
  mintral_originDelegateCode: string;
  mintral_destinationDelegateCode: string;
  mintral_expectedDepartureDate: string;
  mintral_estimatedArrivalDate: string;
  mintral_truckLicensePlate: string;
  mintral_trailerLicensePlate: string;
  mintral_driver1Name: string;
  mintral_driver1Rut: string;
  mintral_driver1Phone: string;
}

interface HistoricalTaskViewProps {
  task: ExtendedTaskResponse;
  user: string;
  msg: I18nRecord;
  lang: string;
}

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

export function CompletedTripView({
  task,
  msg,
  //lang,
}: HistoricalTaskViewProps) {
  return (
    <Card>
      <TaskHeader title={msg.title as string} endTime={task.bpm_status} />
      {/* <CardContent> */}
      <div className="space-y-4">
        <div className="grid gap-4">
          <div>
            <h3 className="font-medium mb-2">{msg.title as string}</h3>
            {/* <DocumentList
                documents={task.persistentState.documents}
                lang={lang}
              /> */}
          </div>
          {/* {task.persistentState.signedDocument && (
              <div>
                <h3 className="font-medium mb-2">{msg.signedDocument}</h3>
                <DownloadSignedDocument
                  document={task.persistentState.signedDocument}
                  lang={lang}
                />
              </div>
            )} */}
        </div>
      </div>
      {/* </CardContent> */}
    </Card>
  );
}

export function CancelledTripView({ task, msg }: HistoricalTaskViewProps) {
  return (
    <Card>
      <TaskHeader title={msg.title as string} endTime={task.bpm_status} />
      {/* <CardContent> */}
      <div className="space-y-4">
        <div>
          <h3 className="font-medium mb-2">{msg.title as string}</h3>
          <p className="text-muted-foreground">{task.bpm_description}</p>
        </div>
      </div>
      {/* </CardContent> */}
    </Card>
  );
}

export function VoidedTripView({ task, msg }: HistoricalTaskViewProps) {
  return (
    <Card>
      <TaskHeader title={msg.title as string} endTime={task.bpm_status} />
      {/* <CardContent> */}
      <div className="space-y-4">
        <div>
          <h3 className="font-medium mb-2">{msg.title as string}</h3>
          <p className="text-muted-foreground">{task.bpm_description}</p>
        </div>
      </div>
      {/* </CardContent> */}
    </Card>
  );
}

export function GeneralTripView({ task, msg }: HistoricalTaskViewProps) {
  return (
    <Card className="pb-4 dark:bg-gray-800 dark:text-white">
      <TaskHeader
        title={task.mintral_key as string}
        endTime={task.bpm_status}
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
