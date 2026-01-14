"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

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
  urgencia: boolean;
  shutdown: boolean;
  incidencias: number;
  observaciones: string;
  prioridad: number;
}

interface PlanningSelectionContextType {
  selectedSlot: SelectedSlot | null;
  selectedService: SelectedService | null;
  selectSlot: (slot: SelectedSlot) => void;
  selectService: (service: SelectedService) => void;
  clearService: () => void;
  closeSidebar: () => void;
  clearSelection: () => void;
  isSidebarOpen: boolean;
}

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

  const selectSlot = useCallback((slot: SelectedSlot) => {
    setSelectedSlot(slot);
    // Keep service selection when changing slots
  }, []);

  const selectService = useCallback((service: SelectedService) => {
    setSelectedService(service);
  }, []);

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
        selectSlot,
        selectService,
        clearService,
        closeSidebar,
        clearSelection,
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
