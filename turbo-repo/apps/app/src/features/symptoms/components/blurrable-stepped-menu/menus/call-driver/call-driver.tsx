"use client";

import { Button, Checkbox, Select, Textarea, TextInput } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { useState } from "react";
import TagManager from "@/features/symptoms/components/tag-manager";
import { requestTreatment } from "@/features/common/providers/client-api.provider";
import { TreatmentsRequest } from "@/app/api/treatments/route.type";
import { BiLogoMicrosoftTeams } from "react-icons/bi";
import { useRouter } from "next/navigation";
import { ShowNotification } from "@/features/notifications/notification";

const sendTeamsCall = async (phoneNumber: string) => {
  // Get the phone number from the treatment request
  if (!phoneNumber) return;

  // Open Teams with the phone number parameter
  window.open(
    `https://teams.microsoft.com/l/call/0/0?users=4:${phoneNumber}`,
    "_blank"
  );
};

export default function CallDriver({
  dict,
  treatmentData,
  messageToCommunicate,
  setMessageToCommunicate,
  driverResponse,
  setDriverResponse,
  treatmentRequest,
  setTreatmentRequest,
  setIsMenuOpen,
}: {
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  messageToCommunicate: string;
  setMessageToCommunicate: (message: string) => void;
  driverResponse: string;
  setDriverResponse: (driverResponse: string) => void;
  treatmentRequest: TreatmentsRequest;
  setTreatmentRequest: (treatmentRequest: TreatmentsRequest) => void;
  setIsMenuOpen: (isMenuOpen: boolean) => void;
}) {
  const [selectedTags, setSelectedTags] = useState<Array<{ text: string }>>([]);
  const [inputValue, setInputValue] = useState("");
  const [callTarget, setCallTarget] = useState("target_driver");
  const [targetPhone, setTargetPhone] = useState("");
  const [resultado, setResultado] = useState("");
  const [notaLlamada, setNotaLlamada] = useState("");
  const [escalarA, setEscalarA] = useState("target_carrier");
  const [registrarEscalamiento, setRegistrarEscalamiento] = useState(true);

  const dictSy = dict.symptoms as I18nRecord;
  const targets = [
    "target_driver",
    "target_carrier",
    "target_ops",
    "target_mining",
    "target_other",
  ];
  const targetLabel = dictSy[callTarget] as string;
  const resultados = [
    "result_commits",
    "result_corrected",
    "result_rejects",
    "result_no_answer",
    "result_voicemail",
  ];
  const sinRespuesta =
    resultado === "result_no_answer" || resultado === "result_voicemail";
  const resultadoLabel = resultado ? (dictSy[resultado] as string) : "";
  const esConductor = callTarget === "target_driver";
  const telefonoLlamada = esConductor
    ? (treatmentData?.trip_info?.driver_contact ?? "")
    : targetPhone;

  const router = useRouter();

  const handleTagCreate = () => {
    if (inputValue.trim()) {
      setSelectedTags([...selectedTags, { text: inputValue.trim() }]);
      setInputValue("");
    }
  };

  const handleTagRemove = (index: number) => {
    const newTags = selectedTags.filter((_, i) => i !== index);
    setSelectedTags(newTags);
  };

  const predefinedTags = [
    { text: "Ruta con problemas" },
    { text: "Conductor problemático" },
    { text: "Prueba" },
  ];

  const buttons = [
    {
      color: "light",
      text: (dict.symptoms as I18nRecord).teams_call,
      text2: (dict.symptoms as I18nRecord).teams_call2,
      icon: <BiLogoMicrosoftTeams className="w-6 h-6 ml-2 mr-2" />,
      function: async () => {
        await sendTeamsCall(telefonoLlamada);
      },
    },
    {
      color: "blue",
      text: (dict.symptoms as I18nRecord).save_treatment,
      function: async () => {
        const response = await requestTreatment({
          ...treatmentRequest,
          driver_response:
            (resultadoLabel ? resultadoLabel : "") +
            (notaLlamada.trim() ? ` · ${notaLlamada.trim()}` : ""),
          description:
            `Llamado a: ${targetLabel}` +
            (esConductor
              ? ""
              : " · Escalamiento propuesto por el operador" +
                (targetPhone ? ` · Tel: ${targetPhone}` : "")) +
            (resultadoLabel ? ` · Resultado: ${resultadoLabel}` : "") +
            (sinRespuesta && registrarEscalamiento
              ? ` · Sin respuesta → escala a: ${dictSy[escalarA] as string}`
              : ""),
        });

        setTreatmentRequest({
          ...treatmentRequest,
          treatment_id: response.treatment_id,
        });
        setIsMenuOpen(false);
        router.push("/symptoms");
        ShowNotification({
          type: "success",
          message: (dict.symptoms as I18nRecord).treatment_saved as string,
        });
      },
    },
  ];

  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2">
      <div className=" w-full flex flex-col items-center flex-grow">
        <div className="w-full flex flex-col gap-2">
          <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white">
            {(dict.symptoms as I18nRecord).service_information as string}
          </h1>
          <div className="w-full flex flex-row gap-5">
            <div className="w-full flex flex-col gap-2">
              <p className="text-xs font-light text-gray-900 dark:text-gray-200">
                {(dict.symptoms as I18nRecord).driver_name as string}:{" "}
                <span className="font-light text-gray-500 dark:text-gray-400">
                  {treatmentData?.trip_info?.driver}
                </span>
              </p>
              <p className="text-xs font-light text-gray-900 dark:text-gray-200">
                {(dict.symptoms as I18nRecord).vehicle_plate as string}:{" "}
                <span className="font-light text-gray-500 dark:text-gray-400">
                  {treatmentData?.trip_info?.asset_id}
                </span>
              </p>
              <p className="text-xs font-light text-gray-900 dark:text-gray-200">
                {(dict.symptoms as I18nRecord).phone as string}:{" "}
                <span className="font-light text-gray-500 dark:text-gray-400">
                  {treatmentData?.trip_info?.driver_contact}
                </span>
              </p>
            </div>
            <div className="w-full flex flex-col gap-2">
              <p className="text-xs font-light text-gray-900 dark:text-gray-200">
                {(dict.symptoms as I18nRecord).service as string}:{" "}
                <span className="font-light text-gray-500 dark:text-gray-400">
                  {treatmentData?.symptom_info?.name}
                </span>
              </p>
              <p className="text-xs font-light text-gray-900 dark:text-gray-200">
                {(dict.symptoms as I18nRecord).load_type as string}:{" "}
                <span className="font-light text-gray-500 dark:text-gray-400">
                  {treatmentData?.trip_info?.type_load}
                </span>
              </p>
              <p className="text-xs font-light text-gray-900 dark:text-gray-200">
                {
                  (dict.symptoms as I18nRecord)
                    .recommended_prescription as string
                }
                :{" "}
                <span className="font-light text-gray-500 dark:text-gray-400">
                  {(dict.symptoms as I18nRecord).call_driver as string}
                </span>
              </p>
            </div>
          </div>
        </div>
        <hr className="w-full border-gray-200 dark:border-gray-700 mt-2 mb-3" />
        <div className="w-full flex flex-row gap-5">
          <div className="w-1/2 flex flex-col gap-2">
            <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white">
              {dictSy.call_target as string}
            </h1>
            <Select
              value={callTarget}
              onChange={(e) => setCallTarget(e.target.value)}
            >
              {targets.map((t) => (
                <option key={t} value={t}>
                  {dictSy[t] as string}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-1/2 flex flex-col gap-2">
            {!esConductor && (
              <>
                <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white">
                  {dictSy.target_phone as string}
                </h1>
                <TextInput
                  type="tel"
                  value={targetPhone}
                  onChange={(e) => setTargetPhone(e.target.value)}
                  placeholder="+56 9 …"
                />
              </>
            )}
          </div>
        </div>
        {!esConductor && (
          <div className="w-full flex flex-col gap-1 bg-amber-50 dark:bg-gray-700 p-2 rounded-lg mt-2">
            <p className="text-xs font-light text-amber-800 dark:text-amber-300">
              {dictSy.escalation_note as string}
            </p>
          </div>
        )}
        <hr className="w-full border-gray-200 dark:border-gray-700 mt-3 mb-3" />
        <div className="w-full flex flex-row gap-5">
          <div className="w-1/2 flex flex-col gap-2">
            <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white">
              {(dict.symptoms as I18nRecord).message_to_communicate as string}
            </h1>
            <Textarea
              /* placeholder={messageToCommunicate} */
              defaultValue={messageToCommunicate}
              className="w-full h-32"
              onChange={(e) => setMessageToCommunicate(e.target.value)}
            />
          </div>
          <div className="w-1/2 flex flex-col gap-2">
            <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white">
              {dictSy.call_result as string}
            </h1>
            <Select
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
            >
              <option value="" disabled>
                {dictSy.result_pending as string}
              </option>
              {resultados.map((r) => (
                <option key={r} value={r}>
                  {dictSy[r] as string}
                </option>
              ))}
            </Select>
            <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white">
              {dictSy.call_note as string}
            </h1>
            <Textarea
              className="w-full h-16 text-gray-900 dark:text-white"
              value={notaLlamada}
              onChange={(e) => setNotaLlamada(e.target.value)}
            />
          </div>
        </div>
        {sinRespuesta && (
          <div className="w-full flex flex-col gap-2 bg-amber-50 dark:bg-gray-700 p-3 rounded-lg mt-2">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {dictSy.escalate_offer as string}
            </p>
            <div className="flex flex-row items-center gap-3 flex-wrap">
              <span className="text-sm font-light text-amber-900 dark:text-amber-200">
                {dictSy.escalate_to as string}:
              </span>
              <Select
                className="w-64"
                value={escalarA}
                onChange={(e) => setEscalarA(e.target.value)}
              >
                {targets
                  .filter((t) => t !== callTarget)
                  .map((t) => (
                    <option key={t} value={t}>
                      {dictSy[t] as string}
                    </option>
                  ))}
              </Select>
              <label className="flex items-center gap-2 text-sm font-light text-amber-900 dark:text-amber-200">
                <Checkbox
                  checked={registrarEscalamiento}
                  onChange={(e) => setRegistrarEscalamiento(e.target.checked)}
                />
                {dictSy.register_escalation as string}
              </label>
            </div>
          </div>
        )}
        <hr className="w-full border-gray-200 dark:border-gray-700 mt-2 mb-3" />
        <div className="w-full flex flex-col">
          <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white">
            Tags
          </h1>
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedTags.length > 0 && (
              <TagManager
                tags={selectedTags.map((tag, index) => ({
                  text: tag.text,
                  icon: (
                    <button
                      onClick={() => handleTagRemove(index)}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      ×
                    </button>
                  ),
                }))}
                tag_style="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleTagCreate();
                }
              }}
              placeholder="Ingresa un tag"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-blue-500 dark:focus:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            {predefinedTags.map((tag, index) => (
              <button
                key={index}
                onClick={() => {
                  if (!selectedTags.some((t) => t.text === tag.text)) {
                    setSelectedTags([...selectedTags, tag]);
                  }
                }}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
              >
                {tag.text}
              </button>
            ))}
          </div>
        </div>
        <div className="w-full flex flex-row gap-2 overflow-visible mt-4">
          {buttons.map((button, index) => (
            <Button
              className="flex-1"
              key={index}
              color={button.color}
              onClick={() => {
                button.function();
              }}
            >
              {button.text as string}
              {button.icon}
              {button.text2 as string}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
