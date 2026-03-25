"use client";

import { useState, useRef, useEffect } from "react";
import { SlOptionsVertical } from "react-icons/sl";
import { FaCheck } from "react-icons/fa";
import { Info } from "../types/notification-types";
import { ShowNotification } from "@/features/notifications/notification";
import InnerData from "./inner-data";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import InitialIdentifier from "../../user-related/initial-identifier";

/*
{
  is_read: false,
  user_id: 'deadpool@mintral.cl',
  id: 'aa2a1ca1-940f-4e64-9f58-279a6886e58e',
  message: 'This is a notification message',
  type: 'info',
  timestamp: '2025-06-23T17:06:23.988Z'
},
*/

export default function InfoCard({
  data,
  dictionary,
}: {
  data: Info;
  dictionary: I18nRecord;
}) {
  const [showOptions, setShowOptions] = useState(false);
  const [isRead, setIsRead] = useState(data.is_read);
  const optionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showOptions) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element;
      if (
        optionsRef.current &&
        !optionsRef.current.contains(target) &&
        !target.closest("[data-options-button]")
      ) {
        setShowOptions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showOptions]);

  let message = data.message;

  try {
    message = JSON.parse(data.message);
  } catch (e) {
    message = data.message;
  }

  return (
    <div
      onClick={async () => {
        const response = await fetch(`/app/api/notifications/mark-as-read`, {
          method: "PUT",
          body: JSON.stringify({ id: data.id }),
        });

        if (response.ok) {
          // restart page
          // if the action has a url this should be a redirect
          setIsRead(true);
          if (data.url) {
            window.location.href = data.url;
          }
        } else {
          ShowNotification({
            type: "error",
            message: "Failed to mark notification as read",
          });
        }
      }}
      className={`flex items-center flex-row gap-2 rounded-lg p-2 transition-all duration-300 cursor-pointer ${isRead ? "bg-gray-200 dark:bg-gray-800" : "bg-blue-200 dark:bg-blue-900"} border border-transparent hover:border-blue-500 dark:hover:border-blue-300`}
    >
      <InitialIdentifier name={data.user_id} />
      <div className="flex flex-row justify-between items-center w-full">
        {/* Inner content */}
        <div className="flex flex-col">
          <div className="text-sm font-light text-gray-800 dark:text-gray-200">
            {typeof message === "object" ? (
              <InnerData data={message} dictionary={dictionary} />
            ) : (
              message
            )}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {new Date(data.timestamp).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "numeric",
              hour12: true,
            })}
          </div>
        </div>
        {/* Options */}
        <div className="flex flex-row gap-2">
          <div>
            <div
              className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 p-2 rounded-full transition-all duration-300 cursor-pointer"
              data-options-button
              onClick={(e) => {
                e.stopPropagation();
                setShowOptions(!showOptions);
              }}
            >
              <SlOptionsVertical />
            </div>
            {showOptions && (
              <div className="relative">
                <div
                  ref={optionsRef}
                  className="absolute top-2 right-0 rounded-md bg-gray-200 dark:bg-gray-700 flex flex-col overflow-hidden z-50 opacity-100 select-none"
                >
                  {/*
                  <div className="font-light text-sm px-4 py-2 text-gray-700 dark:text-gray-200 whitespace-nowrap flex flex-row items-center gap-2 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600">
                    <FaEye />
                    View
                  </div>
                  */}
                  <div
                    className="font-light text-sm px-4 py-2 text-gray-700 dark:text-gray-200 whitespace-nowrap flex flex-row items-center gap-2 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const response = await fetch(
                        `/app/api/notifications/mark-as-read`,
                        {
                          method: "PUT",
                          body: JSON.stringify({ id: data.id }),
                        }
                      );

                      if (response.ok) {
                        // restart page
                        setIsRead(true);
                      } else {
                        ShowNotification({
                          type: "error",
                          message: "Failed to mark notification as read",
                        });
                      }
                    }}
                  >
                    <FaCheck />
                    Mark as read
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
