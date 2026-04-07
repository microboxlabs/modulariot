"use client";

import type { Colaborator } from "../../types/colaborators.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import ColaboratorDetailHeader from "./colaborator-detail-header";
import InfoCardWithSummary from "./info-card-with-summary";
import LoadableLabel from "@/features/common/components/loadable-label/loadable-label";
import {
  HiExclamationTriangle,
  HiSignal,
  HiBolt,
  HiMapPin,
  HiClock,
  HiDocumentText,
  HiTruck,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineXCircle,
  HiArrowTrendingUp,
  HiCheckCircle,
  HiNoSymbol,
  HiFire,
  HiMap,
  HiChartBar,
  HiClipboardDocumentCheck,
  HiIdentification,
  HiAcademicCap,
  HiShieldCheck,
  HiBellAlert,
  HiWrenchScrewdriver,
} from "react-icons/hi2";
import TrendValue from "@/features/common/components/trend-value/trend-value";
import StatusIndicator from "@/features/common/components/status-indicator/status-indicator";
import type { StatusOption } from "@/features/common/components/status-indicator/status-indicator";
import { IoShieldOutline, IoPulseOutline } from "react-icons/io5";
import BehaviorHistory from "./behavior-history";
import ColaboratorSummary from "./colaborator-summary";

interface ColaboratorDetailViewProps {
  readonly colaborator: Colaborator;
  readonly dict: I18nRecord;
  readonly onBack: () => void;
  readonly previous: {
    hasPrevious: boolean;
    onPrevious: () => void;
  };
  readonly next: {
    hasNext: boolean;
    onNext: () => void;
  };
}

// todo: finish this view

type ComplianceLevel = "ok" | "warning" | "critical";

const complianceOptions: ReadonlyArray<StatusOption<ComplianceLevel>> = [
  {
    value: "ok",
    label: "Todo en regla",
    colorClass: "text-green-500",
    icon: HiOutlineCheckCircle,
  },
  {
    value: "warning",
    label: "Con alerta",
    colorClass: "text-yellow-500",
    icon: HiOutlineExclamationTriangle,
  },
  {
    value: "critical",
    label: "Crítico",
    colorClass: "text-red-500",
    icon: HiOutlineXCircle,
  },
];

