import { auth } from "@/auth";
import NotificationCard from "./notification-card";
import { getNotifications } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

export default async function Notifications() {
  const session = await auth();
  const data = await getNotifications(session?.user.ticket ?? "");

  const notifications = data.notifications;

  if (!notifications) {
    return (
      <div className="w-full h-full px-5 pb-5">
        <div className="w-full h-full dark:bg-gray-800 bg-gray-200 animate-pulse rounded-md"></div>
      </div>
    );
  }

  const sortedData = notifications.sort((a: any, b: any) => {
    const dateA = new Date(a.timestamp);
    const dateB = new Date(b.timestamp);
    return dateB.getTime() - dateA.getTime();
  });

  // Group notifications by day
  const groupedByDay = sortedData.reduce(
    (acc: Record<string, any[]>, item: any) => {
      const date = new Date(item.timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let dayKey;
      if (date.toDateString() === today.toDateString()) {
        dayKey = "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        dayKey = "Yesterday";
      } else {
        dayKey = date.toLocaleDateString("en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      }

      if (!acc[dayKey]) {
        acc[dayKey] = [];
      }
      acc[dayKey].push(item);
      return acc;
    },
    {} as Record<string, any[]>,
  );

  return (
    <div className="w-full h-full flex flex-col gap-5 px-5 pb-5 overflow-y-auto">
      {Object.entries(groupedByDay).map(([day, notifications]) => (
        <div key={day} className="flex flex-col gap-2">
          <h2 className="text-md font-light text-gray-700 dark:text-gray-300">
            {day}
          </h2>
          {Array.isArray(notifications) &&
            notifications.map((item: any, index: number) => (
              <NotificationCard key={`${day}-${index}`} data={item} />
            ))}
        </div>
      ))}
    </div>
  );
}
