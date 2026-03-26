import { tr } from "../../i18n/tr.service";
import Image from "next/image";
import Fadeable from "../slider-components/fadeable";
import ReleaseView from "../../layout/components/release-view/release-view";
import { typeDescriptor } from "../new-features";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import signal_historic_gif from "@assets/images/new_features/signal-historic.gif";

export default function Slider(dict: I18nRecord) {
  return {
    id: "0.0",
    image: signal_historic_gif,
    description: (isActive: boolean) => [
      <div
        key="slide-1"
        className="w-full h-full justify-center items-center flex flex-col gap-2"
      >
        <Fadeable
          isActive={isActive}
          className="w-full flex flex-col"
          delayMs={200}
        >
          <div className="flex flex-row justify-start text-blue-200 dark:text-blue-50 font-light text-2xl">
            {tr("new_functionality.slider.new_features_appeared", dict)}
          </div>
        </Fadeable>
        <Fadeable
          isActive={isActive}
          className="w-full flex flex-col"
          delayMs={500}
        >
          <div className="flex flex-row justify-center text-blue-400 dark:text-blue-200 font-medium text-2xl">
            {tr("new_functionality.slider.new_features_appeared", dict)}
          </div>
        </Fadeable>
        <Fadeable
          isActive={isActive}
          className="w-full flex flex-col"
          delayMs={800}
        >
          <div className="flex flex-row justify-end text-blue-600 dark:text-blue-400 text-2xl font-bold">
            {tr("new_functionality.slider.new_features_appeared", dict)}
          </div>
        </Fadeable>
      </div>,
      <div
        key="slide-2"
        className="w-full h-full justify-center items-center flex flex-col gap-2 px-2"
      >
        <Fadeable isActive={isActive} className="w-full" delayMs={200}>
          <div>
            <div className="overflow-hidden border border-blue-100 rounded-md relative">
              <Image
                src={signal_historic_gif}
                alt="Pulse Historic"
                width={1000}
                key={isActive ? "active-2" : "inactive-2"}
              />
            </div>
            <p
              className={`text-xl font-bold text-blue-600 dark:text-blue-500 w-full flex justify-center mt-2 ${isActive ? "opacity-0 animate-fade-in-opacity ease-in-out" : "opacity-0"}`}
              style={isActive ? { animationDelay: "500ms" } : {}}
            >
              {tr("new_functionality.slider.test_pulse_historic_feature", dict)}
            </p>
            <p
              className={`text-sm text-gray-500 dark:text-gray-300 w-full text-center ${isActive ? "opacity-0 animate-fade-in-opacity ease-in-out" : "opacity-0"}`}
              style={isActive ? { animationDelay: "1000ms" } : {}}
            >
              {tr("new_functionality.slider.description", dict)}
            </p>
          </div>
        </Fadeable>
      </div>,
      <div
        key="slide-1"
        className="w-full h-full justify-center items-center flex flex-col gap-2 "
      >
        <Fadeable
          isActive={isActive}
          className="w-full flex flex-col"
          delayMs={200}
        >
          <div className="text-center text-gray-500 dark:text-gray-300 font-light text-xl">
            {tr("new_functionality.slider.learn_more", dict)}
          </div>
        </Fadeable>
        <Fadeable
          isActive={isActive}
          className="w-full flex flex-col"
          delayMs={800}
        >
          <ReleaseView className="text-2xl! text-blue-600! dark:text-blue-500!" />
        </Fadeable>
      </div>,
    ],
    type: typeDescriptor.Selectable, // This can be either "Dismissable" or "Selectable" for future implementations
  };
}
