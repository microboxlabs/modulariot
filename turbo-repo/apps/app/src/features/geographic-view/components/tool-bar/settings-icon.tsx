export default function SettingsIcon({
  open,
  setOpen,
  isDark = false,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  isDark?: boolean;
}) {
  return (
    <div
      className={`transition-all duration-300 w-10 h-10 rounded-md pointer-events-auto cursor-pointer flex items-center justify-center gap-1 overflow-visible group border-2 hover:border-blue-500 ${!isDark ? "border-gray-500" : "border-gray-300"}  ${open ? "bg-blue-500 rotate-[-90deg]" : `${!isDark ? "bg-gray-800" : "bg-white"}`}`}
      onClick={() => setOpen(!open)}
    >
      <style jsx>{`
        @keyframes bounce {
          0% {
            transform: translateY(0px);
          }
          33% {
            transform: translateY(-10px);
          }
          66% {
            transform: translateY(10px);
          }
          100% {
            transform: translateY(0px);
          }
        }
        .bounce-animation {
          animation: none;
        }
        .group:hover .bounce-animation {
          animation: bounce 2s ease-in-out infinite;
        }
        .group:hover div:nth-child(1) .bounce-animation {
          animation-delay: 0s;
        }
        .group:hover div:nth-child(2) .bounce-animation {
          animation-delay: 0.5s;
        }
        .group:hover div:nth-child(3) .bounce-animation {
          animation-delay: 1s;
        }
      `}</style>
      <div
        className={`w-1 ${!isDark ? "bg-gray-300" : "bg-gray-700"} rounded-full flex items-center justify-center overflow-visible transition-all duration-300 ${open ? "transform rotate-[45deg] h-[50%] translate-x-[0.19rem]" : "h-[70%]"}`}
      >
        <div
          className={`w-2 h-2 border ${!isDark ? "bg-gray-800 border-gray-300" : "bg-white border-gray-700"} rounded-full absolute transition-opacity duration-300 bounce-animation ${open ? "opacity-0" : ""}`}
        ></div>
      </div>
      <div
        className={`w-1 h-[70%] ${!isDark ? "bg-gray-300" : "bg-gray-700"} rounded-full flex items-center justify-center overflow-visible transition-all duration-300 ${open ? "opacity-0" : ""}`}
      >
        <div
          className={`w-2 h-2 border ${!isDark ? "bg-gray-800 border-gray-300" : "bg-white border-gray-700"} rounded-full absolute transition-opacity duration-300 bounce-animation ${open ? "opacity-0" : ""}`}
        ></div>
      </div>
      <div
        className={`w-1 ${!isDark ? "bg-gray-300" : "bg-gray-700"} rounded-full flex items-center justify-center overflow-visible transition-all duration-300 ${open ? "transform rotate-[-45deg] h-[50%] translate-x-[-0.19rem]" : "h-[70%]"}`}
      >
        <div
          className={`w-2 h-2 border ${!isDark ? "bg-gray-800 border-gray-300" : "bg-white border-gray-700"} rounded-full absolute transition-opacity duration-300 bounce-animation ${open ? "opacity-0" : ""}`}
        ></div>
      </div>
    </div>
  );
}
