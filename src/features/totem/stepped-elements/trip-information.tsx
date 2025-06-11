import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useEffect, useState } from "react";
import { FaExclamationCircle, FaCheckCircle } from "react-icons/fa";

export default function TripInformation({
  setCurrentStep,
  currentStep,
  dict,
  deviceId,
  deviceLocation,
  rut,
  biometricResult,
  tripData,
  setTripData,
}: {
  setCurrentStep: (step: number) => void;
  currentStep: number;
  dict: I18nRecord;
  deviceId: string | null;
  deviceLocation: string | null;
  rut: string;
  biometricResult: any;
  tripData: any;
  setTripData: (tripData: any) => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, _setError] = useState<string | null>(null);

  // Use biometricResult for debugging or further logic
  if (biometricResult) {
    console.log("biometricResult in TripInformation:", biometricResult);
  }

  useEffect(() => {
    /* const verifyBiometric = async () => {
      if (!deviceId || !deviceLocation) return;

      try {
        const response = await fetch("/app/api/biometric/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            driverId: "required", // Replace with actual driver ID
            deviceId,
            deviceLocation,
            fingerprintData: biometricResult, // Add if available
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to verify biometric data");
        }

        const data = await response.json();
        console.log("Biometric verification result:", data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    verifyBiometric(); */
    console.log("tripData", tripData);
    if (!tripData) {
      //add 2 drivers to the tripData
      setTripData({
        trip: {
          rut,
          email: "jhon@gmail.com",
          phone: "+569 1234 5678",
          state:
            biometricResult && biometricResult.Erc === 0
              ? "Verificado"
              : "No verificado", //&& biometricResult.Rut === rut
          rut2: "12312312-3",
          email2: "jane@gmail.com",
          phone2: "+569 1234 5678",
          state2: "No verificado",
          client: "Jhon Doe",

          info: "Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.",
          origin: "Santiago",
          destination: "Valparaiso",
          schedule: "8:00 am - 16:00 pm",
        },
      });
    } else {
      setTripData({
        trip: {
          ...tripData.trip,
          state2:
            biometricResult && biometricResult.Erc === 0
              ? "Verificado"
              : "No verificado", //&& biometricResult.Rut === rut
        },
      });
    }
    setIsLoading(false);
    console.log("tripData", tripData);
  }, [deviceId, deviceLocation]);

  if (!deviceId || !deviceLocation) return null;
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl p-10 bg-gray-100 dark:bg-gray-800">
        <p className="text-[3vh] portrait:text-[4vw] text-gray-900 dark:text-gray-100">
          {(dict.totem as I18nRecord).loading as string}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl p-10 bg-gray-100 dark:bg-gray-800">
        <p className="text-[3vh] portrait:text-[4vw] text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl p-10 bg-gray-100 dark:bg-gray-800 w-[50%] portrait:w-full">
      <h1 className="text-[3vh] portrait:text-[4vw] text-gray-900 dark:text-gray-100">
        {(dict.totem as I18nRecord).trip_information as string}
      </h1>
      <hr className="w-full border-gray-300 dark:border-gray-700"></hr>
      <div className="flex flex-row items-stretch justify-between w-full my-[2vh]">
        <DriverInfo
          number={1}
          name={tripData?.trip?.rut}
          email={tripData?.trip?.email}
          phone={tripData?.trip?.phone}
          state={tripData?.trip?.state}
          dict={dict}
        />
        <DriverInfo
          number={2}
          name={tripData?.trip?.rut2}
          email={tripData?.trip?.email2}
          phone={tripData?.trip?.phone2}
          state={tripData?.trip?.state2}
          dict={dict}
        />
      </div>
      <hr className="w-full border-gray-300 dark:border-gray-700"></hr>
      {tripData?.trip?.info && (
        <div className="flex flex-row items-stretch justify-center gap-3 w-full my-[2vh]">
          <div className="flex flex-col justify-center gap-[1vh] w-full">
            <h1 className="text-[2vh] portrait:text-[3vw] font-light text-gray-900 dark:text-gray-100">
              {(dict.totem as I18nRecord).trip_information as string}
            </h1>
            <div className="flex flex-col justify-center gap-1 w-full">
              <h1 className="text-[1.5vh] portrait:text-[2vw] font-bold text-gray-900 dark:text-gray-400">
                {(dict.totem as I18nRecord).trip_information_client as string}:{" "}
                <span className="font-light">{tripData?.trip?.info}</span>
              </h1>
              <h1 className="text-[1.5vh] portrait:text-[2vw] font-bold text-gray-900 dark:text-gray-400">
                {((dict.totem as I18nRecord)
                  .trip_information_origin_destination as string) + ": "}
                <span className="font-light">
                  {tripData?.trip?.origin} - {tripData?.trip?.destination}
                </span>
              </h1>
              <h1 className="text-[1.5vh] portrait:text-[2vw] font-bold text-gray-900 dark:text-gray-400">
                {(dict.totem as I18nRecord).trip_information_schedule as string}
                : <span className="font-light">{tripData?.trip?.schedule}</span>
              </h1>
            </div>
          </div>
        </div>
      )}
      {!tripData?.trip?.info && (
        <div className="flex flex-col justify-center gap-2 portrait:gap-7 w-full my-[2vh]">
          <h1 className="text-[2vh] portrait:text-[3vw] font-light text-red-500 dark:text-red-500">
            {(dict.totem as I18nRecord).no_trip_information as string}
          </h1>
        </div>
      )}
      <button
        onClick={() => setCurrentStep(currentStep + 1)}
        className="bg-blue-500 text-white p-4 rounded-2xl w-full flex items-center justify-center"
      >
        <p className="text-[4vh] portrait:text-[4vw] font-light">
          {(dict.totem as I18nRecord).continue as string}
        </p>
      </button>
    </div>
  );
}

