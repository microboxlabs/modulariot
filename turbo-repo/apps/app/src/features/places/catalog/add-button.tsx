"use client";

// "Agregar" de la lista: elige qué crear, una geocerca o un trayecto. Abre
// el mismo formulario que el clic derecho en el mapa.
import { Dropdown, DropdownItem } from "flowbite-react";
import {
  HiOutlineLocationMarker,
  HiOutlineSwitchHorizontal,
  HiPlus,
} from "react-icons/hi";

export default function AddButton({
  onGeocerca,
  onTrayecto,
}: Readonly<{
  onGeocerca: () => void;
  onTrayecto: () => void;
}>) {
  return (
    <Dropdown
      label=""
      inline
      dismissOnClick
      placement="bottom-start"
      renderTrigger={() => (
        <button
          type="button"
          className="flex w-full shrink-0 cursor-pointer items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
        >
          <HiPlus className="h-3.5 w-3.5" />
          Agregar
        </button>
      )}
    >
      <DropdownItem icon={HiOutlineLocationMarker} onClick={onGeocerca}>
        Geocerca
      </DropdownItem>
      <DropdownItem icon={HiOutlineSwitchHorizontal} onClick={onTrayecto}>
        Trayecto
      </DropdownItem>
    </Dropdown>
  );
}
