
// This button is made based on the base design of flowbite tailwind
export default function CustomBaseButton({
    children,
    onClick,
    disabled = false,
    fit = false

}: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    fit?: boolean
}) {
    return (<button 
        type="button"
        onClick={() => {
            onClick?.();
        }}
        disabled={disabled}
        className={`${ fit ? "w-fit" : "w-full"} bg-slate-0 text-slate-700 hover:bg-slate-200 font-medium rounded-lg px-5 py-2.5 text-sm dark:bg-slate-900 dark:hover:bg-slate-800 focus:outline-none flex flex-row justify-center items-center border border-slate-700 dark:border-slate-200 transition-colors duration-200 active:bg-slate-300 active:dark:bg-slate-700 shadow-sm shadow-slate-300 dark:shadow-slate-900 active:shadow-none`}
    >
        <div className="text-gray-900 dark:text-white flex flex-row items-center justify-center ">
            {children}
        </div>
    </button>);
}