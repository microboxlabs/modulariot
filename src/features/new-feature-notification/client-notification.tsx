"use client";

import { useState, useEffect } from "react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import { Button, Checkbox, Label } from "flowbite-react";
import { FaGift } from "react-icons/fa6";
import Image from "next/image";
import { tr } from "../i18n/tr.service";
import { usePathname } from "next/navigation";
import { getFeatureDescriptors, typeDescriptor } from "./new-features";
import GeneralSlider from "./general-slider";
import { convertSegmentPathToStaticExportFilename } from "next/dist/shared/lib/segment-cache/segment-value-encoding";

export enum FeatureState {
  Dismissed,
  DismissedWithCheck,
  Accepted,
  Declined,
}

export default function ClientNotification({
  dict,
}: {
  readonly dict: I18nRecord;
}) {
  const [lastPath, setLastPath] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean | null>(false); // This will be true if the element dont exists in localStorage or if it exists but is not marked as not show again
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isGeneralSlider, setIsGeneralSlider] = useState(false);

  const pathname = usePathname();
  const this_path = pathname.split("/")[2];

  const features = getFeatureDescriptors({ dict });
  const selected_feature = features[this_path as keyof typeof features];

  // console.log("")

  useEffect(() => {
    // Reset states when path changes
    setIsGeneralSlider(false);
    setShowModal(false);

    const stored = localStorage.getItem(this_path);
    const parsed_stored = stored ? JSON.parse(stored) : null;
    const general_slider = localStorage.getItem("general_slider");

    if (
      general_slider === null ||
      JSON.parse(general_slider).state === FeatureState.Dismissed.toString() ||
      JSON.parse(general_slider).id != features[""].id
    ) {
      setShowModal(true);
      setIsGeneralSlider(true);
      return;
    }

    if (features[this_path as keyof typeof features] === undefined) {
      return;
    }

    if (
      parsed_stored === null ||
      parsed_stored.state === FeatureState.Declined.toString() ||
      parsed_stored.state === FeatureState.Dismissed.toString() ||
      parsed_stored.id != features[this_path as keyof typeof features].id
    ) {
      console.log("show modal");
      setShowModal(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (lastPath !== this_path) {
      setLastPath(this_path);
    }
  }, [this_path]);

  if (selected_feature === undefined && !isGeneralSlider) {
    return <div></div>;
  }

  function handle_accept() {
    localStorage.setItem(
      `${this_path}`,
      stringifiedValue(features[""].id, FeatureState.Accepted)
    );
    setShowModal(null);
  }

  function handle_decline() {
    localStorage.setItem(
      `${this_path}`,
      stringifiedValue(features[""].id, FeatureState.Declined)
    );
    setShowModal(null);
  }

  function handle_dismiss() {
    const stateToSet = dontShowAgain
      ? FeatureState.DismissedWithCheck
      : FeatureState.Dismissed;
    localStorage.setItem(
      `${this_path}`,
      stringifiedValue(selected_feature.id, stateToSet)
    );
    setShowModal(null);
  }

  // Dismiss without check

  if (isGeneralSlider) {
    return (
      <GeneralSlider
        selected_feature={{
          id: features[""].id,
          content: (isActive: boolean, slideIndex: number) =>
            typeof features[""].description === "function"
              ? features[""].description(isActive)
              : [features[""].description],
        }}
        onFinish={() => {
          localStorage.setItem(
            "general_slider",
            stringifiedValue(features[""].id, FeatureState.DismissedWithCheck)
          );
          setIsGeneralSlider(false);
          setShowModal(null);
        }}
        dict={dict}
      />
    );
  } else {
    return (
      <AbsoluteModal
        maxWidth="1500px"
        maxHeight="90vh"
        height="fit-content"
        selected={showModal}
        setSelected={() => {}}
      >
        <div className="max-w-[700px] flex flex-col text-gray-700 overflow-hidden">
          <div className="w-full h-60 bg-blue-300 flex justify-center items-start text-blue-600 overflow-hidden p-4">
            <Image
              src={selected_feature.image}
              alt="New Functionality"
              className="rounded-lg"
            />
          </div>
          <div className="flex flex-col p-4 gap-2">
            <div className="flex flex-row justify-center items-center p-1 px-2 text-sm bg-blue-300 w-fit rounded-full gap-1 text-blue-800">
              <FaGift className="h-4 w-4" /> {tr("new_functionality.new", dict)}
            </div>
            <div className="flex flex-col gap-2 dark:text-gray-200">
              <h1 className="text-2xl text-left w-full font-bold leading-tight">
                {"title" in selected_feature ? selected_feature.title : ""}
              </h1>
              {typeof selected_feature.description === "function"
                ? selected_feature.description(true)
                : selected_feature.description}
            </div>
            <div className="flex flex-col gap-2">
              {selected_feature.type === typeDescriptor.Selectable ? (
                <div className="flex flex-col md:flex-row gap-2">
                  <Button
                    color="blue"
                    className="w-full"
                    onClick={handle_accept}
                  >
                    {tr("new_functionality.i_want_to_try", dict)}
                  </Button>
                  <Button
                    color="alternative"
                    className="w-full bg-transparent dark:bg-transparent dark:hover:bg-gray-600 dark:text-gray-200 dark:border-gray-400"
                    onClick={handle_decline}
                  >
                    {tr("new_functionality.not_interested", dict)}
                  </Button>
                </div>
              ) : (
                <div className="pt-2 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remember"
                      checked={dontShowAgain}
                      onChange={(e) => setDontShowAgain(e.target.checked)}
                    />
                    <Label htmlFor="remember">
                      {tr("new_functionality.dont_show_again", dict)}
                    </Label>
                  </div>
                  <Button
                    color="blue"
                    className="w-full"
                    onClick={handle_dismiss}
                  >
                    {tr("new_functionality.continue", dict)}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </AbsoluteModal>
    );
  }
}

function stringifiedValue(id: string, state: FeatureState) {
  return JSON.stringify({
    id: id,
    state: state.toString(),
  });
}
