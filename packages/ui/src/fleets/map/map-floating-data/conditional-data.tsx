export default function ConditionalData({ label, value, classname }: { label: string; value: string | number; classname?: string }) {
  if (!value || value == "") return null;

  return (
    <div className={`text-sm text-gray-600 dark:text-gray-300 ${classname}`}>
      {label}: {value}
    </div>
  );
}
