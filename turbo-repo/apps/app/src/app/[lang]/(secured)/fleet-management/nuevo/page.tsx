"use client";

// Alta de camión = el MISMO expediente en modo creación (página propia,
// no un formulario inline en la lista). Al guardar navega al expediente.
import { useParams, useRouter } from "next/navigation";
import { HiOutlineTruck, HiArrowLeft } from "react-icons/hi2";
import { FichaAms } from "@/features/ams/ficha-ams";

export default function NuevoCamionPage() {
  const { lang } = useParams<{ lang: string }>();
  const router = useRouter();
  return (
    <div className="flex flex-col gap-4 p-4 max-w-5xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push(`/${lang}/fleet-management`)}
                className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
                aria-label="Volver a la flota">
          <HiArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700">
          <HiOutlineTruck className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Nuevo camión</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Al guardar se abre su expediente para completar documentos y asignación
          </p>
        </div>
      </div>
      <FichaAms tipo="TRUCK" crear
        onCreado={(_id, patente) => router.push(`/${lang}/fleet-management/${encodeURIComponent(patente)}`)} />
    </div>
  );
}
