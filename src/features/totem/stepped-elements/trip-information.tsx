import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useEffect, useRef, useState } from "react";
import { FaExclamationCircle, FaCheckCircle } from "react-icons/fa";
import Image from "next/image";
import exclamationIcon from "@assets/wired-flat-1140-error-in-reveal.gif";
import { Button } from "flowbite-react";
import { logger } from "@/lib/logger";

export default function TripInformation({
  setCurrentStep,
  currentStep,
  dict,
  deviceId,
  deviceLocation,
  rutData,
  biometricResult,
  tripData,
  setTripData,
  idCardNumber,
}: {
  setCurrentStep: (step: number) => void;
  currentStep: number;
  dict: I18nRecord;
  deviceId: string | null;
  deviceLocation: string | null;
  rutData: { rut: string } | null;
  biometricResult: any;
  tripData: any;
  setTripData: (tripData: any) => void;
  idCardNumber: string;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasRun = useRef(false);
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    //if (tripData) return; // Only run if tripData is not set

    setIsLoading(true);
    const verifyBiometric = async () => {
      if (!deviceId || !deviceLocation) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch("/app/api/biometric/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            driverId: rutData?.rut, // Replace with actual driver ID
            deviceId,
            deviceLocation,
            fingerprintData: biometricResult, // Add if available
            driverSerieId: idCardNumber, // Add if available
          }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          logger.info("errorData", errorData);
          if (errorData?.error?.code === "multiple_tasks") {
            setError((dict.totem as I18nRecord).multiple_tasks as string);
            return;
          }
          throw new Error(
            errorData?.error?.info?.error
              ? ((dict.totem as I18nRecord)[
                  errorData?.error?.info?.error as keyof I18nRecord
                ] as string)
              : ((dict.totem as I18nRecord)
                  .biometric_verification_error as string),
          );
        }
        const data = await response.json();
        if (data?.success === false) {
          if (data?.message == "Driver already verified") {
            if (tripData?.tripInfo?.driver1Info?.driverId === rutData?.rut) {
              setTripData({
                ...tripData,
                tripInfo: {
                  ...tripData.tripInfo,
                  status: "SUCCESS",
                },
              });
            }
            if (tripData?.tripInfo?.driver2Info?.driverId === rutData?.rut) {
              setTripData({
                ...tripData,
                tripInfo: {
                  ...tripData.tripInfo,
                  status2: "SUCCESS",
                },
              });
            }
            return;
          }
          setError(
            ((dict.totem as I18nRecord)[
              data?.message as keyof I18nRecord
            ] as string) ??
              ((dict.totem as I18nRecord)
                .biometric_verification_error as string),
          );
          return;
        }
        if (
          tripData &&
          tripData?.tripInfo?.driver1Info?.driverId === data?.tripInfo?.driverId
        ) {
          setTripData({
            ...tripData,
            tripInfo: {
              ...tripData.tripInfo,
              status:
                data?.tripInfo?.driver1Info?.driverId ===
                data?.tripInfo?.driverId
                  ? "SUCCESS"
                  : "PENDING",
            },
          });
        } else if (
          tripData &&
          tripData?.tripInfo?.driver2Info?.driverId === data?.tripInfo?.driverId
        ) {
          setTripData({
            ...tripData,
            tripInfo: {
              ...tripData.tripInfo,
              status2:
                data?.tripInfo?.driver2Info?.driverId ===
                data?.tripInfo?.driverId
                  ? "SUCCESS"
                  : "PENDING",
            },
          });
        } else {
          setTripData({
            ...data,
            tripInfo: {
              ...data.tripInfo,
              status:
                data?.tripInfo?.driver1Info?.driverId ===
                data?.tripInfo?.driverId
                  ? "SUCCESS"
                  : "PENDING",
              status2:
                data?.tripInfo?.driver2Info?.driverId ===
                data?.tripInfo?.driverId
                  ? "SUCCESS"
                  : "PENDING",
            },
          });
        }
      } catch (err) {
        console.error(err);
        //setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    verifyBiometric();
  }, []);

  if (!deviceId || !deviceLocation) return null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl p-10 bg-gray-100 dark:bg-gray-800 w-full">
        <p className="text-xl font-light text-gray-900 dark:text-gray-100">
          {(dict.totem as I18nRecord).loading as string}
        </p>
      </div>
    );
  }

  if (error && !tripData) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl p-4 gap-2 bg-gray-100 dark:bg-gray-800 w-full portrait:w-full">
        <p className="text-lg text-red-500 text-center">{error}</p>
        <Image src={exclamationIcon} alt="exclamation" className="w-40 h-40" />
        <Button
          onClick={() => setCurrentStep(currentStep + 1)}
          className="bg-blue-500 text-white p-2 rounded-lg w-full flex items-center justify-center"
          color="blue"
        >
          <p className="text-base font-light">
            {(dict.totem as I18nRecord).continue as string}
          </p>
        </Button>
      </div>
    );
  }

  if (!tripData && !isLoading && !error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl p-4 gap-2 bg-gray-100 dark:bg-gray-800 w-full portrait:w-full">
        <p className="text-center font-light text-base text-gray-900 dark:text-gray-100">
          El conductor con rut <span className="font-bold">{rutData?.rut}</span>{" "}
          no posee un viaje asignado.
        </p>
        <Image src={exclamationIcon} alt="exclamation" className="w-40 h-40" />
        <Button
          onClick={() => setCurrentStep(currentStep + 1)}
          className="bg-blue-500 text-white p-2 rounded-lg w-full flex items-center justify-center"
          color="blue"
        >
          <p className="text-base font-light">
            {(dict.totem as I18nRecord).continue as string}
          </p>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl p-4 bg-gray-100 dark:bg-gray-800 w-full portrait:w-full">
      <h1 className="text-lg text-gray-900 dark:text-gray-100">
        {(dict.totem as I18nRecord).trip_information as string}
      </h1>
      <hr className="w-full border-gray-300 dark:border-gray-700"></hr>
      <div className="flex flex-wrap items-stretch w-full my-2 gap-4">
        <DriverInfo
          number={1}
          name={tripData?.tripInfo?.driver1Info?.driverId}
          /* email={tripData?.tripInfo?.email}
          phone={tripData?.tripInfo?.phone} */
          state={tripData?.tripInfo?.driver1Info?.verified}
          dict={dict}
        />
        {tripData?.isDoubleDriver && (
          <DriverInfo
            number={2}
            name={tripData?.tripInfo?.driver2Info?.driverId}
            /*  email={tripData?.trip?.email2}
            phone={tripData?.trip?.phone2} */
            state={tripData?.tripInfo?.driver2Info?.verified}
            dict={dict}
          />
        )}
      </div>
      <hr className="w-full border-gray-300 dark:border-gray-700"></hr>
      {tripData?.tripInfo?.tripInfo?.tripId && (
        <div className="flex flex-row items-stretch justify-center gap-3 w-full my-2">
          <div className="flex flex-col justify-center gap-2 w-full">
            <h1 className="text-base font-light text-gray-900 dark:text-gray-100">
              {(dict.totem as I18nRecord).trip_information as string}
            </h1>
            <div className="flex flex-col justify-center gap-1 w-full">
              <h1 className="text-xs font-bold text-gray-900 dark:text-gray-400">
                {(dict.totem as I18nRecord).trip_information_client as string}:{" "}
                <span className="font-light">
                  {tripData?.tripInfo?.tripInfo?.tripId}
                </span>
              </h1>
              <h1 className="text-xs font-bold text-gray-900 dark:text-gray-400">
                {((dict.totem as I18nRecord)
                  .trip_information_origin_destination as string) + ": "}
                <span className="font-light">
                  {tripData?.tripInfo?.tripInfo?.origin} -{" "}
                  {tripData?.tripInfo?.tripInfo?.destination}
                </span>
              </h1>
              <h1 className="text-xs font-bold text-gray-900 dark:text-gray-400">
                {(dict.totem as I18nRecord).trip_information_schedule as string}
                :{" "}
                <span className="font-light">
                  {tripData?.tripInfo?.tripInfo?.startTime?.split("T")[1]} -{" "}
                  {tripData?.tripInfo?.tripInfo?.endTime?.split("T")[1]}
                </span>
              </h1>
            </div>
          </div>
        </div>
      )}
      {!tripData?.tripInfo?.tripInfo?.tripId && (
        <div className="flex flex-col justify-center gap-2 w-full my-2">
          <h1 className="text-sm font-light text-red-500 dark:text-red-500">
            {(dict.totem as I18nRecord).no_trip_information as string}
          </h1>
        </div>
      )}
      <Button
        onClick={() => setCurrentStep(currentStep + 1)}
        className="bg-blue-500 text-white p-2 rounded-lg w-full flex items-center justify-center"
        color="blue"
      >
        <p className="text-base font-light">
          {(dict.totem as I18nRecord).continue as string}
        </p>
      </Button>
    </div>
  );
}

function DriverInfo({
  number,
  name,
  /* email,
  phone, */
  state,
  dict,
}: {
  number: number;
  name: string;
  /*  email: string;
  phone: string; */
  state: string;
  dict: I18nRecord;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 flex-1 min-w-[300px] w-full">
      <div className="flex flex-col justify-center w-full">
        <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex flex-row items-center gap-2 w-full">
          <span className="break-words min-w-0">{name}</span>
          {state && (
            <FaCheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
          )}
          {!state && (
            <FaExclamationCircle className="w-6 h-6 text-yellow-300 flex-shrink-0 mt-0.5" />
          )}
        </h1>
        <h1 className="text-xs font-light text-gray-900 dark:text-gray-400">
          {(dict.totem as I18nRecord).driver as string} {number}
        </h1>
      </div>
      <div className="flex flex-col justify-center gap-2 w-full">
        <div className="flex flex-col justify-center gap-1 w-full">
          <h1 className="text-xs font-bold text-gray-900 dark:text-gray-400">
            {(dict.totem as I18nRecord).state as string}:{" "}
            <span className="font-light">{state}</span>
          </h1>
        </div>
      </div>
    </div>
  );
}
