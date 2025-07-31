export default function InitialIdentifier({ name }: { name: string }) {
  return (
    <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-500 text-gray-800 dark:text-gray-200 flex items-center justify-center">
      {name[0].toUpperCase()}
    </div>
  );
}
