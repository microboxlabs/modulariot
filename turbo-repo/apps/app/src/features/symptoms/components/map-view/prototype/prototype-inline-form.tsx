"use client";

import React, { useEffect, useState } from "react";
import { HiChevronLeft } from "react-icons/hi";

import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { TreatmentsRequest } from "@/app/api/treatments/route.type";

import { useSession } from "next-auth/react";
import { SympthomTemplateResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import PrototypeCallDriver from "./prototype-call-driver";
import WhatsAppContact from "../../blurrable-stepped-menu/menus/whatsapp-contact/whatsapp-contact";
import { FaPhoneAlt, FaWhatsapp } from "react-icons/fa";
import { requestTreatment } from "@/features/common/providers/client-api.provider";
import PrototypeIgnoreCondition from "./prototype-ignore-condition";
import PrototypeInvalidateSymptom from "./prototype-invalidate-symptom";
import { TiDelete } from "react-icons/ti";
import { MdBlock } from "react-icons/md";

/**
 * PROTOTYPE — inline variant of `blurrable-stepped-menu/symptom-form.tsx`.
 *
 * Identical menu wiring (state, preactions, effects) but rendered *inside* the
 * timeline side panel instead of a fixed full-screen blurred modal. Mirrors the
 * bento document viewer morph (`task-bento-form/bento-media-section.tsx`), where
 * the panel grows and swaps its content in place rather than opening a dialog.
 */
export default function PrototypeInlineForm({
  setIsMenuOpen,
  isMenuOpen,
  dict,
  selectedOption,
  treatmentData,
  treatments_templates,
}: {
  setIsMenuOpen: (isMenuOpen: boolean) => void;
  isMenuOpen: boolean;
  dict: I18nRecord;
  selectedOption: string;
  treatmentData: TreatmentsGeneralResponseItem | null;
  treatments_templates: SympthomTemplateResponse | null;
}) {
  const { data: session } = useSession();
  const userEmail = session?.user?.email ?? "";

  // call driver
  const [messageToCommunicate, setMessageToCommunicate] = useState<string>(
    treatments_templates?.data?.message ?? ""
  );
  // Kept for parity with the treatment payload; the call form no longer writes it.
  const [driverResponse] = useState<string>("");

  // ignore condition
  const [duration, setDuration] = useState<number>(0);
  const [scope, setScope] = useState<string>("");

  // invalidate symptom
  const [reason, setReason] = useState<string>("");

  const [treatmentRequest, setTreatmentRequest] = useState<TreatmentsRequest>({
    asset_id: treatmentData?.trip_info?.asset_id ?? "",
    assigned_to: userEmail,
    client_id: null,
    status: "active",
    symptom_id: treatmentData?.symptom_info?.id.toString() ?? "",
    treatment_type: "",
    trip_id: treatmentData?.trip_info?.trip_id ?? "",
    message: messageToCommunicate ?? "",
    driver_response: driverResponse ?? "",
    description: undefined,
    treatment_id: undefined,
  });

  useEffect(() => {
    setTreatmentRequest({
      ...treatmentRequest,
      message: messageToCommunicate,
    });
  }, [messageToCommunicate]);

  const menus = {
    call_driver: {
      title: (dict.symptoms as I18nRecord).call_driver,
      preactions: async () => {
        setTreatmentRequest({
          ...treatmentRequest,
          treatment_type: "llamar al conductor",
          status: "pending",
        });
        const response = await requestTreatment({
          ...treatmentRequest,
          treatment_type: "llamar al conductor",
          status: "pending",
        });
        setTreatmentRequest({
          ...treatmentRequest,
          treatment_id: response.treatment_id,
        });
      },
      component: (
        <div className="w-full h-full flex flex-row items-start justify-center">
          <PrototypeCallDriver
            dict={dict as I18nRecord}
            treatmentData={treatmentData}
            messageToCommunicate={messageToCommunicate}
            setMessageToCommunicate={setMessageToCommunicate}
            treatmentRequest={treatmentRequest}
            setTreatmentRequest={setTreatmentRequest}
            setIsMenuOpen={setIsMenuOpen}
          />
        </div>
      ),
      icon: <FaPhoneAlt className="h-5 w-5" />,
    },
    contact_via_whatsapp: {
      title: (dict.symptoms as I18nRecord).contact_via_whatsapp,
      // No preaction: sending a WhatsApp doesn't pre-create a treatment record.
      preactions: undefined,
      component: (
        // key by trip so the form re-seeds its defaults if the selected treatment changes.
        <WhatsAppContact
          key={treatmentData?.trip_info?.trip_id ?? "no-trip"}
          dict={dict}
          treatmentData={treatmentData}
          setIsMenuOpen={setIsMenuOpen}
        />
      ),
      icon: <FaWhatsapp className="h-6 w-6" />,
    },
    ignore_condition: {
      title: (dict.symptoms as I18nRecord).ignore_condition,
      preactions: async () => {
        setTreatmentRequest({
          ...treatmentRequest,
          treatment_type: "ignorar condicion",
          status: "pending",
        });
        const response = await requestTreatment({
          ...treatmentRequest,
          treatment_type: "ignorar condicion",
          status: "pending",
        });
        setTreatmentRequest({
          ...treatmentRequest,
          treatment_id: response.treatment_id,
        });
      },
      component: (
        <PrototypeIgnoreCondition
          dict={dict as I18nRecord}
          treatmentData={treatmentData}
          setDuration={setDuration}
          duration={duration}
          scope={scope}
          setScope={setScope}
          treatmentRequest={treatmentRequest}
          setTreatmentRequest={setTreatmentRequest}
          setIsMenuOpen={setIsMenuOpen}
        />
      ),
      icon: <TiDelete className="h-8 w-8" />,
    },
    invalidate_symptom: {
      title: (dict.symptoms as I18nRecord).invalidate_symptom,
      preactions: async () => {
        setTreatmentRequest({
          ...treatmentRequest,
          treatment_type: "invalidar sintoma",
          status: "pending",
        });
        const response = await requestTreatment({
          ...treatmentRequest,
          treatment_type: "invalidar sintoma",
          status: "pending",
        });
        setTreatmentRequest({
          ...treatmentRequest,
          treatment_id: response.treatment_id,
        });
      },
      component: (
        <PrototypeInvalidateSymptom
          dict={dict}
          treatmentData={treatmentData}
          reason={reason}
          setReason={setReason}
          treatmentRequest={treatmentRequest}
          setTreatmentRequest={setTreatmentRequest}
          setIsMenuOpen={setIsMenuOpen}
        />
      ),
      icon: <MdBlock className="h-7 w-7" />,
    },
  };

  useEffect(() => {
    if (isMenuOpen) {
      const preaction = menus[selectedOption as keyof typeof menus]?.preactions;
      preaction && preaction();
    }
  }, [isMenuOpen]);

  useEffect(() => {
    setTreatmentRequest({
      ...treatmentRequest,
      message: messageToCommunicate,
    });
  }, [messageToCommunicate]);

  useEffect(() => {
    setTreatmentRequest({
      ...treatmentRequest,
      driver_response: driverResponse,
    });
  }, [driverResponse]);

  const selectedMenu = menus[selectedOption as keyof typeof menus];
  if (!selectedMenu) return null;

  const dictSy = dict.symptoms as I18nRecord;

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
      {/* Header — fixed, separated from the body by a bar */}
      <div className="shrink-0 flex items-center gap-1.5 border-b border-gray-200 dark:border-gray-700 px-3 py-2">
        <button
          type="button"
          onClick={() => setIsMenuOpen(false)}
          aria-label={dictSy.proto_back as string}
          className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <HiChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-medium text-gray-900 dark:text-white">
          {selectedMenu.title as string}
        </h1>
      </div>
      {/* Body — a fixed-height bento, no scroll (see prototype-form-kit). */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-3 bg-gray-50 dark:bg-gray-900">
        {selectedMenu.component}
      </div>
    </div>
  );
}
