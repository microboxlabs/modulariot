"use client";

import { useState, useEffect } from "react";
import SymptomsCards from "./cards";
import SymptomsTable from "./table";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import { Button } from "flowbite-react";
import { FaLightbulb } from "react-icons/fa6";
import { CiGift } from "react-icons/ci";
import { FaGift } from "react-icons/fa6";
import Image from "next/image";
import new_functionality_gif from "@assets/images/table-new-functionality.gif";

export default function ClientSymptoms({ dict }: { dict: I18nRecord }) {
  const [showCards, setShowCards] = useState(true);
  const [showModal, setShowModal] = useState<boolean | null>(null);
  const [newConditionFiltering, setNewConditionFiltering] = useState<
    string | null
  >(null);

  useEffect(() => {
    const stored = localStorage.getItem("new_condition_filtering");
    setNewConditionFiltering(stored);
    if (stored === null) {
      setShowModal(true);
    }
  }, []);

  function handle_accept() {
    localStorage.setItem("new_condition_filtering", "true");
    setNewConditionFiltering("true");
    setShowModal(null);
  }

  function handle_decline() {
    localStorage.setItem("new_condition_filtering", "false");
    setNewConditionFiltering("false");
    setShowModal(null);
  }

  function handle_clean() {
    localStorage.removeItem("new_condition_filtering");
    setNewConditionFiltering(null);
    setShowModal(true);
  }

  return (
    <div className="h-full flex flex-col overflow-visible w-full gap-0">
      <div className="absolute bottom-2 left-2 backdrop-blur-sm p-2 border border-gray-500 rounded-2xl z-50 hidden">
        <Button
          onClick={() => {
            localStorage.removeItem("new_condition_filtering");
            setNewConditionFiltering(null);
            setShowModal(true);
          }}
        >
          Clean new condition filtering
        </Button>
      </div>
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
              src={new_functionality_gif}
              alt="New Functionality"
              className="rounded-lg"
            />
          </div>
          <div className="flex flex-col p-4 gap-2">
            <div className="flex flex-row justify-center items-center p-1 px-2 text-sm bg-blue-300 w-fit rounded-full gap-1 text-blue-800">
              <FaGift className="h-4 w-4" /> New
            </div>
            <div className="flex flex-col gap-2 dark:text-gray-200">
              <h1 className="text-2xl text-left w-full font-bold leading-tight">
                Prueba el nuevo filtro por condiciones.
              </h1>
              <div className="flex flex-col gap-2">
                <p className="text-md">
                  Hemos implementado una nueva funcionalidad para{" "}
                  <b>filtrar por condición</b>.
                </p>
                <p className="text-md">
                  Ahora puedes filtrar directamente desde los contadores de
                  condición, sin necesidad de navegar a otra página.
                </p>
                <p className="text-md">
                  Por ahora <b>es opcional</b>, pero{" "}
                  <b>
                    en el futuro será la única forma de filtrar por condiciones
                  </b>
                  .
                </p>
                <p className="text-md font-bold text-blue-500 dark:text-blue-400 animate-bounce">
                  ¡Anímate a probarla!
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-col md:flex-row gap-2">
                <Button color="blue" className="w-full" onClick={handle_accept}>
                  ¡Quiero probar esta funcionalidad!
                </Button>
                <Button
                  color="alternative"
                  className="w-full bg-transparent dark:bg-transparent dark:hover:bg-gray-600 dark:text-gray-200 dark:border-gray-400"
                  onClick={handle_decline}
                >
                  No me interesa esta funcionalidad.
                </Button>
              </div>
            </div>
          </div>
        </div>
      </AbsoluteModal>
      <SymptomsCards
        showCards={showCards}
        dict={dict}
        settingsFunction={handle_clean}
      />
      <SymptomsTable
        setShowCards={setShowCards}
        showCards={showCards}
        dict={dict}
      />
    </div>
  );
}
