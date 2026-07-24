"use client";

// AMS dentro del EXPEDIENTE del camión (feedback Erick 2026-07-24):
// las secciones del mantenedor son ciudadanos de primera clase del
// acordeón del expediente — mismo ExpandableSection, con status y badge
// en el header (documentos vencidos auto-expanden, como mantenimiento).
import {
  HiOutlineIdentification,
  HiOutlineDocumentCheck,
  HiOutlineUserCircle,
  HiOutlineClock,
} from "react-icons/hi2";
import ExpandableSection from "@/features/fleet-management/components/vehicle-detail/expandable-section";
import type { SectionStatus } from "@/features/fleet-management/components/vehicle-detail/vehicle-detail-accordion";
import {
  FichaAms, useAmsRecord, SeccionDocs, SeccionDupla, SeccionGxc, SeccionAuditoria,
  type AmsTruck,
} from "./ficha-ams";

function statusDocs(rec: AmsTruck): SectionStatus {
  const d = rec.acreditacion.documentos;
  const estados = d.docs.map((x) => x.estado);
  if (d.faltantes.length > 0 || estados.includes("vencido")) return "critical";
  if (estados.includes("urgente") || estados.includes("por_vencer")) return "warning";
  return "ok";
}

const badgeCls: Record<SectionStatus, string> = {
  ok: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};
const Badge = ({ status, children }: { status: SectionStatus; children: React.ReactNode }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeCls[status]}`}>
    {children}
  </span>
);

/** Secciones AMS del expediente de camión, integradas al acordeón. */
export function AmsVehicleSections({ plate }: { plate: string }) {
  const { rec, cargando, mutate } = useAmsRecord("TRUCK", plate);
  const truck = rec as AmsTruck | undefined;

  if (cargando) return null;

  // Sin ficha aún: una sección del expediente invita a crearla (prellenada)
  if (!truck) {
    return (
      <ExpandableSection icon={HiOutlineIdentification}
        title="Ficha y datos maestros"
        description="Este recurso aún no tiene ficha en el maestro"
        badge={<Badge status="warning">Sin ficha</Badge>} status="warning">
        <FichaAms tipo="TRUCK" matchId={plate} variante="plano" secciones={["identificacion"]} />
      </ExpandableSection>
    );
  }

  const sDocs = statusDocs(truck);
  const nFaltan = truck.acreditacion.documentos.faltantes.length;
  const acreditado = truck.acreditacion.acreditado;

  return (
    <>
      <ExpandableSection icon={HiOutlineIdentification}
        title="Ficha y datos maestros"
        description="Identificación, estado operacional y origen del dato"
        badge={<Badge status={acreditado ? "ok" : "critical"}>
          {acreditado ? "Acreditado" : "No acreditado"}</Badge>}
        status={acreditado ? "ok" : "warning"}>
        <FichaAms tipo="TRUCK" matchId={plate} variante="plano" secciones={["identificacion"]} />
      </ExpandableSection>

      <ExpandableSection icon={HiOutlineDocumentCheck}
        title="Documentos y acreditación"
        description="Obligatorios, vigencias y semáforo 30/15/0"
        badge={<Badge status={sDocs}>
          {nFaltan > 0 ? `Faltan ${nFaltan}` : sDocs === "ok" ? "Al día" : "Por vencer"}</Badge>}
        status={sDocs}>
        <SeccionDocs tipo="TRUCK" rec={truck} plano onChange={() => void mutate()} />
      </ExpandableSection>

      <ExpandableSection icon={HiOutlineUserCircle}
        title="Conductor asignado"
        description="Dupla vigente, reasignación e historial"
        badge={<Badge status={truck.conductor ? "ok" : "warning"}>
          {truck.conductor?.nombre ?? "Sin asignar"}</Badge>}
        status="ok">
        <SeccionDupla tipo="TRUCK" rec={truck} plano onChange={() => void mutate()} />
      </ExpandableSection>

      <ExpandableSection icon={HiOutlineClock}
        title="Gestión por consecuencia e historial"
        description="Standing GxC del camión y auditoría de cambios"
        status="ok">
        <div className="space-y-4">
          <SeccionGxc tipo="TRUCK" rec={truck} plano />
          <SeccionAuditoria tipo="TRUCK" recId={truck.id} plano />
        </div>
      </ExpandableSection>
    </>
  );
}