export default function ColaboratorDetailView({
  colaborator,
  dict,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onBack,
  previous,
  next,
}: ColaboratorDetailViewProps) {
  return (
    <div className="flex flex-col h-full items-center w-full">
      <ColaboratorDetailHeader
        colaborator={colaborator}
        dict={dict}
        previous={previous}
        next={next}
      />
      {/* Content sections will be added here using colaborator data */}
      <div className="flex-1 min-h-0 overflow-y-auto w-[70vw] max-w-screen-2xl p-4 flex flex-col gap-4">
        <ColaboratorSummary colaborator={colaborator} />
        <div className="grid grid-cols-3 gap-3">
          <InfoCardWithSummary
            icon={IoShieldOutline}
            iconClassName="text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30"
            title="Seguridad"
            subtitle="Score: 78"
            summary={
              <LoadableLabel
                label="Tendencia 30 días"
                value={<TrendValue percentage={-12} />}
                icon={<HiChartBar className="w-4 h-4" />}
                justifyBetween
              />
            }
          >
            <div className="flex flex-col gap-2">
              <LoadableLabel
                label="Eventos críticos"
                value="2"
                icon={<HiExclamationTriangle className="w-4 h-4" />}
                justifyBetween
              />
              <LoadableLabel
                label="Frenadas bruscas"
                value="5"
                icon={<HiBolt className="w-4 h-4" />}
                justifyBetween
              />
              <LoadableLabel
                label="Excesos de velocidad"
                value="3"
                icon={<HiArrowTrendingUp className="w-4 h-4" />}
                justifyBetween
              />
              <LoadableLabel
                label="Alertas GPS"
                value="1"
                icon={<HiMapPin className="w-4 h-4" />}
                justifyBetween
              />
            </div>
          </InfoCardWithSummary>
          <InfoCardWithSummary
            icon={HiClock}
            iconClassName="text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30"
            title="Puntualidad"
            subtitle="Score: 91"
            summary={
              <LoadableLabel
                label="Tendencia mensual"
                value={<TrendValue percentage={5} />}
                icon={<HiChartBar className="w-4 h-4" />}
                justifyBetween
              />
            }
          >
            <div className="flex flex-col gap-2">
              <LoadableLabel
                label="Llegada a tiempo"
                value="91%"
                icon={<HiCheckCircle className="w-4 h-4" />}
                justifyBetween
              />
              <LoadableLabel
                label="Retraso promedio"
                value="3.2 min"
                icon={<HiClock className="w-4 h-4" />}
                justifyBetween
              />
              <LoadableLabel
                label="Servicios cancelados"
                value="0"
                icon={<HiNoSymbol className="w-4 h-4" />}
                justifyBetween
              />
            </div>
          </InfoCardWithSummary>
          <InfoCardWithSummary
            icon={HiBolt}
            iconClassName="text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30"
            title="Eficiencia operativa"
            subtitle="Score: 85"
            summary={
              <LoadableLabel
                label="vs Promedio equipo"
                value={<TrendValue percentage={12} />}
                icon={<HiChartBar className="w-4 h-4" />}
                justifyBetween
              />
            }
          >
            <div className="flex flex-col gap-2">
              <LoadableLabel
                label="Consumo vs estándar"
                value="2"
                icon={<HiFire className="w-4 h-4" />}
                justifyBetween
              />
              <LoadableLabel
                label="Km vs plan"
                value="5"
                icon={<HiMap className="w-4 h-4" />}
                justifyBetween
              />
              <LoadableLabel
                label="Uso eficiente activo"
                value="3"
                icon={<HiCheckCircle className="w-4 h-4" />}
                justifyBetween
              />
            </div>
          </InfoCardWithSummary>
          <InfoCardWithSummary
            icon={HiDocumentText}
            iconClassName="text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30"
            title="Cumplimiento normativo"
            subtitle="Score: 88"
            summary={
              <LoadableLabel
                label="Estado"
                value={
                  <StatusIndicator
                    value="warning"
                    options={complianceOptions}
                  />
                }
                icon={<HiClipboardDocumentCheck className="w-4 h-4" />}
                justifyBetween
              />
            }
          >
            <div className="flex flex-col gap-2">
              <LoadableLabel
                label="Licencia vigente"
                value={
                  <StatusIndicator
                    value="ok"
                    options={complianceOptions}
                    iconOnly
                  />
                }
                icon={<HiIdentification className="w-4 h-4" />}
                justifyBetween
              />
              <LoadableLabel
                label="Cursos obligatorios"
                value={
                  <StatusIndicator
                    value="warning"
                    options={complianceOptions}
                    iconOnly
                  />
                }
                icon={<HiAcademicCap className="w-4 h-4" />}
                justifyBetween
              />
              <LoadableLabel
                label="Certificaciones"
                value={
                  <StatusIndicator
                    value="ok"
                    options={complianceOptions}
                    iconOnly
                  />
                }
                icon={<HiShieldCheck className="w-4 h-4" />}
                justifyBetween
              />
              <LoadableLabel
                label="Sanciones activas"
                value="1"
                icon={<HiNoSymbol className="w-4 h-4" />}
                justifyBetween
              />
            </div>
          </InfoCardWithSummary>

          <InfoCardWithSummary
            icon={HiTruck}
            iconClassName="text-teal-600 bg-teal-100 dark:text-teal-400 dark:bg-teal-900/30"
            title="Uso del vehículo"
            subtitle="Score: 78"
          >
            <div className="flex flex-col gap-2">
              <LoadableLabel
                label="Uso fuera de horario"
                value="2 eventos"
                icon={<HiClock className="w-4 h-4" />}
                justifyBetween
              />
              <LoadableLabel
                label="Uso indebido"
                value="0"
                icon={<HiExclamationTriangle className="w-4 h-4" />}
                justifyBetween
              />
              <LoadableLabel
                label="Km fuera de ruta"
                value="12 Km"
                icon={<HiMap className="w-4 h-4" />}
                justifyBetween
              />
              <LoadableLabel
                label="Desviaciones contractuales"
                value="1"
                icon={<HiDocumentText className="w-4 h-4" />}
                justifyBetween
              />
            </div>
          </InfoCardWithSummary>
          <InfoCardWithSummary
            icon={IoPulseOutline}
            iconClassName="text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30"
            title="Eventos operativos"
            subtitle="Score: 78"
          >
            <div className="flex flex-col gap-2">
              <LoadableLabel
                label="Incidentes recientes"
                value="3"
                icon={<HiExclamationTriangle className="w-4 h-4" />}
                justifyBetween
              />
              <LoadableLabel
                label="Fallas reportadas"
                value="1"
                icon={<HiWrenchScrewdriver className="w-4 h-4" />}
                justifyBetween
              />
              <LoadableLabel
                label="Sintomas asociados"
                value="0"
                icon={<HiSignal className="w-4 h-4" />}
                justifyBetween
              />
              <LoadableLabel
                label="Alertas abiertas"
                value="2"
                icon={<HiBellAlert className="w-4 h-4" />}
                justifyBetween
              />
            </div>
          </InfoCardWithSummary>
        </div>
        <BehaviorHistory />
      </div>
    </div>
  );
}
