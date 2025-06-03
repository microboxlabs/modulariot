import { FaArrowRight } from "react-icons/fa";

export default function Welcome({ setCurrentOption, currentOption }: { setCurrentOption: (option: number) => void, currentOption: number }) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-10">
        {/* Title */}
        <div className="flex flex-col items-center justify-center p-3 rounded-md gap-10">
          <div className="flex flex-col items-center justify-center">
            <h1 className="text-[6vh] portrait:text-[6vw] font-bold text-gray-900 dark:text-white">
              Sean bienvenidos
            </h1>
            <p className="text-[4vh] portrait:text-[4vw] text-gray-500 ">Al totem de verificación</p>
          </div>
          {/* Form */}
          <div className="flex flex-col items-center justify-center w-full">
            <button onClick={() => setCurrentOption(currentOption + 1)} className="bg-blue-500 text-white p-4 rounded-2xl w-full flex items-center justify-center gap-2">
              <p className="text-[4vh] portrait:text-[4vw] font-light">Comenzar</p>
              <FaArrowRight className="w-[3vh] portrait:w-[3vw] h-[3vh] portrait:h-[3vw]" />
            </button>
          </div>
        </div>
      </div>
  );
}