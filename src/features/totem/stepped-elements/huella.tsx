import React, { useEffect, useState, useRef } from "react";
import { IoIosFingerPrint } from "react-icons/io";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import fingerPrint from "@assets/icons/totem/fingerprint-security.gif";
import SmartLockCard from "@assets/icons/totem/smart-lock-card-hover-pinch.gif";
import QrCode from "@assets/icons/totem/qr-code-hover-pinch.gif";
import VerificationSuccess from "@assets/icons/totem/approve-checked-simple-hover-pinch.gif";
import {
  fakeValidateRut,
  validateRut,
} from "@/features/sovos-fingerprint/services/autentia";
import Image from "next/image";
import { FaIdCard } from "react-icons/fa";
import { validateIdCard } from "@/features/common/providers/client-api.provider";
import { Button } from "flowbite-react";
import { isWindows } from "@/features/common/hooks/use-device-detection";
// import dynamic from "next/dynamic";
// const QrReader = dynamic(() => import("@blackbox-vision/react-qr-reader").then(mod => mod.QrReader), { ssr: false });

export default function Huella({
  setCurrentStep,
  currentStep,
  dict,
  rutData,
  pluginReady,
  onBiometricResult,
  idCardNumber,
  setIdCardNumber,
}: {
  setCurrentStep: (step: number) => void;
  currentStep: number;
  dict: I18nRecord;
  rutData: { rut: string } | null;
  pluginReady: boolean;
  onBiometricResult: (result: any) => void;
  idCardNumber: string;
  setIdCardNumber: (idCardNumber: string) => void;
}) {
  const [status, setStatus] = useState<
    "idle" | "scanning" | "success" | "error" | "error-id-card"
  >("idle");
  const [count, setCount] = useState(0);
  const [qrCode, setQrCode] = useState(false);
  const [idCard, setIdCard] = useState(false);
  const [idCardLoading, setIdCardLoading] = useState(false);
  const [manualAccess, setManualAccess] = useState(false);
  const [manualVerificationLoading, setManualVerificationLoading] =
    useState(false);
  const [verificatioSuccess, setVerificatioSuccess] = useState(false);
  const [qrMessage, setQrMessage] = useState<string | null>(null);

  const qrRef = useRef(null);

  // Device detection hook
  const isWindowsDevice = isWindows();

  // Function to get optimal QR scanning configuration
  const getQRScannerConfig = () => {
    const container = document.getElementById("html5qr-code");
    const containerWidth = container?.offsetWidth || 600;
    const containerHeight = container?.offsetHeight || 450;

    // Calculate optimal QR box size based on container
    const qrBoxSize = Math.min(containerWidth, containerHeight) * 0.85; // 85% of container size

    return {
      cameraConfig: {
        facingMode: "environment",
      },
      scannerConfig: {
        fps: 8, // Lower FPS for better processing of large QR codes
        qrbox: {
          width: qrBoxSize,
          height: qrBoxSize,
        },
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
        aspectRatio: 1.0,
        formatsToSupport: ["QR_CODE", "DATA_MATRIX", "AZTEC"],
      },
    };
  };

  useEffect(() => {
    if (count >= 3) {
      setCurrentStep(3);
    }
  }, [count]);

  useEffect(() => {
    if (idCardLoading && qrRef.current) {
      import("html5-qrcode" as any).then(({ Html5Qrcode }: any) => {
        const html5QrCode = new Html5Qrcode("html5qr-code");

        // Get optimal configuration for large QR codes
        const config = getQRScannerConfig();

        html5QrCode.start(
          config.cameraConfig,
          config.scannerConfig,
          async (decodedText: string, _decodedResult: any) => {
            const serialText = decodedText.substring(
              decodedText.indexOf("&serial=") + 8,
              decodedText.indexOf("&mrz="),
            );
            setQrMessage(serialText);
            setIdCardNumber(serialText);
            const response = await validateIdCard({
              user_rut: rutData?.rut as string,
              nro_serie: serialText,
            });
            if (response.success) {
              setVerificatioSuccess(true);
              setStatus("success");
            } else {
              setStatus("error-id-card");
            }
            html5QrCode?.clear();
            html5QrCode?.stop();
          },
          (_errorMessage: any) => {
            // Optionally handle scan errors
            //console.error("QR Code error:", errorMessage);
          },
        );
      });
    }
    // Optionally: cleanup on unmount or when idCardLoading becomes false
    return () => {
      const el = document.getElementById("html5qr-code");
      if (el) el.innerHTML = "";
    };
  }, [idCardLoading]);

  useEffect(() => {
    if (!isWindowsDevice) {
      setQrCode(true);
    }
  }, [isWindowsDevice]);

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
      }
    } catch (err: any) {
      setStatus("error");
      setCount(count + 1);
    }
  };

  const status_icon = {
    idle: {
      style: "text-gray-500 border-gray-500",
      text: (dict.totem as I18nRecord).fingerprint_scan_idle as string,
    },
    scanning: {
      style: "text-blue-500 animate-pulse border-blue-500",
      text: (dict.totem as I18nRecord).loading as string,
    },
    success: {
      style: "text-green-500 border-green-500",
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
          <h1 className="text-lg font-light text-gray-900 dark:text-gray-100">
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

        <div className="flex flex-col items-center justify-center">
          <p className="text-base text-gray-600 dark:text-gray-400 text-center px-6">
            {(dict.totem as I18nRecord).verification_success_subtext as string}
          </p>
          <p className="text-base text-gray-600 dark:text-gray-400 text-center px-6">
            {rutData?.rut}
          </p>
        </div>
        <Button
          onClick={() => {
            setCurrentStep(2);
          }}
          className="bg-blue-500 text-white p-2 rounded-lg w-full flex items-center justify-center"
          color="blue"
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
          <h1 className="text-lg font-light text-gray-900 dark:text-gray-100">
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

        <div className="flex flex-col items-center justify-center">
          <p className="text-xs text-gray-600 dark:text-gray-400 text-center px-6">
            {(dict.totem as I18nRecord).id_card_manual_access_subtext as string}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 text-center px-6 font-bold">
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
                value={idCardNumber}
                onChange={(e) => setIdCardNumber(e.target.value)}
                className="w-full h-full caret-gray-800 dark:caret-gray-200 font-light border-none bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-base pl-1 px-2 "
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
              setManualVerificationLoading(true);
              const response = await validateIdCard({
                user_rut: rutData?.rut as string,
                nro_serie: idCardNumber,
              });
              if (response.success) {
                setVerificatioSuccess(true);
                setStatus("success");
              } else {
                setStatus("error-id-card");
              }
              setManualVerificationLoading(false);
            }}
            disabled={
              status !== "idle" &&
              status !== "success" &&
              status !== "error" &&
              status !== "error-id-card" &&
              manualVerificationLoading
            }
            className="bg-blue-500 text-white p-2 rounded-lg w-full flex items-center justify-center disabled:opacity-50"
            color="blue"
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
          <h1 className="text-lg font-light text-gray-900 dark:text-gray-100">
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
          </>
        )}
        {qrMessage && (
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center px-6">
            {qrMessage}
          </p>
        )}
        <div className="flex flex-col items-center justify-center">
          {idCardLoading ? (
            <>
              <div className="w-full flex justify-center mb-4">
                <div
                  id="html5qr-code"
                  ref={qrRef}
                  style={{
                    width: "100%",
                    maxWidth: 400,
                    minHeight: 400,
                    aspectRatio: "1/1",
                  }}
                  className="rounded-lg overflow-hidden border-2 border-gray-300"
                />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 text-center px-6">
                {
                  (dict.totem as I18nRecord)
                    .smart_lock_card_subtext_loading as string
                }
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-600 dark:text-gray-400 text-center px-6">
              {(dict.totem as I18nRecord).smart_lock_card_subtext as string}
            </p>
          )}
        </div>
        {idCardLoading ? (
          <>
            <p className="text-xs text-gray-600 dark:text-gray-400 text-center px-6">
              {(dict.totem as I18nRecord).loading as string}
            </p>
            {/* <Button
            onClick={() => {
              setIdCardLoading(false);
              setVerificatioSuccess(true);
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
          </Button> */}
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
          <h1 className="text-lg font-light text-gray-900 dark:text-gray-100">
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

        <div className="flex flex-col items-center justify-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center px-6">
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
          className="bg-blue-500 text-white p-2 rounded-lg w-full flex items-center justify-center"
          color="blue"
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
        <h1 className="text-2xl font-light text-gray-900 dark:text-gray-100">
          {(dict.totem as I18nRecord).fingerprint_scan as string}
        </h1>
      </div>
      {status == "error" ? (
        <Image
          className="w-20 h-20 animate-scale-in"
          src={fingerPrint}
          alt="Ok"
          width={100}
          height={100}
        />
      ) : (
        <div
          className={`p-2 rounded-full border-4 flex items-center justify-center shadow-md ${status_icon[status].style}`}
        >
          <IoIosFingerPrint className="w-20 h-20 transition-colors duration-300" />
        </div>
      )}
      <div className="flex flex-col items-center justify-center">
        <p
          className={`text-sm text-gray-600 ${status == "error" ? "text-red-500" : "dark:text-gray-400"} text-center`}
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
          color="blue"
          className="bg-blue-500 text-white p-2 rounded-lg w-full flex items-center justify-center"
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
          color="blue"
          className="bg-blue-500 text-white p-2 rounded-lg w-full flex items-center justify-center"
        >
          <p className="text-sm font-light">
            {(dict.totem as I18nRecord).to_qrcode as string}
          </p>
        </Button>
      )}
    </div>
  );
}
