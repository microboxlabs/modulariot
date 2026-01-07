import { useState } from "react";
import AbsoluteModal from "../common/components/absolute-modal/absolute-modal";
import { Button } from "flowbite-react";

export default function GeneralSlider({
  selected_feature,
  onFinish,
}: {
  selected_feature: {
    id: string;
    content: (isActive: boolean, slideIndex: number) => React.ReactNode[];
  };
  onFinish?: () => void;
}) {
  const [slider, setSlider] = useState(0);
  const slideContent = selected_feature.content(true, slider);
  const slide_count = slideContent.length;

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
              key={index}
              className={`transition-all duration-300 ease-in-out w-full h-1.5 bg-white rounded-full overflow-hidden border border-blue-200`}
            >
              <div
                className={`w-full h-full ${
                  index === slider
                    ? "bg-blue-600"
                    : index > slider
                      ? "bg-blue-50"
                      : "bg-blue-400"
                }`}
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
            {slider != 0 ? (
              <Button
                color="alternative"
                className="w-full bg-blue-300 border-2 border-blue-600 text-blue-600 hover:bg-blue-400 hover:text-white transition-colors duration-300"
                onClick={() => {
                  setSlider(slider - 1);
                }}
              >
                Previous
              </Button>
            ) : null}
            {slider != slide_count - 1 ? (
              <Button
                className="w-full transition-colors duration-300"
                onClick={() => {
                  setSlider(slider + 1);
                }}
              >
                Next
              </Button>
            ) : (
              <Button
                className="w-full transition-colors duration-300"
                onClick={() => {
                  onFinish && onFinish();
                }}
              >
                Finish
              </Button>
            )}
          </div>
        </div>
      </div>
    </AbsoluteModal>
  );
}
