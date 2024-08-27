"use client";
import { Card } from "flowbite-react";
import { TaskFormProps } from "../task-form/task-form.types";
import { useEffect } from "react";
import { SovosStartVerificationCardProps } from "./sovos-start-verification-card.types";

export default function SovosStartVerificationCard({ msg, pluginReady }: SovosStartVerificationCardProps) {

  useEffect(() => {
    console.log("pluginReady", pluginReady);  
    if(!pluginReady) return;
    const Autentia = new window.plgAutentiaJS();
    const entradas = { pRut: "24952044-6" };
    const salidas = [ "Erc", "NroAudit", "ErcDesc", "oNombres", "oSexo", "oFchNac" ];
    const focoAutentia = true;
    const token = Math.floor(Math.random() * 1e15);
    Autentia.Transaccion2("../SERVICIOS_MINEROS/verifica", entradas, salidas, focoAutentia, token, (resultado: any) => {
      console.log(resultado);
    });
  }, [pluginReady]);

  return (
    <Card>
      <div className="flex flex-col min-w-96 items-center justify-center w-96">
        <div className="h-40	w-40"></div>
        <h5 className="text-xl font-medium tracking-tight text-gray-900 dark:text-white mt-9">
          {msg!.title as string}
        </h5>
        <div className="text-gray-900">{msg!.subtitle as string}</div>
        <div className="text-center text-justified p-4">
          {msg!.description as string}
        </div>
      </div>
    </Card>
  );
}
