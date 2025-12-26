import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { FiMoreVertical } from "react-icons/fi";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useSearchParams } from "next/navigation";

// Debounce hook
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Common date/time utilities to reduce duplication
const createDateBounds = (fromParam: string, toParam: string) => {
  const startDate = new Date(fromParam);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(toParam);
  endDate.setHours(23, 59, 59, 999);

  return {
    startDate,
    endDate,
    totalDuration: endDate.getTime() - startDate.getTime(),
  };
};

const calculatePositionInRange = (
  timestamp: Date,
  startDate: Date,
  totalDuration: number
) => {
  return Math.max(
    0,
    Math.min(
      100,
      ((timestamp.getTime() - startDate.getTime()) / totalDuration) * 100
    )
  );
};

export type TimeRange = {
  startTime: string;
  endTime: string;
  startDate: Date;
  endDate: Date;
  duration: string;
  startPosition: number;
  endPosition: number;
};

type TimeRangeSelectorProps = {
  dict: I18nRecord;
  onChange?: (timeRange: TimeRange) => void;
  timeMarks: { start: string; end: string }[];
  movementTimes: { start: string; end: string }[];
};

type LineType = {
  endTime: string;
  movementIndex: number;
  startPosition: number;
  startTime: string;
  width: number;
};

function TimeRangeSelector({
  dict,
  onChange,
  timeMarks,
  movementTimes,
}: TimeRangeSelectorProps) {
  const searchParams = useSearchParams();
  const p_from = searchParams.get("start_date") || "";
  const p_to = searchParams.get("end_date") || "";

  // Immediate state for smooth UI
  const [startPosition, setStartPosition] = useState(0);
  const [endPosition, setEndPosition] = useState(100);
  const [isDragging, setIsDragging] = useState<
    "start" | "end" | "range" | null
  >(null);

  // Debounced positions - only these trigger onChange (150ms delay)
  const debouncedStartPosition = useDebouncedValue(startPosition, 150);
  const debouncedEndPosition = useDebouncedValue(endPosition, 150);

  // Calculate selected time range
  const calculateSelectedTimeRange = useCallback(
    (start: number, end: number) => {
      if (!p_from || !p_to)
        return {
          startTime: "",
          endTime: "",
          duration: "",
          startDate: new Date(),
          endDate: new Date(),
          startPosition: 0,
          endPosition: 100,
        };

      const { startDate, endDate, totalDuration } = createDateBounds(
        p_from,
        p_to
      );

      // Calculate selected start and end times based on position percentages
      const selectedStartTime = new Date(
        startDate.getTime() + (totalDuration * start) / 100
      );
      const selectedEndTime = new Date(
        startDate.getTime() + (totalDuration * end) / 100
      );

      // Calculate duration between selected points
      const selectedDuration =
        selectedEndTime.getTime() - selectedStartTime.getTime();

      // Calculate days, hours, and minutes
      const days = Math.floor(selectedDuration / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (selectedDuration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor(
        (selectedDuration % (1000 * 60 * 60)) / (1000 * 60)
      );

      const formatTime = (date: Date) => {
        return date.toLocaleString("es-ES", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      };

      // Format duration string
      let durationStr = "";
      if (days > 0) {
        durationStr += `${days}d `;
      }
      if (hours > 0) {
        durationStr += `${hours}h `;
      }
      durationStr += `${minutes}m`;

      return {
        startTime: formatTime(selectedStartTime),
        endTime: formatTime(selectedEndTime),
        startDate: selectedStartTime,
        endDate: selectedEndTime,
        duration: durationStr.trim(),
        startPosition: start,
        endPosition: end,
      };
    },
    [p_from, p_to]
  );

  // Immediate display range (for smooth UI)
  const displayRange = useMemo(
    () => calculateSelectedTimeRange(startPosition, endPosition),
    [calculateSelectedTimeRange, startPosition, endPosition]
  );

  // Debounced range for onChange callback
  const debouncedRange = useMemo(
    () =>
      calculateSelectedTimeRange(debouncedStartPosition, debouncedEndPosition),
    [calculateSelectedTimeRange, debouncedStartPosition, debouncedEndPosition]
  );

  // Call onChange only with debounced values
  useEffect(() => {
    if (onChange && debouncedRange.startTime && debouncedRange.endTime) {
      onChange(debouncedRange);
    }
  }, [onChange, debouncedRange]);

  // Responsive screen size detection
  const [screenSize, setScreenSize] = useState("medium");

  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setScreenSize("small");
      } else if (width < 1024) {
        setScreenSize("medium");
      } else {
        setScreenSize("large");
      }
    };

    updateScreenSize();
    window.addEventListener("resize", updateScreenSize);

    return () => window.removeEventListener("resize", updateScreenSize);
  }, []);

  // Generate time markers for the bar
  const generateTimeMarkers = useCallback(() => {
    if (!p_from || !p_to) return [];

    const { startDate, totalDuration } = createDateBounds(p_from, p_to);
    const markers = [];

    // Determine the number of markers based on screen size and duration
    const days = totalDuration / (1000 * 60 * 60 * 24);
    const hours = totalDuration / (1000 * 60 * 60);

    let maxMarkers;
    // Responsive marker count
    if (screenSize === "small") {
      maxMarkers = 4;
    } else if (screenSize === "medium") {
      maxMarkers = 5;
    } else {
      maxMarkers = 6;
    }

    let numberOfMarkers;
    let includeMinorMarkers = false;

    // Force minimum 6 markers for better visibility
    const minMarkers = 6;

    if (hours <= 12) {
      numberOfMarkers = Math.min(
        maxMarkers,
        Math.max(minMarkers, Math.floor(hours / 2))
      );
      includeMinorMarkers = screenSize === "large" && hours <= 8;
    } else if (days <= 1) {
      numberOfMarkers = Math.min(maxMarkers, Math.max(minMarkers, 4));
    } else if (days <= 3) {
      numberOfMarkers = Math.min(
        maxMarkers,
        Math.max(minMarkers, Math.floor(days * 2))
      );
    } else if (days <= 7) {
      numberOfMarkers = Math.min(
        maxMarkers,
        Math.max(minMarkers, Math.floor(days))
      );
    } else {
      numberOfMarkers = Math.min(maxMarkers, Math.max(minMarkers, 4));
    }

    // Ensure we have at least minMarkers but not more than maxMarkers
    numberOfMarkers = Math.max(
      minMarkers,
      Math.min(numberOfMarkers, maxMarkers)
    );

    // Add major markers - exclude borders (skip i=0 and i=numberOfMarkers)
    for (let i = 1; i < numberOfMarkers + 1; i++) {
      const position = (i / (numberOfMarkers + 1)) * 100;
      const markerTime = new Date(
        startDate.getTime() + (totalDuration * i) / (numberOfMarkers + 1)
      );

      const formatMarkerTime = (date: Date) => {
        if (hours <= 12) {
          return date.toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          });
        } else if (days <= 1) {
          return date.toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          });
        } else if (days <= 3) {
          return (
            date.toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "2-digit",
            }) +
            " " +
            date.toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
            })
          );
        } else if (days <= 7) {
          return (
            date.toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "2-digit",
            }) +
            " " +
            date.toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
            })
          );
        } else {
          return date.toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "2-digit",
          });
        }
      };

      markers.push({
        position,
        time: formatMarkerTime(markerTime),
        isMajor: true,
      });
    }

    // Add minor hour markers for very short durations (only on large screens)
    if (includeMinorMarkers && hours <= 8 && screenSize === "large") {
      const hourStep = Math.ceil(hours / 6); // Limit to ~6 minor markers
      for (let i = hourStep; i < hours; i += hourStep) {
        const position = (i / hours) * 100;

        // Ensure position is not too close to borders (10% margin) or existing markers
        if (position > 15 && position < 85) {
          const markerTime = new Date(startDate.getTime() + i * 60 * 60 * 1000);

          // Only add if not already covered by major markers
          const isAlreadyCovered = markers.some(
            (m) => Math.abs(m.position - position) < 8
          );
          if (!isAlreadyCovered) {
            markers.push({
              position,
              time: markerTime.toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              isMajor: false,
            });
          }
        }
      }
    }

    return markers.sort((a, b) => a.position - b.position);
  }, [p_from, p_to, screenSize]);

  const timeMarkers = generateTimeMarkers();

  // Unified line generation utility
  const generateLineSegments = useCallback(
    (marks: { start: string; end: string }[], indexKey: string) => {
      if (!marks || marks.length === 0 || !p_from || !p_to) return [];

      const { startDate, totalDuration } = createDateBounds(p_from, p_to);

      return marks
        .map((mark, index) => {
          const markStartTime = new Date(mark.start);
          const markEndTime = new Date(mark.end);

          const startPosition = calculatePositionInRange(
            markStartTime,
            startDate,
            totalDuration
          );
          const endPosition = calculatePositionInRange(
            markEndTime,
            startDate,
            totalDuration
          );
          const width = Math.max(0, endPosition - startPosition);

          if (width > 0 && startPosition < 100 && endPosition > 0) {
            return {
              startPosition,
              width,
              [indexKey]: index,
              startTime: mark.start,
              endTime: mark.end,
            };
          }
          return null;
        })
        .filter(Boolean);
    },
    [p_from, p_to]
  );

  const tripLines = generateLineSegments(timeMarks, "tripIndex");
  const movementLines = generateLineSegments(movementTimes, "movementIndex");

  // Generate trip indicators using common utilities
  const tripIndicators = useMemo(() => {
    if (!p_from || !p_to) return [];

    const { startDate, totalDuration } = createDateBounds(p_from, p_to);

    return timeMarks.map((trip, index) => {
      const tripStart = new Date(trip.start);
      const tripEnd = new Date(trip.end);

      const startPosition = calculatePositionInRange(
        tripStart,
        startDate,
        totalDuration
      );
      const endPosition = calculatePositionInRange(
        tripEnd,
        startDate,
        totalDuration
      );
      const width = Math.max(0, endPosition - startPosition);

      return {
        id: index,
        startPosition,
        endPosition,
        width,
        isVisible: width > 0 && startPosition < 100 && endPosition > 0,
        tripData: trip,
      };
    });
  }, [p_from, p_to, timeMarks]);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragDataRef = useRef({
    startX: 0,
    initialPosition: 0,
    initialStart: 0,
    initialEnd: 0,
  });

  const handleMouseDown = useCallback(
    (type: "start" | "end", e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(type);
      dragDataRef.current = {
        startX: e.clientX,
        initialPosition: type === "start" ? startPosition : endPosition,
        initialStart: startPosition,
        initialEnd: endPosition,
      };
    },
    [startPosition, endPosition]
  );

  const handleRangeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging("range");
      dragDataRef.current = {
        startX: e.clientX,
        initialPosition: 0,
        initialStart: startPosition,
        initialEnd: endPosition,
      };
    },
    [startPosition, endPosition]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const containerWidth = rect.width;
      const deltaX = e.clientX - dragDataRef.current.startX;
      const deltaPercentage = (deltaX / containerWidth) * 100;

      if (isDragging === "range") {
        // Move both indicators together maintaining their relative distance
        const rangeWidth =
          dragDataRef.current.initialEnd - dragDataRef.current.initialStart;
        const newStart = Math.max(
          0,
          Math.min(
            100 - rangeWidth,
            dragDataRef.current.initialStart + deltaPercentage
          )
        );
        const newEnd = newStart + rangeWidth;

        setStartPosition(newStart);
        setEndPosition(newEnd);
      } else {
        const newPosition = Math.max(
          0,
          Math.min(100, dragDataRef.current.initialPosition + deltaPercentage)
        );

        if (isDragging === "start") {
          // Ensure start position doesn't exceed end position (minimum 0.5% gap)
          setStartPosition(
            Math.min(newPosition, dragDataRef.current.initialEnd - 2)
          );
        } else if (isDragging === "end") {
          // Ensure end position doesn't go below start position (minimum 0.5% gap)
          setEndPosition(
            Math.max(newPosition, dragDataRef.current.initialStart + 2)
          );
        }
      }
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="w-full h-full flex flex-col gap-2">
      <div className="w-full flex justify-center items-center text-sm font-light">
        <div className="text-center w-full md:w-fit">
          <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
            {tr("signal_historic.duration", dict)}: {displayRange.duration}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
            {tr("signal_historic.selected_range", dict)}:{" "}
            {displayRange.startTime} - {displayRange.endTime}
          </div>
        </div>
      </div>

      {/* Selected time range display */}
      <div className="relative">
        {/* Time markers above the bar */}
        <div className="relative h-6 mb-1 hidden sm:block">
          {timeMarkers.map((marker, index) => (
            <div
              key={`time-${index}`}
              className={`absolute text-xs transform -translate-x-1/2 whitespace-nowrap text-gray-500 dark:text-gray-400 font-medium`}
              style={{
                left: `${marker.position}%`,
                top: marker.isMajor ? "0px" : "8px",
              }}
            >
              {marker.time}
            </div>
          ))}
        </div>

        {/* Time tick marks - positioned behind the main bar */}
        <div className="absolute inset-0 z-0 hidden sm:block">
          {timeMarkers.map((marker, index) => (
            <div
              key={`tick-${index}`}
              className={`absolute bg-gray-500 transform -translate-x-1/2 ${
                marker.isMajor ? "w-px h-4" : "w-px h-2"
              }`}
              style={{
                left: `${marker.position}%`,
                top: marker.isMajor ? "22px" : "25px",
              }}
            />
          ))}
        </div>

        <div
          ref={containerRef}
          className="w-full h-4 border border-gray-400 rounded-full overflow-visible flex items-center relative mx-0 bg-white z-10"
        >
          {/* Start indicator */}
          <div
            className="absolute w-4 h-5 bg-white border border-gray-500 rounded-sm flex items-center justify-center cursor-e-resize transform -translate-x-1/2 hover:bg-gray-50 transition-colors z-20"
            style={{ left: `${startPosition}%` }}
            onMouseDown={(e) => handleMouseDown("start", e)}
          >
            <FiMoreVertical className="text-xs" />
          </div>

          {/* End indicator */}
          <div
            className="absolute w-4 h-5 bg-white border border-gray-500 rounded-sm flex items-center justify-center cursor-e-resize transform -translate-x-1/2 hover:bg-gray-50 transition-colors z-20"
            style={{ left: `${endPosition}%` }}
            onMouseDown={(e) => handleMouseDown("end", e)}
          >
            <FiMoreVertical className="text-xs" />
          </div>

          {/* Movement line indicators from movementTimes */}
          {movementLines
            .filter((line) => line !== null)
            .map((line, index) => {
              // Type assertion since nulls are filtered out
              const movementLine = line as LineType;
              return (
                <div
                  key={`movement-line-${index}`}
                  className="absolute h-full bg-gray-200 z-5 rounded-full"
                  style={{
                    left: `${movementLine.startPosition}%`,
                    width: `${movementLine.width}%`,
                  }}
                  title={`Movement ${movementLine.movementIndex + 1}: ${movementLine.startTime} - ${movementLine.endTime}`}
                />
              );
            })}
          {/* Trip line indicators from timeMarks */}
          {tripLines.map((line, index) =>
            line ? (
              <div
                key={`trip-line-${index}`}
                className="absolute h-full bg-blue-500 z-8 rounded-full"
                style={{
                  left: `${line.startPosition}%`,
                  width: `${line.width}%`,
                }}
                title={`Trip ${Number(line.tripIndex) + 1}: ${line.startTime} - ${line.endTime}`}
              />
            ) : null
          )}

          {/* Selected range highlight */}
          <div
            className="absolute h-full bg-black opacity-20 rounded-full cursor-move hover:opacity-20 transition-opacity z-15"
            style={{
              left: `${startPosition}%`,
              width: `${endPosition - startPosition}%`,
            }}
            onMouseDown={handleRangeMouseDown}
          />
        </div>
      </div>
    </div>
  );
}

export default TimeRangeSelector;
