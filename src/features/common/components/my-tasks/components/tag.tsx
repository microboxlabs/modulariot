export default function Tag({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-fit border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 rounded-lg py-1 px-2 text-sm font-light whitespace-nowrap flex gap-1 text-gray-500 dark:text-gray-300">
      <label className="font-light text-sm flex flex-row justify-center items-center gap-1">
        {children}
      </label>
    </div>
  );
}
