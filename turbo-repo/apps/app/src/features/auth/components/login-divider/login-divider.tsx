export type LoginDividerProps = Readonly<{
  /** Text to display in the divider */
  text: string;
}>;

export default function LoginDivider({ text }: LoginDividerProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
      <span className="text-xs font-light text-gray-400 dark:text-gray-700">
        {text}
      </span>
      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}
