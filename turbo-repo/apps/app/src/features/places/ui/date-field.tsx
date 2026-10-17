"use client";

// Fecha "YYYY-MM-DD" con el Datepicker de Flowbite. El calendario se monta en
// un portal: dentro de la ventana flotante (overflow con scroll) el popup
// absoluto de Flowbite quedaría recortado.
import { Datepicker, TextInput } from "flowbite-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiCalendar } from "react-icons/hi";
import dayjs from "dayjs";

// alto aproximado del calendario inline, para abrirlo hacia arriba si no cabe
const ALTO_POPUP = 340;

export default function DateField({
  label,
  value,
  onChange,
  minDate,
  maxDate,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const abrir = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cabeAbajo = rect.bottom + 4 + ALTO_POPUP <= window.innerHeight;
    setPos({
      top: cabeAbajo ? rect.bottom + 4 : Math.max(8, rect.top - 4 - ALTO_POPUP),
      left: rect.left,
    });
  };

  useEffect(() => {
    if (!pos) return;
    const fuera = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (
        !t.closest("[data-places-datepicker]") &&
        !triggerRef.current?.contains(t)
      )
        setPos(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPos(null);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [pos]);

  const elegir = (date: Date | null) => {
    onChange(date ? dayjs(date).format("YYYY-MM-DD") : "");
    setPos(null);
  };

  return (
    <div ref={triggerRef}>
      <TextInput
        sizing="sm"
        icon={HiCalendar}
        readOnly
        aria-label={label}
        placeholder="dd/mm/aaaa"
        value={value ? dayjs(value).format("DD/MM/YYYY") : ""}
        onClick={() => (pos ? setPos(null) : abrir())}
        className="cursor-pointer [&_input]:cursor-pointer"
      />
      {pos &&
        createPortal(
          <div
            data-places-datepicker
            className="fixed z-[9999]"
            style={{ top: pos.top, left: pos.left }}
          >
            <Datepicker
              inline
              language="es-ES"
              weekStart={1}
              value={value ? dayjs(value).toDate() : null}
              minDate={minDate ? dayjs(minDate).toDate() : undefined}
              maxDate={maxDate ? dayjs(maxDate).toDate() : undefined}
              labelTodayButton="Hoy"
              labelClearButton="Limpiar"
              onChange={elegir}
            />
          </div>,
          document.body
        )}
    </div>
  );
}
