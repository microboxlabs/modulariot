"use client";

// Aviso al cerrar un formulario con cambios sin guardar: salir sin guardar
// o seguir editando (para guardar, el botón del formulario).
import { Button } from "flowbite-react";
import { HiOutlineExclamation } from "react-icons/hi";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";

export default function UnsavedChangesDialog({
  abierto,
  onSalir,
  onSeguir,
}: Readonly<{
  abierto: boolean;
  onSalir: () => void;
  onSeguir: () => void;
}>) {
  if (!abierto) return null;
  return (
    <AbsoluteModal
      selected={abierto}
      setSelected={onSeguir}
      ariaLabel="Cambios sin guardar"
      maxWidth="28rem"
      className="w-full rounded-2xl border border-gray-200 bg-white text-left text-gray-900 shadow-2xl dark:border-gray-700 dark:bg-gray-800 dark:text-white"
    >
      <div className="flex w-full flex-col">
        <div className="flex items-start gap-3 px-6 pt-5 pb-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
            <HiOutlineExclamation className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Cambios sin guardar</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Tienes cambios sin guardar. Si sales ahora, se perderán.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 px-6 py-3 dark:border-gray-700">
          <Button color="alternative" onClick={onSeguir}>
            Seguir editando
          </Button>
          <Button color="red" onClick={onSalir}>
            Salir sin guardar
          </Button>
        </div>
      </div>
    </AbsoluteModal>
  );
}
