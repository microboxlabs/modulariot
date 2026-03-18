"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Checkbox } from "flowbite-react";
import MapVisualization from "@/features/map-visualization/map-visualization";
import type { MapRef } from "react-map-gl";
import { PinLayer } from "@/features/geographic-view/components/layers/pin_layer";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { DriverSearchDropdown } from "./driver-search-dropdown";
import {
  TransportistaSearchDropdown,
  type TransportistaOption,
} from "./transportista-search-dropdown";
import {
  TruckSearchDropdown,
  type CamionOption,
} from "./truck-search-dropdown";
import {
  RemolqueSearchDropdown,
  type RemolqueOption,
} from "./remolque-search-dropdown";

// Mock data - replace with actual API data
const TRANSPORTISTA_OPTIONS: TransportistaOption[] = [
  {
    id: "tnl",
    name: "Transportes Nacionales Libertadores Ltda",
    rut: "76.123.456-7",
    estado: "habilitado",
  },
  {
    id: "trn",
    name: "Transporte Rápido del Norte S.A.",
    rut: "77.234.567-8",
    estado: "habilitado",
  },
  {
    id: "lis",
    name: "Logística Integral del Sur Ltda",
    rut: "78.345.678-9",
    estado: "no habilitado",
  },
];

export interface ConductorOption {
  id: string;
  name: string;
  rut: string;
  estado: "habilitado" | "no habilitado";
  viajesPrevios: number;
  ultimoViaje: string;
  excesoVelocidad: number;
  faltasDescanso: number;
}

const CONDUCTOR_OPTIONS: ConductorOption[] = [
  {
    id: "c1",
    name: "Juan Pérez González",
    rut: "12.345.678-9",
    estado: "habilitado",
    viajesPrevios: 142,
    ultimoViaje: "2026-03-10",
    excesoVelocidad: 2,
    faltasDescanso: 1,
  },
  {
    id: "c2",
    name: "Carlos Rodríguez Silva",
    rut: "11.222.333-4",
    estado: "habilitado",
    viajesPrevios: 89,
    ultimoViaje: "2026-03-08",
    excesoVelocidad: 0,
    faltasDescanso: 0,
  },
  {
    id: "c3",
    name: "Miguel Ángel Torres",
    rut: "9.876.543-2",
    estado: "no habilitado",
    viajesPrevios: 56,
    ultimoViaje: "2026-02-15",
    excesoVelocidad: 5,
    faltasDescanso: 3,
  },
  {
    id: "c4",
    name: "Roberto Fernández López",
    rut: "15.678.901-K",
    estado: "habilitado",
    viajesPrevios: 203,
    ultimoViaje: "2026-03-11",
    excesoVelocidad: 1,
    faltasDescanso: 0,
  },
  {
    id: "c5",
    name: "Andrés Morales Vega",
    rut: "18.765.432-1",
    estado: "habilitado",
    viajesPrevios: 67,
    ultimoViaje: "2026-03-09",
    excesoVelocidad: 0,
    faltasDescanso: 2,
  },
];

