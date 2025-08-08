export default function LoadableLabel({
  label,
  value,
  isLoading = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly isLoading?: boolean;
}) {
  return (
    <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap flex flex-row text-sm font-light w-full">
      {label}
      <span className="mr-1">:</span>
      {isLoading ? (
        <div className="bg-gray-500 text-gray-500 animate-pulse whitespace-nowrap rounded-full flex-grow w-full">
          Loading...
        </div>
      ) : (
        <span className="text-gray-800 dark:text-gray-200 flex-grow whitespace-normal">
          {value}
        </span>
      )}
    </span>
  );
}
