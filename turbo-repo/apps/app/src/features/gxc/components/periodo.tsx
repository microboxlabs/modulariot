"use client";

// Selector de período GxC — semanas completas para composición equivalente
// (7/28/84 días). Persiste en la URL (?dias=) para sobrevivir la navegación
// N1 → N2 → N3 y poder compartir el enlace.
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const DIAS_OPCIONES = [7, 28, 84] as const;
const DIAS_LABEL: Record<number, string> = { 7: "7 días", 28: "4 semanas", 84: "12 semanas" };

export function usePeriodo() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = Number(sp.get("dias"));
  const dias = (DIAS_OPCIONES as readonly number[]).includes(raw) ? raw : 28;
  const setDias = (d: number) => {
    const q = new URLSearchParams(sp.toString());
    q.set("dias", String(d));
    router.replace(`${pathname}?${q.toString()}`);
  };
  return { dias, setDias, qs: `dias=${dias}` };
}

export function PeriodoChips({ dias, onChange }: { dias: number; onChange: (d: number) => void }) {
  return (
    <div className="flex items-center gap-1 flex-none">
      {DIAS_OPCIONES.map((d) => (
        <button key={d} type="button" onClick={() => onChange(d)}
          className="px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors"
          style={dias === d
            ? { background: "var(--blue-600)", color: "#fff", borderColor: "var(--blue-600)" }
            : { background: "var(--surface)", color: "var(--muted)", borderColor: "var(--border)" }}>
          {DIAS_LABEL[d]}
        </button>
      ))}
    </div>
  );
}
