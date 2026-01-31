export type LoginDividerProps = Readonly<{
  /** Text to display in the divider */
  text: string;
}>;

export default function LoginDivider({ text }: LoginDividerProps) {
  return (
    <div className="flex items-center gap-3 text-sm text-gray-500">
      <div className="h-px flex-1 bg-gray-300 dark:bg-gray-600" />
      <span>{text}</span>
      <div className="h-px flex-1 bg-gray-300 dark:bg-gray-600" />
    </div>
  );
}
