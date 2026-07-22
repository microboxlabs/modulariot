export type ProfileOption = {
  id: string;
  title: string;
  description: string;
  count?: string;
};

export default function ProfileOptionCard({
  option,
  isSelected,
  onSelect,
}: Readonly<{
  option: ProfileOption;
  isSelected: boolean;
  onSelect: (id: string) => void;
}>) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.id)}
      className={`relative flex flex-col items-start gap-1 text-left p-3 px-4 rounded-lg border bg-white dark:bg-gray-800 transition-colors ${
        isSelected
          ? "border-blue-600 dark:border-blue-400"
          : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
      }`}
    >
      <div className="flex flex-row items-center justify-between w-full">
        <span className="font-medium text-md leading-tight text-gray-700 dark:text-white">
          {option.title}
        </span>
        <span
          className={`w-4 h-4 rounded-full border-2 ${
            isSelected
              ? "border-blue-600 bg-blue-600 dark:border-blue-400 dark:bg-blue-400"
              : "border-gray-300 dark:border-gray-600"
          }`}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-light text-gray-500 dark:text-gray-400">
          {option.description}
        </span>
        {option.count && (
          <span className="text-xs font-medium text-green-600 dark:text-green-400">
            {option.count}
          </span>
        )}
      </div>
    </button>
  );
}
