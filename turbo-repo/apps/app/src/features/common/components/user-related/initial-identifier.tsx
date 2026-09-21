export default function InitialIdentifier({
  name,
  size,
}: {
  name: string;
  /** Real pixel size instead of the default 40px — avoid `scale()`-ing this
   *  component instead, which distorts its border/text crispness. */
  size?: number;
}) {
  return (
    <div
      className={
        size
          ? "rounded-full border border-gray-200 bg-white dark:border-transparent dark:bg-gray-500 text-gray-800 dark:text-gray-200 flex items-center justify-center"
          : "w-10 h-10 rounded-full border border-gray-200 bg-white dark:border-transparent dark:bg-gray-500 text-gray-800 dark:text-gray-200 flex items-center justify-center"
      }
      style={size ? { width: size, height: size, fontSize: size * 0.4 } : undefined}
    >
      {name[0].toUpperCase()}
    </div>
  );
}
