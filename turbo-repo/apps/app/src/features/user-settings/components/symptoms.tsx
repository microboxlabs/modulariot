"use client";
import { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { Card, Label, ToggleSwitch } from "flowbite-react";
import { useState } from "react";

export default function SymptomsCard({ dict }: PropsWithI18nDict) {
  const [isCompanyNews, setCompanyNews] = useState<boolean>(false);
  const [isAccountActivity, setAccountActivity] = useState<boolean>(false);
  const [isMeetupsNearYou, setMeetupsNearYou] = useState<boolean>(false);
  const [isNewMessages, setNewMessages] = useState<boolean>(false);

  return (
    <Card>
      <div className="flow-root">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold dark:text-white">
              {tr("symptoms.config.title", dict)}
            </h3>
            <p className="text-sm font-normal text-gray-500 dark:text-gray-400">
              {tr("symptoms.config.description", dict)}
            </p>
          </div>
          <button
            type="button"
            className="py-2.5 px-5 text-sm font-medium text-white bg-blue-700 rounded-lg border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
          >
            {tr("symptoms.config.addButton", dict) || "Add Symptom"}
          </button>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          <div className="flex items-center justify-between py-4">
            <div className="flex grow flex-col">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                Company News
              </div>
              <div className="text-base font-normal text-gray-500 dark:text-gray-400">
                Get Themesberg news, announcements, and product updates
              </div>
            </div>
            <Label htmlFor="company-news" className="sr-only">
              Toggle company news
            </Label>
            <ToggleSwitch
              color="blue"
              checked={isCompanyNews}
              id="company-news"
              label=""
              name="company-news"
              onChange={() => setCompanyNews(!isCompanyNews)}
            />
          </div>
          <div className="flex items-center justify-between py-4">
            <div className="flex grow flex-col">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                Account Activity
              </div>
              <div className="text-base font-normal text-gray-500 dark:text-gray-400">
                Get important notifications about you or activity you ve missed
              </div>
            </div>
            <Label htmlFor="account-activity" className="sr-only">
              Toggle account activity
            </Label>
            <ToggleSwitch
              checked={isAccountActivity}
              id="account-activity"
              label=""
              name="account-activity"
              onChange={() => setAccountActivity(!isAccountActivity)}
            />
          </div>
          <div className="flex items-center justify-between py-4">
            <div className="flex grow flex-col">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                Meetups Near You
              </div>
              <div className="text-base font-normal text-gray-500 dark:text-gray-400">
                Get an email when a Dribbble Meetup is posted close to my
                location
              </div>
            </div>
            <Label htmlFor="meetups-near-you" className="sr-only">
              Toggle meetups near you
            </Label>
            <ToggleSwitch
              checked={isMeetupsNearYou}
              id="meetups-near-you"
              label=""
              name="meetups-near-you"
              onChange={() => setMeetupsNearYou(!isMeetupsNearYou)}
            />
          </div>
          <div className="flex items-center justify-between pt-4">
            <div className="flex grow flex-col">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                New Messages
              </div>
              <div className="text-base font-normal text-gray-500 dark:text-gray-400">
                Get Themsberg news, announcements, and product updates
              </div>
            </div>
            <Label htmlFor="new-messages" className="sr-only">
              Toggle new messages
            </Label>
            <ToggleSwitch
              checked={isNewMessages}
              id="new-messages"
              label=""
              name="new-messages"
              onChange={() => setNewMessages(!isNewMessages)}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
