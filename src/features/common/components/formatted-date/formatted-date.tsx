import React from "react";

interface FormattedDateProps {
  date: string | Date | number | null | undefined;
  format?: "date" | "time" | "datetime" | "relative";
  locale?: string;
  timeZone?: string;
  className?: string;
  fallback?: string;
}

export const FormattedDate: React.FC<FormattedDateProps> = ({
  date,
  format = "datetime",
  locale = "es-CL",
  timeZone = "America/Santiago",
  className = "",
  fallback = "/",
}) => {
  const formatDate = (inputDate: string | Date | number): string => {
    try {
      const dateObj = new Date(inputDate);

      // Check if date is valid
      if (isNaN(dateObj.getTime())) {
        return fallback;
      }

      const now = new Date();
      const diffInHours =
        (now.getTime() - dateObj.getTime()) / (1000 * 60 * 60);

      switch (format) {
        case "date":
          return dateObj.toLocaleDateString(locale, {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });

        case "time":
          return dateObj.toLocaleTimeString(locale, {
            timeZone,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });

        case "relative":
          if (diffInHours < 1) {
            const diffInMinutes = Math.floor(diffInHours * 60);
            return `${diffInMinutes} min`;
          } else if (diffInHours < 24) {
            return `${Math.floor(diffInHours)}h`;
          } else if (diffInHours < 168) {
            // 7 days
            const diffInDays = Math.floor(diffInHours / 24);
            return `${diffInDays}d`;
          } else {
            return dateObj.toLocaleDateString(locale, {
              timeZone,
              month: "short",
              day: "numeric",
            });
          }

        case "datetime":
        default:
          return dateObj.toLocaleString(locale, {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
      }
    } catch (error) {
      return fallback;
    }
  };

  // Handle null/undefined cases
  if (date === null || date === undefined) {
    return <span className={className}>{fallback}</span>;
  }

  // Handle empty string case
  if (typeof date === "string" && date.trim() === "") {
    return <span className={className}>{fallback}</span>;
  }

  const formattedDate = formatDate(date);

  return (
    <span
      className={className}
      title={date instanceof Date ? date.toISOString() : String(date)}
    >
      {formattedDate}
    </span>
  );
};

// Convenience components for common formats
export const FormattedDateOnly: React.FC<Omit<FormattedDateProps, "format">> = (
  props
) => <FormattedDate {...props} format="date" />;

export const FormattedTimeOnly: React.FC<Omit<FormattedDateProps, "format">> = (
  props
) => <FormattedDate {...props} format="time" />;

export const FormattedRelative: React.FC<Omit<FormattedDateProps, "format">> = (
  props
) => <FormattedDate {...props} format="relative" />;

export default FormattedDate;
