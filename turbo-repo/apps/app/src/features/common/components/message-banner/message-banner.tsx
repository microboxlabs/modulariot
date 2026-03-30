"use client";

export type MessageBannerVariant = "info" | "success" | "warning" | "error";

interface MessageBannerProps {
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly title: string;
  readonly description: string;
  readonly variant?: MessageBannerVariant;
  readonly label?: React.ReactNode;
}

const variantStyles: Record<MessageBannerVariant, string> = {
  info: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
  success:
    "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300",
  warning:
    "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300",
  error:
    "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300",
};

const iconStyles: Record<MessageBannerVariant, string> = {
  info: "text-blue-500 dark:text-blue-400",
  success: "text-green-500 dark:text-green-400",
  warning: "text-yellow-500 dark:text-yellow-400",
  error: "text-red-500 dark:text-red-400",
};

export default function MessageBanner({
  icon: Icon,
  title,
  description,
  variant = "info",
  label,
}: MessageBannerProps) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border ${variantStyles[variant]}`}
    >
      <Icon className={`w-5 h-5 shrink-0 ${iconStyles[variant]}`} />
      <div className="flex flex-col gap-0.5 flex-1">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs opacity-80">{description}</span>
      </div>
      {label && <div className="shrink-0">{label}</div>}
    </div>
  );
}
