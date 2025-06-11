import { IoMdPin } from "react-icons/io";
import Huella from "./stepped-elements/huella";
import Rut from "./stepped-elements/rut";
import { FaBell, FaFingerprint, FaIdCard } from "react-icons/fa";
import TripInformation from "./stepped-elements/trip-information";
import { RxCheck } from "react-icons/rx";
import Tests from "./stepped-elements/tests";
import { I18nRecord } from "../i18n/i18n.service.types";
import React, { useState } from "react";
import SovosDeps from "../task-forms/components/sovos-deps/sovos-deps";

export default function Stepped({
  setCurrentStep,
  currentStep,
  dict,
  deviceId,
  deviceLocation,
}: {
  setCurrentStep: (step: number) => void;
  currentStep: number;
  dict: I18nRecord;
  deviceId: string | null;
  deviceLocation: string | null;
}) {
  const [pluginReady, setPluginReady] = useState(false);
  const [rutData, setRutData] = useState<{ rut: string } | null>(null);
  const [biometricResult, setBiometricResult] = useState<any>(null);
  const [rut, setRut] = useState("");
  const [tripData, setTripData] = useState<{ trip: any } | null>(null);

  const steps = [
    {
      interface: (
        <Rut
          setCurrentStep={setCurrentStep}
          currentStep={currentStep}
          dict={dict}
          onRutValidated={setRutData}
          rut={rut}
          setRut={setRut}
        />
      ),
      title: (dict.totem as I18nRecord).rut_ingress as string,
      icon: (
        <FaIdCard className="w-[3vh] h-[3vh] portrait:w-[5vw] portrait:h-[5vw]" />
      ),
    },
    {
      interface: (
        <Huella
          setCurrentStep={setCurrentStep}
          currentStep={currentStep}
          dict={dict}
          rutData={rutData}
          pluginReady={pluginReady}
          onBiometricResult={setBiometricResult}
        />
      ),
      title: (dict.totem as I18nRecord).fingerprint_scan as string,
      icon: (
        <FaFingerprint className="w-[3vh] h-[3vh] portrait:w-[5vw] portrait:h-[5vw]" />
      ),
    },
    {
      interface: (
        <TripInformation
          setCurrentStep={setCurrentStep}
          currentStep={currentStep}
          dict={dict}
          deviceId={deviceId}
          deviceLocation={deviceLocation}
          rut={rut}
          biometricResult={biometricResult}
          tripData={tripData}
          setTripData={setTripData}
        />
      ),
      title: (dict.totem as I18nRecord).assigned_trip as string,
      icon: (
        <IoMdPin className="w-[3vh] h-[3vh] portrait:w-[5vw] portrait:h-[5vw]" />
      ),
    },
    {
      interface: (
        <Tests
          dict={dict}
          tripData={tripData}
          setRutData={setRutData}
          setCurrentStep={setCurrentStep}
        />
      ),
      title: (dict.totem as I18nRecord).tests as string,
      icon: (
        <FaBell className="w-[3vh] h-[3vh] portrait:w-[5vw] portrait:h-[5vw]" />
      ),
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-10 p-10 relative">
      {/* Stepper */}
      <div className="flex justify-center portrait:justify-between flex-row gap-10 w-[90%]">
        <StepperMarker
          id={0}
          selected={currentStep === 0}
          text={steps[0].title}
          icon={steps[0].icon}
          current_step={currentStep}
          onClick={() => currentStep > 0 && setCurrentStep(0)}
        />
        <StepperMarker
          id={1}
          selected={currentStep === 1}
          text={steps[1].title}
          icon={steps[1].icon}
          current_step={currentStep}
          onClick={() => currentStep > 1 && biometricResult && setCurrentStep(1)}
        />
        <StepperMarker
          id={2}
          selected={currentStep === 2}
          text={steps[2].title}
          icon={steps[2].icon}
          current_step={currentStep}
          onClick={() => currentStep > 2 && biometricResult && tripData?.trip && setCurrentStep(2)}
        />
        <StepperMarker
          id={3}
          selected={currentStep === 3}
          text={steps[3].title}
          icon={steps[3].icon}
          current_step={currentStep}
          onClick={() => currentStep > 3 && setCurrentStep(3)}
        />
      </div>
      <div className="flex items-center justify-center w-full h-full">
        {steps[currentStep].interface}
      </div>
      <SovosDeps onReady={() => setPluginReady(true)} />
    </div>
  );
}

function StepperMarker({
  id,
  selected,
  text,
  icon,
  current_step,
  onClick,
}: {
  id: number;
  selected: boolean;
  text: string;
  icon: React.ReactNode;
  current_step: number;
  onClick: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-center flex-col gap-2 ${current_step > id ? "text-blue-300" : selected ? "text-blue-500" : "text-gray-500"}`}
      style={{ cursor: current_step > id ? "pointer" : "default" }}
      onClick={onClick}
    >
      <div
        className={`relative w-[8vh] portrait:w-[10vw] h-[8vh] portrait:h-[10vw] rounded-full border-4 flex items-center justify-center ${current_step > id ? "border-blue-300" : selected ? "border-blue-500" : "border-gray-500"}`}
      >
        {icon}
        <div
          className={`absolute top-[-1vh] portrait:top-[-1.5vw] right-[-1vh] portrait:right-[-1.5vw] w-[3vh] portrait:w-[5vw] h-[3vh] portrait:h-[5vw] bg-blue-300 rounded-full transition-opacity duration-300 ${current_step > id ? "opacity-100" : "opacity-0"}`}
        >
          <RxCheck className="w-full h-full text-blue-900" />
        </div>
      </div>
      <p className="text-[2vh] portrait:text-[2vw] font-light whitespace-nowrap">
        {text}
      </p>
    </div>
  );
}
