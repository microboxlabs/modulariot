"use client";

// El botón de Lugares para mapas que no son la vista geográfica (el mapa de
// viaje del bento y de síntomas): la misma barra del notch, con un solo
// ítem y el estado de quien la usa.
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { MapNotchBar, NOTCH_ITEMS } from "../map-notch/map-notch";

const SOLO_LUGARES = NOTCH_ITEMS.filter((item) => item.id === "places");

export default function PlacesToggle({
  dict,
  abierto,
  onCambiar,
}: Readonly<{
  dict: I18nRecord;
  abierto: boolean;
  onCambiar: (abierto: boolean) => void;
}>) {
  return (
    <MapNotchBar
      dict={dict}
      items={SOLO_LUGARES}
      activeView={abierto ? "places" : null}
      onToggle={() => onCambiar(!abierto)}
    />
  );
}
