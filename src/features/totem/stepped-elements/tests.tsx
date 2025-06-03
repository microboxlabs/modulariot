import ExclamationIcon from "@/features/icons/exclamation";
import okImage from "@assets/icons/totem/ok.gif";
import Image from "next/image";
import { useState } from "react";

export default function Tests({ setCurrentStep, currentStep }: { setCurrentStep: (step: number) => void, currentStep: number }) {
  const [testState, setTestState] = useState(false);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <Congratulation testState={testState} setTestState={setTestState} />
      <GotoBox testState={testState} setTestState={setTestState} />
    </div>
  );
}

function Congratulation({ testState, setTestState }: { testState: boolean, setTestState: (state: boolean) => void }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl p-20 gap-20 bg-white dark:bg-gray-800 w-full ${!testState ? "max-h-[100vh] opacity-100" : "max-h-0 opacity-0 hidden"}`}>
        <h1 className="text-6xl text-gray-900 dark:text-gray-100 w-[80%] text-center">Felicidades, has completado el proceso de registro.</h1>
        <Image
          className="w-[10vh] h-[10vh] animate-scale-in"
          src={okImage}
          alt="Ok"
          width={100}
          height={100}
          />
        <h1 className="text-4xl text-red-600 dark:text-red-500 w-[80%] text-center">* Recuerda decirle a tu compañero conductor que realice el proceso de registro.</h1>
        <button onClick={() => {
          console.log("testState", testState);
          setTestState(true);
        }} className="text-lg bg-blue-500 text-white px-4 py-2 rounded-2xl w-full h-20 flex items-center justify-center gap-2">
          <p className="text-3xl font-light">Continuar</p>
        </button>
      </div>
  );
}

/*
{gpsValidationType === "ok" && <CheckCircleIcon />}
          {gpsValidationType === "warning" && <ExclamationIcon />}
          {gpsValidationType === "error" && <ErrorCircleIcon />}
          {gpsValidationType === undefined && <EllipseIcon />}
*/

function GotoBox({ testState, setTestState }: { testState: boolean, setTestState: (state: boolean) => void }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl p-20 gap-20 bg-white dark:bg-gray-800 w-full ${testState ? "animate-show-flex-middle" : "max-h-0 opacity-0 hidden"}`}>
        <div className="flex flex-col items-center justify-center w-full gap-2">
          <h1 className="text-5xl text-gray-600 dark:text-gray-400 w-[80%] text-center font-light">Ahora diríjase al modulo:</h1>
          <h1 className="text-[7vh] text-gray-900 dark:text-gray-100 w-[80%] text-center">03</h1>
          <div className="flex flex-col items-center justify-center w-full gap-5">
            <h1 className="text-5xl text-gray-800 dark:text-gray-200 w-[80%] text-center">Para tomar su test:</h1>
            <div className="flex flex-col items-start justify-center gap-5">
              <h1 className="text-5xl text-gray-600 dark:text-gray-400 whitespace-nowrap font-light flex flex-row justify-center items-center gap-5"><ExclamationIcon height={50} width={50} /> Test de drogas</h1>
              <h1 className="text-5xl text-gray-600 dark:text-gray-400 whitespace-nowrap font-light flex flex-row justify-center items-center gap-5"><ExclamationIcon height={50} width={50}/> Test de somnolencia</h1>
              <h1 className="text-5xl text-gray-600 dark:text-gray-400 whitespace-nowrap font-light flex flex-row justify-center items-center gap-5"><ExclamationIcon height={50} width={50}/> Test de alcohol</h1>
            </div>
          </div>
        </div>
        <button onClick={() => window.location.reload()} className="text-lg bg-blue-500 text-white px-4 py-2 rounded-2xl w-full h-20 flex items-center justify-center gap-2">
          <p className="text-3xl font-light">Finalizar</p>
        </button>
      </div>
  );
}

const styles = `
@keyframes scale-in {
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
}

.animate-scale-in {
  animation: scale-in 0.5s ease-out forwards;
}

.animate-scale-in img {
  animation: none !important;
  animation-play-state: paused !important;
  animation-iteration-count: 1 !important;
  animation-fill-mode: forwards !important;
  animation-direction: normal !important;
  animation-delay: 0s !important;
  animation-duration: 0s !important;
  animation-timing-function: linear !important;
  animation-name: none !important;
}
`;

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}