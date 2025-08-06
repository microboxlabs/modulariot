export default function LoadableLabel({
  label,
  value,
  isLoading = false,
}: {
  label: string;
  value: string;
  isLoading?: boolean;
}) {
  return (
    <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap flex flex-col sm:flex-row text-sm font-light w-full">
      {label}
      <span className="mr-1">:</span>
      {isLoading ? (
        <div className="bg-gray-500 text-gray-500 animate-pulse whitespace-nowrap rounded-full flex-grow w-full">
          Loading...
        </div>
      ) : (
        <span className="text-gray-800 dark:text-gray-200 whitespace-nowrap flex-grow">
          {value}
        </span>
      )}
    </span>
  );
}
