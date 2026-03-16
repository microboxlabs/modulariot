"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Checkbox, Label } from "flowbite-react";
import { HiCheck, HiChevronDown } from "react-icons/hi";
import MapVisualization from "@/features/map-visualization/map-visualization";
import type { MapRef } from "react-map-gl";
import { PinLayer } from "@/features/geographic-view/components/layers/pin_layer";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

// Mock data - replace with actual API data
const TRANSPORTISTA_OPTIONS = [
  { value: "tnl", label: "Transportes Nacionales Libertadores Ltda" },
  { value: "trn", label: "Transporte Rápido del Norte S.A." },
  { value: "lis", label: "Logística Integral del Sur Ltda" },
];

const CONDUCTOR_OPTIONS = [
  {
    id: "c1",
    name: "Juan Pérez González",
    estado: "habilitado",
    viajesPrevios: 142,
    ultimoViaje: "2026-03-10",
    excesoVelocidad: 2,
    faltasDescanso: 1,
  },
  {
    id: "c2",
    name: "Carlos Rodríguez Silva",
    estado: "habilitado",
    viajesPrevios: 89,
    ultimoViaje: "2026-03-08",
    excesoVelocidad: 0,
    faltasDescanso: 0,
  },
  {
    id: "c3",
    name: "Miguel Ángel Torres",
    estado: "no habilitado",
    viajesPrevios: 56,
    ultimoViaje: "2026-02-15",
    excesoVelocidad: 5,
    faltasDescanso: 3,
  },
  {
    id: "c4",
    name: "Roberto Fernández López",
    estado: "habilitado",
    viajesPrevios: 203,
    ultimoViaje: "2026-03-11",
    excesoVelocidad: 1,
    faltasDescanso: 0,
  },
  {
    id: "c5",
    name: "Andrés Morales Vega",
    estado: "habilitado",
    viajesPrevios: 67,
    ultimoViaje: "2026-03-09",
    excesoVelocidad: 0,
    faltasDescanso: 2,
  },
];

const CAMION_OPTIONS = [
  {
    id: "t1",
    plate: "BBCC12",
    marca: "Volvo FH16",
    estado: "disponible",
    gpsIntegrado: true,
    estadoGps: "online",
    viajesPrevios: 234,
    ultimoViaje: "2026-03-11",
    perdidasSenal: 2,
    latitude: -33.4489,
    longitude: -70.6693,
    heading: 45,
  },
  {
    id: "t2",
    plate: "DDEE34",
    marca: "Scania R500",
    estado: "ocupado",
    gpsIntegrado: true,
    estadoGps: "offline",
    viajesPrevios: 156,
    ultimoViaje: "2026-03-08",
    perdidasSenal: 8,
    latitude: -33.4372,
    longitude: -70.6506,
    heading: 120,
  },
  {
    id: "t3",
    plate: "FFGG56",
    marca: "Mercedes Actros",
    estado: "disponible",
    gpsIntegrado: false,
    estadoGps: "offline",
    viajesPrevios: 89,
    ultimoViaje: "2026-03-05",
    perdidasSenal: 0,
    latitude: -33.4569,
    longitude: -70.6483,
    heading: 200,
  },
  {
    id: "t4",
    plate: "HHII78",
    marca: "MAN TGX",
    estado: "disponible",
    gpsIntegrado: true,
    estadoGps: "online",
    viajesPrevios: 312,
    ultimoViaje: "2026-03-10",
    perdidasSenal: 1,
    latitude: -33.4255,
    longitude: -70.6142,
    heading: 90,
  },
  {
    id: "t5",
    plate: "JJKK90",
    marca: "DAF XF",
    estado: "ocupado",
    gpsIntegrado: true,
    estadoGps: "online",
    viajesPrevios: 178,
    ultimoViaje: "2026-03-09",
    perdidasSenal: 5,
    latitude: -33.4103,
    longitude: -70.5665,
    heading: 270,
  },
];

