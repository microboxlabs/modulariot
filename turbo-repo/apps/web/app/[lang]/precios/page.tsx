import { notFound } from "next/navigation";

// Página deshabilitada: sin link en el nav ni acceso directo por URL.
export default function PreciosPage(): never {
  notFound();
}
