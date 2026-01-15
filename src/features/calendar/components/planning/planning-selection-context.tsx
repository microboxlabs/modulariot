"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import dayjs from "dayjs";

/**
 * Represents a selected time slot in the calendar
 */
export interface SelectedSlot {
  date: Date;
  hour: number;
  minutes: number;
  dayIndex?: number; // For week view
}

/**
 * Lead time status for a service
 */
export type LeadTimeStatus = "on_time" | "warning" | "delayed";

/**
 * Trip type options
 */
export type TripType = "Sider" | "Doble Sider" | "Rampla";

/**
 * Represents a service that can be selected in the planning calendar
 * Based on the Service mock data contract
 */
export interface SelectedService {
  id: string;
  cliente: string;
  origen: string;
  lugarCarguio: string;
  destino: string;
  tipoViaje: TripType;
  ocupacion: number; // percentage 0-100
  permanencia: string;
  leadTime: {
    deadline: string; // ISO date
    status: LeadTimeStatus;
  };
  eta: string; // ISO datetime
  incidencias: string[]; // e.g. ['urgencia', 'shutdown', 'c5']
  observaciones: string;
  prioridad: number;
}

/**
 * A service that has been confirmed and placed in a slot
 */
export interface PlannedService {
  service: SelectedService;
  slot: SelectedSlot;
}

interface PlanningSelectionContextType {
  selectedSlot: SelectedSlot | null;
  selectedService: SelectedService | null;
  plannedServices: PlannedService[];
  selectSlot: (slot: SelectedSlot) => void;
  selectService: (service: SelectedService) => void;
  confirmService: () => void;
  clearService: () => void;
  closeSidebar: () => void;
  clearSelection: () => void;
  getServicesForSlot: (slot: SelectedSlot) => PlannedService[];
  canAddToSlot: (slot: SelectedSlot) => boolean;
  isSidebarOpen: boolean;
}

const MAX_SERVICES_PER_SLOT = 3;

const PlanningSelectionContext =
  createContext<PlanningSelectionContextType | null>(null);

interface PlanningSelectionProviderProps {
  children: ReactNode;
}

export function PlanningSelectionProvider({
  children,
}: PlanningSelectionProviderProps) {
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [selectedService, setSelectedService] =
    useState<SelectedService | null>(null);
  const [plannedServices, setPlannedServices] = useState<PlannedService[]>([]);

  const selectSlot = useCallback((slot: SelectedSlot) => {
    setSelectedSlot(slot);
    // Keep service selection when changing slots
  }, []);

  const selectService = useCallback((service: SelectedService) => {
    setSelectedService(service);
  }, []);

  const getServicesForSlot = useCallback(
    (slot: SelectedSlot) => {
      return plannedServices.filter(
        (ps) =>
          dayjs(ps.slot.date).isSame(slot.date, "day") &&
          ps.slot.hour === slot.hour &&
          ps.slot.minutes === slot.minutes
      );
    },
    [plannedServices]
  );

  const canAddToSlot = useCallback(
    (slot: SelectedSlot) => {
      const servicesInSlot = getServicesForSlot(slot);
      return servicesInSlot.length < MAX_SERVICES_PER_SLOT;
    },
    [getServicesForSlot]
  );

  const confirmService = useCallback(() => {
    if (selectedSlot && selectedService) {
      // Check if slot has room (unless re-planning same service)
      const existingInSlot = getServicesForSlot(selectedSlot);
      const isReplanning = existingInSlot.some(
        (ps) => ps.service.id === selectedService.id
      );

      if (!isReplanning && existingInSlot.length >= MAX_SERVICES_PER_SLOT) {
        // Slot is full, cannot add more
        return;
      }

      setPlannedServices((prev) => {
        // Remove if already planned (allow re-planning)
        const filtered = prev.filter(
          (p) => p.service.id !== selectedService.id
        );
        return [...filtered, { service: selectedService, slot: selectedSlot }];
      });
      // Clear selection after confirming
      setSelectedSlot(null);
      setSelectedService(null);
    }
  }, [selectedSlot, selectedService, getServicesForSlot]);

  const clearService = useCallback(() => {
    setSelectedService(null);
  }, []);

  const closeSidebar = useCallback(() => {
    setSelectedSlot(null);
    setSelectedService(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSlot(null);
    setSelectedService(null);
  }, []);

  // Sidebar is open when either a slot or service is selected
  const isSidebarOpen = selectedSlot !== null || selectedService !== null;

  return (
    <PlanningSelectionContext.Provider
      value={{
        selectedSlot,
        selectedService,
        plannedServices,
        selectSlot,
        selectService,
        confirmService,
        clearService,
        closeSidebar,
        clearSelection,
        getServicesForSlot,
        canAddToSlot,
        isSidebarOpen,
      }}
    >
      {children}
    </PlanningSelectionContext.Provider>
  );
}

export function usePlanningSelection() {
  const context = useContext(PlanningSelectionContext);
  if (!context) {
    throw new Error(
      "usePlanningSelection must be used within a PlanningSelectionProvider"
    );
  }
  return context;
}
