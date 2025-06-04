import ExclamationIcon from "@/features/icons/exclamation";
import okImage from "@assets/icons/totem/ok.gif";
import Image from "next/image";
import { useState } from "react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function Tests({ dict }: { dict: I18nRecord }) {
  const [testState, setTestState] = useState(false);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <Congratulation
        testState={testState}
        setTestState={setTestState}
        dict={dict}
      />
      <GotoBox testState={testState} dict={dict} />
    </div>
  );
}

function Congratulation({
  testState,
  setTestState,
  dict,
}: {
  testState: boolean;
  setTestState: (state: boolean) => void;
  dict: I18nRecord;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl p-10 gap-10 bg-white dark:bg-gray-800 ${!testState ? "max-h-[100vh] opacity-100" : "max-h-0 opacity-0 hidden"} portrait:w-full`}
    >
      <h1 className="text-[4vh] portrait:text-[5vw] text-gray-900 dark:text-gray-100 text-center">
        {(dict.totem as I18nRecord).congratulations as string}
      </h1>
      <Image
        className="w-[15vh] h-[15vh] animate-scale-in"
        src={okImage}
        alt="Ok"
        width={100}
        height={100}
      />
      <h1 className="text-[2vh] portrait:text-[2.5vw] text-red-600 dark:text-red-500 w-[80%] text-center">
        * {(dict.totem as I18nRecord).remember_to_tell_your_companion as string}
      </h1>
      <button
        onClick={() => setTestState(true)}
        className="bg-blue-500 text-white p-4 rounded-2xl w-full flex items-center justify-center gap-2"
      >
        <p className="text-[4vh] portrait:text-[4vw] font-light">
          {(dict.totem as I18nRecord).continue as string}
        </p>
      </button>
    </div>
  );
}

function GotoBox({
  testState,
  dict,
}: {
  testState: boolean;
  dict: I18nRecord;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl p-10 gap-10 bg-white dark:bg-gray-800 ${testState ? "animate-show-flex-middle" : "max-h-0 opacity-0 hidden"} portrait:w-full`}
    >
      <div className="flex flex-col items-center justify-center gap-2">
        <h1 className="text-[3vh] portrait:text-[3vw] text-gray-600 dark:text-gray-400 text-center font-light whitespace-nowrap">
          {(dict.totem as I18nRecord).now_go_to_the_module as string}
        </h1>
        <h1 className="text-[5vh] portrait:text-[5vw] text-gray-900 dark:text-gray-100 text-center">
          03
        </h1>
        <div className="flex flex-col items-center justify-center w-full gap-5">
          <h1 className="text-[3vh] portrait:text-[4vw] text-gray-800 dark:text-gray-200 text-center">
            {(dict.totem as I18nRecord).take_your_test as string}
          </h1>
          <div className="flex flex-col items-start justify-center gap-2">
            <h1 className="text-[3vh] portrait:text-[3vw] text-gray-600 dark:text-gray-400 whitespace-nowrap font-light flex flex-row justify-center items-center gap-2">
              <ExclamationIcon height={40} width={40} />{" "}
              {(dict.totem as I18nRecord).drug_test as string}
            </h1>
            <h1 className="text-[3vh] portrait:text-[3vw] text-gray-600 dark:text-gray-400 whitespace-nowrap font-light flex flex-row justify-center items-center gap-2">
              <ExclamationIcon height={40} width={40} />{" "}
              {(dict.totem as I18nRecord).sleepiness_test as string}
            </h1>
            <h1 className="text-[3vh] portrait:text-[3vw] text-gray-600 dark:text-gray-400 whitespace-nowrap font-light flex flex-row justify-center items-center gap-2">
              <ExclamationIcon height={40} width={40} />{" "}
              {(dict.totem as I18nRecord).alcohol_test as string}
            </h1>
          </div>
        </div>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="bg-blue-500 text-white p-4 rounded-2xl w-full flex items-center justify-center gap-2"
      >
        <p className="text-[4vh] portrait:text-[4vw] font-light">
          {(dict.totem as I18nRecord).finish as string}
        </p>
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

if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}