const CAMION_OPTIONS: CamionOption[] = [
  {
    id: "t1",
    plate: "BBCC12",
    marca: "Volvo FH16",
    tipo: "camion",
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
    tipo: "camion",
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
    tipo: "furgon",
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
    tipo: "camion",
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
    tipo: "camioneta",
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

const REMOLQUE_OPTIONS: RemolqueOption[] = [
  {
    id: "r1",
    plate: "AABB11",
    tipo: "FURG",
    estado: "disponible",
    gpsIntegrado: true,
    estadoGps: "online",
    capacidadKg: 25000,
    ultimoMantenimiento: "2026-02-15",
    kilometraje: 85000,
    problemasReportados: 0,
  },
  {
    id: "r2",
    plate: "CCDD22",
    tipo: "CB40",
    estado: "ocupado",
    gpsIntegrado: true,
    estadoGps: "offline",
    capacidadKg: 30000,
    ultimoMantenimiento: "2026-01-20",
    kilometraje: 120000,
    problemasReportados: 2,
  },
  {
    id: "r3",
    plate: "EEFF33",
    tipo: "R28T",
    estado: "disponible",
    gpsIntegrado: false,
    estadoGps: "offline",
    capacidadKg: 20000,
    ultimoMantenimiento: "2026-03-01",
    kilometraje: 45000,
    problemasReportados: 0,
  },
  {
    id: "r4",
    plate: "GGHH44",
    tipo: "SIDE",
    estado: "ocupado",
    gpsIntegrado: true,
    estadoGps: "online",
    capacidadKg: 18000,
    ultimoMantenimiento: "2026-02-28",
    kilometraje: 67000,
    problemasReportados: 1,
  },
  {
    id: "r5",
    plate: "IIJJ55",
    tipo: "SIL",
    estado: "disponible",
    gpsIntegrado: true,
    estadoGps: "online",
    capacidadKg: 35000,
    ultimoMantenimiento: "2026-03-10",
    kilometraje: 92000,
    problemasReportados: 0,
  },
];

interface TruckMapDisplayProps {
  readonly camion: CamionOption;
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
  const handleZoomChange = useCallback(() => {
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
    <div className="rounded-lg flex flex-col gap-4">
      {/* Transportista Dropdown */}
      <TransportistaSearchDropdown
        label={tr("pages.planning.sidebar.assignment.transportista", dict)}
        transportistas={TRANSPORTISTA_OPTIONS}
        selectedTransportistaId={value.transportista}
        onSelect={(v: string) => handleChange("transportista", v)}
        placeholder={tr(
          "pages.planning.sidebar.assignment.selectTransportista",
          dict
        )}
        dict={dict}
      />

      {/* Conductor Dropdown */}
      <DriverSearchDropdown
        label={tr("pages.planning.sidebar.assignment.conductor", dict)}
        drivers={CONDUCTOR_OPTIONS}
        selectedDriverId={value.conductor}
        onSelect={(v: string) => handleChange("conductor", v)}
        placeholder={tr(
          "pages.planning.sidebar.assignment.selectConductor",
          dict
        )}
        dict={dict}
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

      {/* Second Conductor Dropdown (conditional) */}
      {value.hasSegundoConductor && (
        <DriverSearchDropdown
          label={tr("pages.planning.sidebar.assignment.secondConductor", dict)}
          drivers={CONDUCTOR_OPTIONS}
          selectedDriverId={value.segundoConductor}
          onSelect={(v: string) => handleChange("segundoConductor", v)}
          placeholder={tr(
            "pages.planning.sidebar.assignment.selectSecondConductor",
            dict
          )}
          dict={dict}
          excludeDriverId={value.conductor}
        />
      )}

      {/* Camión Dropdown */}
      <div>
        <TruckSearchDropdown
          label={tr("pages.planning.sidebar.assignment.camion", dict)}
          trucks={CAMION_OPTIONS}
          selectedTruckId={value.camion}
          onSelect={(v: string) => handleChange("camion", v)}
          placeholder={tr(
            "pages.planning.sidebar.assignment.selectCamion",
            dict
          )}
          dict={dict}
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
        {selectedCamion && <TruckMapDisplay camion={selectedCamion} />}
      </div>

      {/* Remolque Dropdown (conditional) */}
      {value.hasRemolque && (
        <RemolqueSearchDropdown
          label={tr("pages.planning.sidebar.assignment.remolque", dict)}
          remolques={REMOLQUE_OPTIONS}
          selectedRemolqueId={value.remolque}
          onSelect={(v: string) => handleChange("remolque", v)}
          placeholder={tr(
            "pages.planning.sidebar.assignment.selectRemolque",
            dict
          )}
          dict={dict}
        />
      )}
    </div>
  );
}
