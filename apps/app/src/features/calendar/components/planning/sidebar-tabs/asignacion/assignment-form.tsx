"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Checkbox, Label } from "flowbite-react";
import { HiCheck, HiChevronDown } from "react-icons/hi";
import MapVisualization from "@/features/map-visualization/map-visualization";
import type { MapRef } from "react-map-gl";
import { PinLayer } from "@/features/geographic-view/components/layers/pin_layer";

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
  placeholder = "Seleccionar...",
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
}

function DriverInfoDisplay({ conductor }: DriverInfoDisplayProps) {
  const isEnabled = conductor.estado === "habilitado";

  return (
    <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col gap-0.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">Estado</span>
          <span
            className={`font-medium ${isEnabled ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
          >
            {isEnabled ? "Habilitado" : "No Habilitado"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            Viajes previos
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {conductor.viajesPrevios}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">Último viaje</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {conductor.ultimoViaje}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            Exceso velocidad
          </span>
          <span
            className={`font-medium ${conductor.excesoVelocidad > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-gray-900 dark:text-white"}`}
          >
            {conductor.excesoVelocidad} incidentes
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            Faltas descanso
          </span>
          <span
            className={`font-medium ${conductor.faltasDescanso > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-gray-900 dark:text-white"}`}
          >
            {conductor.faltasDescanso} faltas
          </span>
        </div>
      </div>
    </div>
  );
}

interface TruckInfoDisplayProps {
  readonly camion: (typeof CAMION_OPTIONS)[0];
}

function TruckInfoDisplay({ camion }: TruckInfoDisplayProps) {
  const isGpsIntegrado = camion.gpsIntegrado;
  const isOnline = camion.estadoGps === "online";

  return (
    <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col gap-0.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            GPS integrado
          </span>
          <span
            className={`font-medium ${isGpsIntegrado ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
          >
            {isGpsIntegrado ? "Integrado" : "No Integrado"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">Estado GPS</span>
          <span className="flex items-center gap-1">
            <span
              className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`}
            />
            <span
              className={`font-medium ${isOnline ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
            >
              {isOnline ? "Online" : "Offline"}
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            Viajes previos
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {camion.viajesPrevios} viajes
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">Último viaje</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {camion.ultimoViaje}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            Pérdidas de señal
          </span>
          <span
            className={`font-medium ${camion.perdidasSenal > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-gray-900 dark:text-white"}`}
          >
            {camion.perdidasSenal} pérdidas
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

  // Create pin layer for truck location
  const layers = useMemo(() => {
    if (!camion.latitude || !camion.longitude) return [];

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

  // Center map on truck location
  useEffect(() => {
    if (mapRef.current && camion.latitude && camion.longitude) {
      mapRef.current.flyTo({
        center: [camion.longitude, camion.latitude],
        zoom: 14,
        duration: 500,
      });
    }
  }, [camion]);

  return (
    <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="h-48 w-full">
        <MapVisualization mapStyle="streets" layers={layers} mapRef={mapRef} />
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
}

export function AssignmentForm({ value, onChange }: AssignmentFormProps) {
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

  const camionOptions: DropdownOption[] = CAMION_OPTIONS.map((t) => ({
    value: t.id,
    label: `${t.plate} - ${t.marca} - ${t.estado === "disponible" ? "Disponible" : "Ocupado"}`,
    disabled: t.estado === "ocupado",
  }));

  const remolqueOptions: DropdownOption[] = REMOLQUE_OPTIONS.map((r) => ({
    value: r.id,
    label: `${r.plate} - ${r.tipo} - ${r.estado === "disponible" ? "Disponible" : "Ocupado"}`,
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
    onChange({ ...value, [field]: fieldValue });
  };

  return (
    <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded-lg flex flex-col gap-4">
      {/* Transportista Dropdown */}
      <CustomDropdown
        label="Transportista"
        options={transportistaOptions}
        selectedValue={value.transportista}
        onChange={(v) => handleChange("transportista", v)}
        placeholder="Seleccionar transportista..."
      />

      {/* Conductor Dropdown */}
      <div>
        <CustomDropdown
          label="Conductor"
          options={conductorOptions}
          selectedValue={value.conductor}
          onChange={(v) => handleChange("conductor", v)}
          placeholder="Seleccionar conductor..."
          labelRightElement={
            <label className="flex items-center gap-1 cursor-pointer">
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                2do conductor
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
          <DriverInfoDisplay conductor={selectedConductor} />
        )}
      </div>

      {/* Second Conductor Dropdown (conditional) */}
      {value.hasSegundoConductor && (
        <div>
          <CustomDropdown
            label="Segundo Conductor"
            options={conductorOptions.filter(
              (c) => c.value !== value.conductor
            )}
            selectedValue={value.segundoConductor}
            onChange={(v) => handleChange("segundoConductor", v)}
            placeholder="Seleccionar segundo conductor..."
          />
          {selectedSegundoConductor && (
            <DriverInfoDisplay conductor={selectedSegundoConductor} />
          )}
        </div>
      )}

      {/* Camión Dropdown */}
      <div>
        <CustomDropdown
          label="Camión"
          options={camionOptions}
          selectedValue={value.camion}
          onChange={(v) => handleChange("camion", v)}
          placeholder="Seleccionar camión..."
          labelRightElement={
            <label className="flex items-center gap-1 cursor-pointer">
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                Remolque
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
        {selectedCamion && <TruckInfoDisplay camion={selectedCamion} />}
        {selectedCamion && <TruckMapDisplay camion={selectedCamion} />}
      </div>

      {/* Remolque Dropdown (conditional) */}
      {value.hasRemolque && (
        <CustomDropdown
          label="Remolque"
          options={remolqueOptions}
          selectedValue={value.remolque}
          onChange={(v) => handleChange("remolque", v)}
          placeholder="Seleccionar remolque..."
        />
      )}
    </div>
  );
}
