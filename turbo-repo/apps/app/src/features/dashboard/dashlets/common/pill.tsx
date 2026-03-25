export interface PillProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}

export function Pill({ label, active, onClick, icon }: Readonly<PillProps>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`no-drag inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
        active
          ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
          : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      }`}
    >
      {label}
      {icon}
    </button>
  );
}
