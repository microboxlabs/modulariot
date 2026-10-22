// Plus Codes de Google (Open Location Code): leerlos en la búsqueda de una
// ubicación. Un código completo ("8FVC9G8F+6X") es un punto por sí solo; uno
// corto ("9G8F+6X") se ubica cerca de una referencia (una localidad escrita
// junto a él o el centro del mapa).
//
// Decodificar y completar códigos cortos lo hace la librería `pluscodes`
// (implementación de la especificación de Google). Aquí queda lo propio de la
// búsqueda: encontrar el código dentro del texto y validar su forma, porque
// la librería no lo hace (acepta códigos fuera del globo y no lee minúsculas).
import { decode, expand } from "pluscodes";
import type { LatLon } from "../places.types";

const ALFABETO = "23456789CFGHJMPQRVWX";
const SEPARADOR = "+";
/** Relleno de los códigos de baja precisión ("8FVC0000+"). */
const RELLENO = "0";
/** Posición del "+" en un código completo. */
const POS_SEPARADOR = 8;

const DIGITO = `[${ALFABETO}${RELLENO}]`;
/** Un código (completo o corto) dentro de un texto, sin distinguir mayúsculas. */
const PATRON = new RegExp(
  `(?:^|\\s)(${DIGITO}{2,8}\\${SEPARADOR}${DIGITO}{0,7})(?=$|[\\s,])`,
  "i"
);

export type PlusCode = {
  /** El código en mayúsculas, como lo muestra Google Maps. */
  codigo: string;
  /** Completo: se decodifica solo; corto: necesita una referencia. */
  completo: boolean;
  /** Lo demás del texto (la localidad de un código corto), sin comas. */
  resto: string;
};

/**
 * Relleno válido: solo en un código completo, en pares al final de la parte
 * antes del "+" (desde una posición par) y sin nada después del "+".
 */
function rellenoValido(codigo: string, sep: number): boolean {
  const i = codigo.indexOf(RELLENO);
  if (i < 0) return true;
  if (sep !== POS_SEPARADOR || i === 0 || i % 2 !== 0) return false;
  const antes = codigo.slice(i, sep);
  return [...antes].every((c) => c === RELLENO) && sep === codigo.length - 1;
}

/** Valida la forma: "+" en posición par ≤ 8 y dígitos después solo si es 8. */
function formaValida(codigo: string): boolean {
  const sep = codigo.indexOf(SEPARADOR);
  if (sep < 2 || sep > POS_SEPARADOR || sep % 2 !== 0) return false;
  if (codigo.length - sep - 1 === 1) return false;
  if (sep < POS_SEPARADOR && codigo.length === sep + 1) return false;
  if (!rellenoValido(codigo, sep)) return false;
  // un código completo empieza dentro del rango (lat < 90, lon < 180)
  if (sep === POS_SEPARADOR) {
    const lat = ALFABETO.indexOf(codigo[0]!);
    const lon = ALFABETO.indexOf(codigo[1]!);
    if (lat * 20 >= 180 || lon * 20 >= 360) return false;
  }
  return true;
}

/** El primer Plus Code de un texto, o null si no hay. */
export function extraerPlusCode(texto: string): PlusCode | null {
  const m = PATRON.exec(texto);
  const codigo = m?.[1]?.toUpperCase();
  if (!m || !codigo || !formaValida(codigo)) return null;
  const resto = (texto.slice(0, m.index) + texto.slice(m.index + m[0].length))
    .replaceAll(",", " ")
    .replaceAll(/\s+/g, " ")
    .trim();
  return {
    codigo,
    completo: codigo.indexOf(SEPARADOR) === POS_SEPARADOR,
    resto,
  };
}

const enElGlobo = (lat: number, lon: number) =>
  Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

/** Centro del área de un código completo, [lat, lon]; null si no es válido. */
export function decodificar(codigo: string): LatLon | null {
  const area = decode(codigo.toUpperCase());
  if (!area || !enElGlobo(area.latitude, area.longitude)) return null;
  return [area.latitude, area.longitude];
}

/**
 * Un código corto ubicado en la celda más cercana a la referencia (la
 * "recuperación" de la especificación); null si no se puede completar.
 */
export function recuperarCorto(
  corto: string,
  referencia: LatLon
): LatLon | null {
  const completo = expand(corto.toUpperCase(), {
    latitude: referencia[0],
    longitude: referencia[1],
  });
  return completo ? decodificar(completo) : null;
}
