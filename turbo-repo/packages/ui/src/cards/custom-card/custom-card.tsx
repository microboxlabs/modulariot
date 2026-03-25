export default function CustomCard({
  children,
  title = null,
  subtitle = null,
  style,
  className
}: Readonly<{
  children: React.ReactNode;
  title?: string | null;
  subtitle?: string | null;
  style?: {
    title: string;
    subtitle: string;
  };
  className?: string;
}>) {
  return (
    <div
      className={`text-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 p-3 rounded-lg flex flex-col ${
        title == null && subtitle == null ? "gap-0" : "gap-2"
      } text-center ${className}`}
    >
      <div className="flex flex-col gap-1">
        {title && (
          <p
            className={`text-md font-normal flex flex-row justify-between items-center leading-tight text-gray-700 whitespace-normal md:whitespace-nowrap ${style?.title}`}
          >
            {title}
          </p>
        )}
        {subtitle && (
          <p
            className={`text-sm font-normal leading-tight text-gray-500 w-fit ${style?.subtitle}`}
          >
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}