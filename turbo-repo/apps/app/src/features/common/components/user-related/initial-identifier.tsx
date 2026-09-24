const BASE_CLASSES =
  "shrink-0 rounded-full bg-white dark:bg-gray-500 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 flex items-center justify-center";

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
      className={size ? BASE_CLASSES : `w-10 h-10 ${BASE_CLASSES}`}
      style={size ? { width: size, height: size, fontSize: size * 0.4 } : undefined}
    >
      {name[0].toUpperCase()}
    </div>
  );
}
