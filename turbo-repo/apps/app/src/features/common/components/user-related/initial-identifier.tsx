export default function InitialIdentifier({ name }: { name: string }) {
  return (
    <div className="w-10 h-10 shrink-0 rounded-full bg-white dark:bg-gray-500 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 flex items-center justify-center">
      {name[0].toUpperCase()}
    </div>
  );
}