const REMOLQUE_OPTIONS = [
  {
    id: "r1",
    plate: "AABB11",
    tipo: "Remolque Plataforma",
    estado: "disponible",
  },
  { id: "r2", plate: "CCDD22", tipo: "Remolque Tolva", estado: "ocupado" },
  {
    id: "r3",
    plate: "EEFF33",
    tipo: "Remolque Cisterna",
    estado: "disponible",
  },
  { id: "r4", plate: "GGHH44", tipo: "Remolque Plataforma", estado: "ocupado" },
  { id: "r5", plate: "IIJJ55", tipo: "Remolque Tolva", estado: "disponible" },
];

interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface CustomDropdownProps {
  readonly label: string;
  readonly options: DropdownOption[];
  readonly selectedValue: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly labelRightElement?: React.ReactNode;
}

function CustomDropdown({
  label,
  options,
  selectedValue,
  onChange,
  placeholder,
  disabled = false,
  labelRightElement,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === selectedValue);

  return (
    <div ref={dropdownRef} className="relative">
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {label}
        </Label>
        {labelRightElement}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span
          className={`font-medium truncate ${selectedOption ? "text-gray-900 dark:text-white" : "text-gray-500"}`}
        >
          {selectedOption?.label ?? placeholder}
        </span>
        <HiChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="absolute z-10 w-full bottom-full mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={option.disabled}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                option.value === selectedValue
                  ? "bg-blue-50 dark:bg-blue-900/20"
                  : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
              } ${option.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {option.value === selectedValue && (
                  <HiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                )}
                <span
                  className={`text-sm truncate ${
                    option.value === selectedValue
                      ? "text-blue-700 dark:text-blue-300"
                      : "text-gray-900 dark:text-white"
                  }`}
                >
                  {option.label}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface DriverInfoDisplayProps {
  readonly conductor: (typeof CONDUCTOR_OPTIONS)[0];
  readonly dict: I18nRecord;
}

function DriverInfoDisplay({ conductor, dict }: DriverInfoDisplayProps) {
  const isEnabled = conductor.estado === "habilitado";

  return (
    <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col gap-0.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.status", dict)}
          </span>
          <span
            className={`font-medium ${isEnabled ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
          >
            {isEnabled
              ? tr("pages.planning.sidebar.assignment.enabled", dict)
              : tr("pages.planning.sidebar.assignment.notEnabled", dict)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.previousTrips", dict)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {conductor.viajesPrevios}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.lastTrip", dict)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {conductor.ultimoViaje}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.speedExcess", dict)}
          </span>
          <span
            className={`font-medium ${conductor.excesoVelocidad > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-gray-900 dark:text-white"}`}
          >
            {tr("pages.planning.sidebar.assignment.incidents", dict, {
              count: String(conductor.excesoVelocidad),
            })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.restFaults", dict)}
          </span>
          <span
            className={`font-medium ${conductor.faltasDescanso > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-gray-900 dark:text-white"}`}
          >
            {tr("pages.planning.sidebar.assignment.faults", dict, {
              count: String(conductor.faltasDescanso),
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

interface TruckInfoDisplayProps {
  readonly camion: (typeof CAMION_OPTIONS)[0];
  readonly dict: I18nRecord;
}

function TruckInfoDisplay({ camion, dict }: TruckInfoDisplayProps) {
  const isGpsIntegrado = camion.gpsIntegrado;
  const isOnline = camion.estadoGps === "online";

  return (
    <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col gap-0.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.gpsIntegrated", dict)}
          </span>
          <span
            className={`font-medium ${isGpsIntegrado ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
          >
            {isGpsIntegrado
              ? tr("pages.planning.sidebar.assignment.integrated", dict)
              : tr("pages.planning.sidebar.assignment.notIntegrated", dict)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.gpsStatus", dict)}
          </span>
          <span className="flex items-center gap-1">
            <span
              className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`}
            />
            <span
              className={`font-medium ${isOnline ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
            >
              {isOnline
                ? tr("pages.planning.sidebar.assignment.online", dict)
                : tr("pages.planning.sidebar.assignment.offline", dict)}
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.previousTrips", dict)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {tr("pages.planning.sidebar.assignment.trips", dict, {
              count: String(camion.viajesPrevios),
            })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.lastTrip", dict)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {camion.ultimoViaje}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.signalLosses", dict)}
          </span>
          <span
            className={`font-medium ${camion.perdidasSenal > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-gray-900 dark:text-white"}`}
          >
            {tr("pages.planning.sidebar.assignment.losses", dict, {
              count: String(camion.perdidasSenal),
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

interface TruckMapDisplayProps {
  readonly camion: (typeof CAMION_OPTIONS)[0];
}

function TruckMapDisplay({ camion }: TruckMapDisplayProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Create pin layer for truck location
  const layers = useMemo(() => {
    if (camion.latitude == null || camion.longitude == null) return [];

    return [
      new PinLayer({
        id: "truck-pin-layer",
        data: [
          {
            assetid: camion.id,
            latitude: camion.latitude,
            longitude: camion.longitude,
            heading: camion.heading,
            speed: 0,
            location: camion.plate,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    ];
  }, [camion]);

  // Center map on truck location when map is loaded or truck changes
  useEffect(() => {
    if (
      isMapLoaded &&
      mapRef.current &&
      camion.latitude != null &&
      camion.longitude != null
    ) {
      mapRef.current.flyTo({
        center: [camion.longitude, camion.latitude],
        zoom: 14,
        duration: 500,
      });
    }
  }, [camion, isMapLoaded]);

  // Handle map load to trigger initial centering
  const handleZoomChange = useCallback((_zoom: number) => {
    // First zoom change means map is loaded
    setIsMapLoaded(true);
  }, []);

  return (
    <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="h-48 w-full">
        <MapVisualization
          mapStyle="streets"
          layers={layers}
          mapRef={mapRef}
          onZoomChange={handleZoomChange}
        />
      </div>
    </div>
  );
}

export interface AssignmentFormData {
  transportista: string;
  conductor: string;
  segundoConductor: string;
  hasSegundoConductor: boolean;
  camion: string;
  remolque: string;
  hasRemolque: boolean;
}

interface AssignmentFormProps {
  readonly value: AssignmentFormData;
  readonly onChange: (data: AssignmentFormData) => void;
  readonly dict: I18nRecord;
}

export function AssignmentForm({ value, onChange, dict }: AssignmentFormProps) {
  const transportistaOptions: DropdownOption[] = TRANSPORTISTA_OPTIONS.map(
    (t) => ({
      value: t.value,
      label: t.label,
    })
  );

  const conductorOptions: DropdownOption[] = CONDUCTOR_OPTIONS.map((c) => ({
    value: c.id,
    label: c.name,
    disabled: c.estado === "no habilitado",
  }));

  const availableLabel = tr(
    "pages.planning.sidebar.assignment.available",
    dict
  );
  const busyLabel = tr("pages.planning.sidebar.assignment.busy", dict);

  const camionOptions: DropdownOption[] = CAMION_OPTIONS.map((t) => ({
    value: t.id,
    label: `${t.plate} - ${t.marca} - ${t.estado === "disponible" ? availableLabel : busyLabel}`,
    disabled: t.estado === "ocupado",
  }));

  const remolqueOptions: DropdownOption[] = REMOLQUE_OPTIONS.map((r) => ({
    value: r.id,
    label: `${r.plate} - ${r.tipo} - ${r.estado === "disponible" ? availableLabel : busyLabel}`,
    disabled: r.estado === "ocupado",
  }));

  const selectedConductor = CONDUCTOR_OPTIONS.find(
    (c) => c.id === value.conductor
  );
  const selectedSegundoConductor = CONDUCTOR_OPTIONS.find(
    (c) => c.id === value.segundoConductor
  );
  const selectedCamion = CAMION_OPTIONS.find((c) => c.id === value.camion);

  const handleChange = (
    field: keyof AssignmentFormData,
    fieldValue: string | boolean
  ) => {
    const updated = { ...value, [field]: fieldValue };

    // When changing conductor, clear segundoConductor if it matches the new value
    // or if the second driver section is disabled
    if (field === "conductor" && typeof fieldValue === "string") {
      if (
        updated.segundoConductor === fieldValue ||
        !updated.hasSegundoConductor
      ) {
        updated.segundoConductor = "";
      }
    }

    // When disabling second conductor section, clear the selection
    if (field === "hasSegundoConductor" && fieldValue === false) {
      updated.segundoConductor = "";
    }

    // When disabling remolque section, clear the selection
    if (field === "hasRemolque" && fieldValue === false) {
      updated.remolque = "";
    }

    onChange(updated);
  };

  return (
    <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded-lg flex flex-col gap-4">
      {/* Transportista Dropdown */}
      <CustomDropdown
        label={tr("pages.planning.sidebar.assignment.transportista", dict)}
        options={transportistaOptions}
        selectedValue={value.transportista}
        onChange={(v) => handleChange("transportista", v)}
        placeholder={tr(
          "pages.planning.sidebar.assignment.selectTransportista",
          dict
        )}
      />

      {/* Conductor Dropdown */}
      <div>
        <CustomDropdown
          label={tr("pages.planning.sidebar.assignment.conductor", dict)}
          options={conductorOptions}
          selectedValue={value.conductor}
          onChange={(v) => handleChange("conductor", v)}
          placeholder={tr(
            "pages.planning.sidebar.assignment.selectConductor",
            dict
          )}
          labelRightElement={
            <label className="flex items-center gap-1 cursor-pointer">
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                {tr(
                  "pages.planning.sidebar.assignment.secondConductorLabel",
                  dict
                )}
              </span>
              <Checkbox
                id="segundo-conductor-check"
                checked={value.hasSegundoConductor}
                onChange={(e) =>
                  handleChange("hasSegundoConductor", e.target.checked)
                }
                className="w-3 h-3"
              />
            </label>
          }
        />
        {selectedConductor && (
          <DriverInfoDisplay conductor={selectedConductor} dict={dict} />
        )}
      </div>

      {/* Second Conductor Dropdown (conditional) */}
      {value.hasSegundoConductor && (
        <div>
          <CustomDropdown
            label={tr(
              "pages.planning.sidebar.assignment.secondConductor",
              dict
            )}
            options={conductorOptions.filter(
              (c) => c.value !== value.conductor
            )}
            selectedValue={value.segundoConductor}
            onChange={(v) => handleChange("segundoConductor", v)}
            placeholder={tr(
              "pages.planning.sidebar.assignment.selectSecondConductor",
              dict
            )}
          />
          {selectedSegundoConductor && (
            <DriverInfoDisplay
              conductor={selectedSegundoConductor}
              dict={dict}
            />
          )}
        </div>
      )}

      {/* Camión Dropdown */}
      <div>
        <CustomDropdown
          label={tr("pages.planning.sidebar.assignment.camion", dict)}
          options={camionOptions}
          selectedValue={value.camion}
          onChange={(v) => handleChange("camion", v)}
          placeholder={tr(
            "pages.planning.sidebar.assignment.selectCamion",
            dict
          )}
          labelRightElement={
            <label className="flex items-center gap-1 cursor-pointer">
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                {tr("pages.planning.sidebar.assignment.remolqueLabel", dict)}
              </span>
              <Checkbox
                id="remolque-check"
                checked={value.hasRemolque}
                onChange={(e) => handleChange("hasRemolque", e.target.checked)}
                className="w-3 h-3"
              />
            </label>
          }
        />
        {selectedCamion && (
          <TruckInfoDisplay camion={selectedCamion} dict={dict} />
        )}
        {selectedCamion && <TruckMapDisplay camion={selectedCamion} />}
      </div>

      {/* Remolque Dropdown (conditional) */}
      {value.hasRemolque && (
        <CustomDropdown
          label={tr("pages.planning.sidebar.assignment.remolque", dict)}
          options={remolqueOptions}
          selectedValue={value.remolque}
          onChange={(v) => handleChange("remolque", v)}
          placeholder={tr(
            "pages.planning.sidebar.assignment.selectRemolque",
            dict
          )}
        />
      )}
    </div>
  );
}
