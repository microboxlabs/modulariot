import { useState } from "react";
import AbsoluteModal from "../common/components/absolute-modal/absolute-modal";
import { Button } from "flowbite-react";
import { tr } from "../i18n/tr.service";
import { I18nRecord } from "../i18n/i18n.service.types";

export default function GeneralSlider({
  selected_feature,
  onFinish,
  dict,
}: Readonly<{
  selected_feature: {
    id: string;
    content: (isActive: boolean, slideIndex: number) => React.ReactNode[];
  };
  onFinish?: () => void;
  dict: I18nRecord;
}>) {
  const [slider, setSlider] = useState(0);
  const slideContent = selected_feature.content(true, slider);
  const slide_count = slideContent.length;

  const getIndicatorBackgroundClass = (index: number): string => {
    if (index === slider) return "bg-blue-600";
    if (index > slider) return "bg-blue-50";
    return "bg-blue-400";
  };

  return (
    <AbsoluteModal
      maxWidth="1500px"
      maxHeight="90vh"
      height="fit-content"
      selected={true}
      setSelected={() => {}}
    >
      <div className="h-[900px] w-[500px] bg-blue-300 flex flex-col overflow-hidden relative">
        <div className="flex flex-row gap-2 w-full mb-4 pt-4 px-4">
          {Array.from({ length: slide_count }).map((_, index) => (
            <div
              key={`${selected_feature.id}-indicator-${index}`}
              className={`transition-all duration-300 ease-in-out w-full h-1.5 bg-white rounded-full overflow-hidden border border-blue-200`}
            >
              <div
                className={`w-full h-full ${getIndicatorBackgroundClass(index)}`}
              ></div>
            </div>
          ))}
        </div>
        <div
          className="flex-1 flex flex-col overflow-hidden"
          key={`slide-${slider}`}
        >
          {slideContent[slider]}
        </div>
        <div className="flex justify-center items-center gap-2 flex-col mt-4 px-4 pb-4">
          <div className="flex flex-row gap-2 w-full ">
            {slider === 0 ? null : (
              <Button
                color="alternative"
                className="w-full bg-blue-300 border-2 border-blue-600 text-blue-600 hover:bg-blue-400 hover:text-white transition-colors duration-300"
                onClick={() => {
                  setSlider(slider - 1);
                }}
              >
                {tr("new_functionality.previous", dict)}
              </Button>
            )}
            {slider === slide_count - 1 ? (
              <Button
                className="w-full transition-colors duration-300"
                onClick={() => {
                  onFinish?.();
                }}
              >
                {tr("new_functionality.done", dict)}
              </Button>
            ) : (
              <Button
                className="w-full transition-colors duration-300"
                onClick={() => {
                  setSlider(slider + 1);
                }}
              >
                {tr("new_functionality.next", dict)}
              </Button>
            )}
          </div>
        </div>
      </div>
    </AbsoluteModal>
  );
}
