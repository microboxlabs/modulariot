import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { SlOptionsVertical } from "react-icons/sl";
import { HiBell, HiCheckCircle, HiClipboardList, HiHome } from "react-icons/hi";
import NotificationCard from "@/features/common/components/notification/notification-card";

/*
{
  name: "Rodrigo Seguel",
  timeStamp: "2025-06-17T10:00:00.000Z",
  read: false,
  type: "",
  data: {
    
  }
},
*/

export default async function SymptomsPage({
  params: { lang },
}: ParamsWithLang) {
  const [, dict] = await getDictionary(lang);

  const data = [
    {
      name: "Rodrigo Seguel",
      timeStamp: "2025-06-17T10:00:00.000Z",
      message: "You have a new notification",
      read: false,
    },
    {
      name: "Rodrigo Seguel",
      timeStamp: "2025-06-16T10:00:00.000Z",
      message: "You have a new notification",
      read: true,
    },
    {
      name: "Rodrigo Seguel",
      timeStamp: "2025-06-16T10:00:00.000Z",
      message: "You have a new notification",
      read: false,
    },
    {
      name: "Rodrigo Seguel",
      timeStamp: "2025-06-16T10:00:00.000Z",
      message: "You have a new notification",
      read: true,
    },
    {
      name: "Rodrigo Seguel",
      timeStamp: "2025-06-16T10:00:00.000Z",
      message: "You have a new notification",
      read: true,
    },
    {
      name: "Rodrigo Seguel",
      timeStamp: "2025-06-16T10:00:00.000Z",
      message: "You have a new notification",
      read: true,
    },
    {
      name: "Rodrigo Seguel",
      timeStamp: "2025-06-15T10:00:00.000Z",
      message: "You have a new notification",
      read: true,
    },
    {
      name: "Rodrigo Seguel",
      timeStamp: "2025-06-15T10:00:00.000Z",
      message: "You have a new notification",
      read: true,
    },
    {
      name: "Rodrigo Seguel",
      timeStamp: "2025-06-15T10:00:00.000Z",
      message: "You have a new notification",
      read: true,
    },
    {
      name: "Rodrigo Seguel",
      timeStamp: "2025-06-12T10:00:00.000Z",
      message: "You have a new notification",
      read: true,
    }
  ]

  // sort by day
  const sortedData = data.sort((a, b) => {
    const dateA = new Date(a.timeStamp);
    const dateB = new Date(b.timeStamp);
    return dateB.getTime() - dateA.getTime();
  });

  // Group notifications by day
  const groupedByDay = sortedData.reduce((acc, item) => {
    const date = new Date(item.timeStamp);
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
  }, {} as Record<string, typeof data>);

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900">
      {/* BREADCRUMB */}
      <div className="p-5 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 dark:text-white w-full">
        <Breadcrumb
          path={["home", "notifications"]}
          lang={lang}
          rootIcon={<HiHome className="mr-2 h-4 w-4" />}
          dict={dict["symptoms"] as I18nRecord}
        />
      </div>
      {/* BREADCRUMB */}
      {/* CONTENT */}
      <div className="w-full h-full flex flex-col gap-5 p-5 overflow-y-auto">
        {Object.entries(groupedByDay).map(([day, notifications]) => (
          <div key={day} className="flex flex-col gap-2">
            <h2 className="text-md font-light text-gray-700 dark:text-gray-300">{day}</h2>
            {notifications.map((item, index) => (
              <NotificationCard
                key={`${day}-${index}`}
                name={item.name}
                message={item.message}
                timeStamp={new Date(item.timeStamp).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "numeric",
                  hour12: true,
                })}
                read={item.read}
              />
            ))}
          </div>
        ))}
      </div>
      {/* CONTENT */}
    </div>
  );
}