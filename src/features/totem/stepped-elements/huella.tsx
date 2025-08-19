import React, { useEffect, useState } from "react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import VerificationSuccess from "@assets/icons/totem/ok.svg";
import FingerprintError from "@assets/icons/totem/finger-print-red.svg";
import Fingerprint from "@assets/icons/totem/finger-print-blue.svg";
import QrCode from "@assets/icons/totem/qr-code.svg";
import SmartLockCard from "@assets/icons/totem/id-card.svg";

import {
  fakeValidateRut,
  validateRut,
} from "@/features/sovos-fingerprint/services/autentia";

import { FaIdCard } from "react-icons/fa";
import { validateIdCard } from "@/features/common/providers/client-api.provider";
import { Button } from "flowbite-react";
import { isWindows } from "@/features/common/hooks/use-device-detection";
import Image from "next/image";
import { logger } from "@/lib/logger";

export default function Huella({
  setCurrentStep,
  currentStep,
  dict,
  rutData,
  setRutData,
  pluginReady,
  onBiometricResult,
  idCardNumber,
  setIdCardNumber,
}: {
  setCurrentStep: (step: number) => void;
  currentStep: number;
  dict: I18nRecord;
  rutData: { rut: string } | null;
  setRutData: (rutData: { rut: string; rut_validated: boolean }) => void;
  pluginReady: boolean;
  onBiometricResult: (result: any) => void;
  idCardNumber: string;
  setIdCardNumber: (idCardNumber: string) => void;
}) {
  const [status, setStatus] = useState<
    "idle" | "scanning" | "success" | "error" | "error-id-card"
  >("idle");
  const [count, setCount] = useState(0);
  const [countIdCard, setCountIdCard] = useState(0);
  const [qrCode, setQrCode] = useState(false);
  const [idCard, setIdCard] = useState(false);
  const [idCardLoading, setIdCardLoading] = useState(false);
  const [manualAccess, setManualAccess] = useState(false);
  const [manualVerificationLoading, setManualVerificationLoading] =
    useState(false);
  const [verificatioSuccess, setVerificatioSuccess] = useState(false);
  const [qrMessage, setQrMessage] = useState<string | null>(null);
  let idCardNumberOnce = false;

  // Device detection hook
  const isWindowsDevice = isWindows();

  const handleIdCardNumberChange = (value: string) => {
    if (value.length > 0) {
      //const idCardCaptured = value.substring(value.indexOf("serial") + 7, 9);
      if (qrMessage !== null) {
        setQrMessage(qrMessage + value);
      } else {
        setQrMessage(value);
      }
      //setIdCardLoading(true);
      //handleValidateIdCard();
    }
    if (
      qrMessage &&
      qrMessage.indexOf("mrz") !== -1 &&
      idCardNumber.length === 0
    ) {
      const serialPosition = qrMessage.indexOf("serial");
      const idCardCaptured = qrMessage.substring(
        serialPosition + 7,
        serialPosition + 16
      );
      setIdCardNumber(idCardCaptured);
      if (!idCardNumberOnce) {
        idCardNumberOnce = true;
        handleIdCardNumberOnce(idCardCaptured);
      }
    }
  };

  function handleIdCardNumberOnce(value: string) {
    logger.info("handleIdCardNumberOnce:" + value);
    handleValidateIdCard(value);
  }

  useEffect(() => {
    if (count >= 3) {
      setCurrentStep(3);
    }
  }, [count]);

  useEffect(() => {
    if (!isWindowsDevice) {
      setQrCode(true);
    }
  }, [isWindowsDevice]);

  useEffect(() => {
    if (
      isWindowsDevice &&
      !idCard &&
      !qrCode &&
      !manualAccess &&
      !verificatioSuccess
    ) {
      handleScanFingerprint();
    }

    /* if (idCard) {
      let bufferText = "";
      logger.info("add event listener");
      document.addEventListener("keydown", (e) => {
        logger.info("keydown", e.key);
        if (e.key === "Enter") {
          //handleIdCardNumberChange(bufferText);
          setIdCardNumber(bufferText);
          setQrMessage(bufferText);
        } else if (e.key.length === 1) {
          bufferText += e.key;
        }
        if (bufferText.indexOf("mrz") !== -1) {
          logger.info("qrCode", bufferText);
        }
      });
      return () => {
        logger.info("remove event listener");
        document.removeEventListener("keydown", () => {});
      };
    } */
  }, []);

  if (!pluginReady) return null;

  const validator =
    process.env.NEXT_PUBLIC_SIMULATE_AUTENTIA === "true"
      ? /*  async () => {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              reject("Error");
            }, 1000);
          });
        } */
        fakeValidateRut
      : validateRut;

  const handleScanFingerprint = async () => {
    if (status === "success") {
      setCurrentStep(currentStep + 1);
      return;
    }

    if (!rutData?.rut.trim()) {
      setStatus("error");
      setCount(count + 1);
      return;
    }

    setStatus("scanning");

    try {
      const result = await validator(rutData.rut);
      if (result) {
        setStatus("success");
        onBiometricResult(result);
        setRutData({
          rut: rutData?.rut as string,
          rut_validated: true,
        });
      }
    } catch (err: any) {
      setStatus("error");
      setCount(count + 1);
    }
  };

  const handleValidateIdCard = async (idCardCaptured: string = "") => {
    setManualVerificationLoading(true);
    setStatus("scanning");
    setCountIdCard(countIdCard + 1);
    const response = await validateIdCard({
      user_rut: rutData?.rut as string,
      nro_serie: idCardCaptured.length > 0 ? idCardCaptured : idCardNumber,
    });
    if (response.success) {
      setVerificatioSuccess(true);
      setStatus("success");
    } else {
      setStatus("error-id-card");
      if (countIdCard >= 2) {
        setCurrentStep(currentStep + 1);
        setRutData({
          rut: rutData?.rut as string,
          rut_validated: false,
        });
      }
    }
    setManualVerificationLoading(false);
  };

  const status_icon = {
    idle: {
      style: "text-gray-500 border-gray-500",
      text: (dict.totem as I18nRecord).fingerprint_scan_idle as string,
    },
    scanning: {
      style: "text-[#F1B300] animate-pulse border-[#F1B300]",
      text: (dict.totem as I18nRecord).loading as string,
    },
    success: {
      style: "text-[#F1B300] border-[#F1B300]",
      text: (dict.totem as I18nRecord).fingerprint_scan_success as string,
    },
    error: {
      style: "text-red-500 border-red-500",
      text: (dict.totem as I18nRecord).fingerprint_scan_error as string,
    },
    "error-id-card": {
      style: "text-red-500 border-red-500",
      text: (dict.totem as I18nRecord).fingerprint_scan_error as string,
    },
  };

  if (verificatioSuccess) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 shadow-md portrait:w-full w-full">
        <div className="flex flex-col items-center justify-center gap-4">
          <h1 className="text-lg font-light text-gray-800 dark:text-gray-200">
            {(dict.totem as I18nRecord).verification_success as string}
          </h1>
        </div>
        <Image
          className="w-[18vh] h-[18vh] animate-scale-in"
          src={VerificationSuccess}
          alt="Ok"
          width={100}
          height={100}
        />
        {/* <FaCheckCircle className="w-20 h-20 text-[#F1B300]" /> */}

        <div className="flex flex-col items-center justify-center">
          <p className="text-base text-gray-800 dark:text-gray-200 text-center px-6">
            {(dict.totem as I18nRecord).verification_success_subtext as string}
          </p>
          <p className="text-base text-gray-800 dark:text-gray-200 text-center px-6">
            {rutData?.rut}
          </p>
        </div>
        <Button
          onClick={() => {
            setRutData({
              rut: rutData?.rut as string,
              rut_validated: true,
            });
            setCurrentStep(2);
          }}
          className="bg-[#F1B300] dark:bg-[#F1B300] text-black dark:text-black hover:bg-white dark:hover:bg-white font-bold p-2 rounded-lg w-full flex items-center justify-center disabled:opacity-50"
          color="white"
        >
          <p className="text-base font-light">
            {(dict.totem as I18nRecord).continue as string}
          </p>
        </Button>
      </div>
    );
  }

  if (manualAccess) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 shadow-md portrait:w-full w-full">
        <div className="flex flex-col items-center justify-center gap-4">
          <h1 className="text-lg font-light text-gray-800 dark:text-gray-200">
            {(dict.totem as I18nRecord).id_card_manual_access as string}
          </h1>
        </div>
        <Image
          className="w-28 h-28 animate-scale-in"
          src={SmartLockCard}
          alt="Ok"
          width={100}
          height={100}
        />
        {/* <FaIdCard className="w-20 h-20 text-gray-500" /> */}

        <div className="flex flex-col items-center justify-center">
          <p className="text-xs text-gray-800 dark:text-gray-200 text-center px-6">
            {(dict.totem as I18nRecord).id_card_manual_access_subtext as string}
          </p>
          <p className="text-xs text-gray-800 dark:text-gray-200 text-center px-6 font-bold">
            RUT:{rutData?.rut}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center gap-2 w-full">
          <div className="relative w-full h-10">
            <div className="relative w-full h-10 flex flex-row items-center border-2 border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
              <div className=" h-full text-gray-400 pl-2 pr-1 py-2 flex items-center">
                <FaIdCard className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="No de Serie"
                autoFocus
                value={idCardNumber}
                onChange={(e) => setIdCardNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleValidateIdCard();
                  }
                }}
                className="w-full h-full caret-gray-800 dark:caret-gray-200 font-light border-none bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-base pl-1 px-2 "
                style={{
                  boxShadow: "none",
                }}
              />
            </div>
          </div>
          {status === "error-id-card" && (
            <p className="text-xs text-red-500 text-center px-14">
              {(dict.totem as I18nRecord).id_card_manual_access_error as string}
            </p>
          )}
          <Button
            onClick={async () => {
              handleValidateIdCard();
            }}
            disabled={
              status !== "idle" &&
              status !== "success" &&
              status !== "error" &&
              status !== "error-id-card" &&
              manualVerificationLoading
            }
            className="bg-[#F1B300] dark:bg-[#F1B300] text-black dark:text-black hover:bg-white dark:hover:bg-white font-bold p-2 rounded-lg w-full flex items-center justify-center disabled:opacity-50"
            color="white"
          >
            <p className="text-base font-light">
              {manualVerificationLoading
                ? ((dict.totem as I18nRecord).loading as string)
                : ((dict.totem as I18nRecord).continue as string)}
            </p>
          </Button>
        </div>
      </div>
    );
  }

  if (idCard) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 shadow-md portrait:w-full w-full">
        <div className="flex flex-col items-center justify-center gap-4">
          <h1 className="text-lg font-light text-gray-800 dark:text-gray-200">
            {(dict.totem as I18nRecord).id_card_scan as string}
          </h1>
        </div>
        {!idCardLoading && (
          <>
            <Image
              className="w-28 h-28 animate-scale-in"
              src={SmartLockCard}
              alt="Ok"
              width={100}
              height={100}
            />
            {/* <FaIdCard className="w-20 h-20 text-gray-500" /> */}
          </>
        )}
        {/* {qrMessage && (
          <p className="text-sm text-gray-800 dark:text-gray-200 text-center px-6">
            {qrMessage}
          </p>
        )} */}
        {idCardNumber && (
          <p className="text-sm text-gray-800 dark:text-gray-200 text-center px-6">
            {idCardNumber}
          </p>
        )}
        <div className="flex flex-col items-center justify-center">
          {idCardLoading ? (
            <>
              <div className="w-full flex justify-center mb-4">
                <input
                  type="text"
                  value={idCardNumber}
                  onChange={(e) => handleIdCardNumberChange(e.target.value)}
                  autoFocus
                  className="hidden w-full h-full caret-gray-800 dark:caret-gray-200 font-light border-none bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-base pl-1 px-2 "
                />
              </div>
              {status === "error-id-card" ? (
                <p className="text-xs text-red-500 text-center px-14">
                  {
                    (dict.totem as I18nRecord)
                      .id_card_manual_access_error as string
                  }
                </p>
              ) : (
                <p className="text-xs text-gray-600 dark:text-gray-400 text-center px-6">
                  {
                    (dict.totem as I18nRecord)
                      .smart_lock_card_subtext_loading as string
                  }
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-600 dark:text-gray-400 text-center px-6">
              {(dict.totem as I18nRecord).smart_lock_card_subtext as string}
            </p>
          )}
        </div>
        {idCardLoading ? (
          <>
            <Button
              onClick={() => {
                setIdCard(false);
                setManualAccess(false);
                setQrCode(true);
                setIdCardLoading(false);
              }}
              disabled={
                status !== "idle" && status !== "success" && status !== "error"
              }
              className="text-black p-2 rounded-lg w-full flex items-center justify-center"
              color="light"
            >
              <p className="text-base font-light">
                {(dict.totem as I18nRecord).back as string}
              </p>
            </Button>
          </>
        ) : (
          <Button
            onClick={() => {
              setIdCardLoading(true);
            }}
            disabled={
              status !== "idle" && status !== "success" && status !== "error"
            }
            className="text-black p-2 rounded-lg w-full flex items-center justify-center"
            color="light"
          >
            <p className="text-base font-light">
              {(dict.totem as I18nRecord).continue as string}
            </p>
          </Button>
        )}
      </div>
    );
  }

  if (qrCode) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 shadow-md portrait:w-full w-full">
        <div className="flex flex-col items-center justify-center gap-4">
          <h1 className="text-lg font-light text-gray-800 dark:text-gray-200">
            {(dict.totem as I18nRecord).id_card_scan as string}
          </h1>
        </div>
        <Image
          className="w-28 h-28 animate-scale-in"
          src={QrCode}
          alt="Ok"
          width={100}
          height={100}
        />
        {/* <FaQrcode className="w-20 h-20 text-gray-500" /> */}

        <div className="flex flex-col items-center justify-center">
          <p className="text-sm text-gray-800 dark:text-gray-200 text-center px-6">
            {(dict.totem as I18nRecord).qrcode_subtext as string}
          </p>
        </div>
        <Button
          onClick={() => {
            setManualAccess(true);
          }}
          disabled={
            status !== "idle" && status !== "success" && status !== "error"
          }
          color="light"
          className="text-black p-2 rounded-lg w-full flex items-center justify-center"
        >
          <p className="text-base font-light">
            {(dict.totem as I18nRecord).manual_access as string}
          </p>
        </Button>
        <Button
          onClick={() => {
            setIdCard(true);
          }}
          disabled={
            status !== "idle" && status !== "success" && status !== "error"
          }
          className="bg-[#F1B300] dark:bg-[#F1B300] text-black dark:text-black hover:bg-white dark:hover:bg-white font-bold p-2 rounded-lg w-full flex items-center justify-center disabled:opacity-50"
          color="white"
        >
          <p className="text-base font-light">
            {(dict.totem as I18nRecord).qr_code_scann as string}
          </p>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 shadow-md w-full">
      <div className="flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-light text-gray-800 dark:text-gray-200">
          {(dict.totem as I18nRecord).fingerprint_scan as string}
        </h1>
      </div>
      {status == "error" ? (
        <Image
          className="w-20 h-20 animate-scale-in"
          src={FingerprintError}
          alt="Ok"
          width={100}
          height={100}
        />
      ) : (
        <div
          className={`p-2 rounded-full border-4 flex items-center justify-center shadow-md ${status_icon[status].style}`}
        >
          <Image
            className="w-20 h-20 animate-scale-in"
            src={Fingerprint}
            alt="Ok"
            width={100}
            height={100}
          />
        </div>
      )}
      <div className="flex flex-col items-center justify-center">
        <p
          className={`text-sm text-gray-800 dark:text-gray-200 ${status == "error" ? "text-red-500" : "dark:text-gray-400"} text-center`}
        >
          {status_icon[status].text}
        </p>
        <p
          className={`text-lg font-light text-gray-800 dark:text-gray-200 transition-all duration-300 rounded-xl ${status == "success" ? "text-green-500 opacity-100" : "opacity-0"}`}
        >
          {rutData?.rut}
        </p>
      </div>
      {count < 1 ? (
        <Button
          onClick={handleScanFingerprint}
          disabled={
            status !== "idle" && status !== "success" && status !== "error"
          }
          color="white"
          className="bg-[#F1B300] dark:bg-[#F1B300] text-black dark:text-black hover:bg-white dark:hover:bg-white font-bold p-2 rounded-lg w-full flex items-center justify-center disabled:opacity-50"
        >
          <p className="text-base font-light">
            {count == 0
              ? ((dict.totem as I18nRecord).continue as string)
              : ((dict.totem as I18nRecord).try_again as string)}
          </p>
        </Button>
      ) : (
        <Button
          onClick={() => {
            setQrCode(true);
          }}
          disabled={
            status !== "idle" && status !== "success" && status !== "error"
          }
          color="white"
          className="bg-[#F1B300] dark:bg-[#F1B300] text-black dark:text-black hover:bg-white dark:hover:bg-white font-bold p-2 rounded-lg w-full flex items-center justify-center disabled:opacity-50"
        >
          <p className="text-sm font-light">
            {(dict.totem as I18nRecord).to_qrcode as string}
          </p>
        </Button>
      )}
    </div>
  );
}
