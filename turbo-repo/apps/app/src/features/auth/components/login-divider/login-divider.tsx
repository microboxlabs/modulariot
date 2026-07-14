export type LoginDividerProps = Readonly<{
  /** Text to display in the divider */
  text: string;
}>;

export default function LoginDivider({ text }: LoginDividerProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-600" />
      <span className="text-sm font-light text-gray-400 dark:text-gray-600">
        {text}
      </span>
      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-600" />
    </div>
  );
}