function DriverInfo({
  number,
  name,
  email,
  phone,
  state,
  dict,
}: {
  number: number;
  name: string;
  email: string;
  phone: string;
  state: string;
  dict: I18nRecord;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 portrait:gap-7 w-full">
      <div className="flex flex-col justify-center w-full">
        <h1 className="text-[3vh] portrait:text-[3vw] font-bold text-gray-900 dark:text-gray-100 flex flex-row items-center gap-2">
          {name}
          {state === "Verificado" && (
            <FaCheckCircle className="w-6 h-6 text-green-500" />
          )}
          {state === "No verificado" && (
            <FaExclamationCircle className="w-6 h-6 text-yellow-300" />
          )}
        </h1>
        <h1 className="text-[1.5vh] portrait:text-[2vw] font-light text-gray-900 dark:text-gray-400">
          {(dict.totem as I18nRecord).driver as string} {number}
        </h1>
      </div>
      <div className="flex flex-col justify-center gap-3 w-full">
        <h1 className="text-[2vh] portrait:text-[2.5vw] font-bold text-gray-900 dark:text-gray-100">
          {(dict.totem as I18nRecord).contact_information as string}
        </h1>
        <div className="flex flex-col justify-center gap-[1vh] w-full">
          <h1 className="text-[1.5vh] portrait:text-[2vw] font-bold text-gray-900 dark:text-gray-400">
            {(dict.totem as I18nRecord).email as string}:{" "}
            <span className="font-light">{email}</span>
          </h1>
          <h1 className="text-[1.5vh] portrait:text-[2vw] font-bold text-gray-900 dark:text-gray-400">
            {(dict.totem as I18nRecord).state as string}:{" "}
            <span className="font-light">{state}</span>
          </h1>
          <h1 className="text-[1.5vh] portrait:text-[2vw] font-bold text-gray-900 dark:text-gray-400">
            {(dict.totem as I18nRecord).phone as string}:{" "}
            <span className="font-light">{phone}</span>
          </h1>
          {/* <h1 className="text-[1.5vh] portrait:text-[2vw] font-bold text-gray-900 dark:text-gray-400">
            {(dict.totem as I18nRecord).rut as string}:{" "}
            <span className="font-light">{rut}</span>
          </h1> */}
        </div>
      </div>
    </div>
  );
}
