// Plus Codes de Google (Open Location Code): leerlos en la búsqueda de una
// ubicación. Un código completo ("8FVC9G8F+6X") es un punto por sí solo; uno
// corto ("9G8F+6X") se ubica cerca de una referencia (una localidad escrita
// junto a él o el centro del mapa). Algoritmo de la especificación pública:
// https://github.com/google/open-location-code/blob/main/Documentation/Specification/specification.md
import type { LatLon } from "./places.types";

const ALFABETO = "23456789CFGHJMPQRVWX";
const SEPARADOR = "+";
/** Posición del "+" en un código completo. */
const POS_SEPARADOR = 8;
/** Dígitos en pares (lat/lon alternados); después viene la grilla 5×4. */
const DIGITOS_PARES = 10;
const RES_PARES = [20, 1, 0.05, 0.0025, 0.000125];
const FILAS_GRILLA = 5;
const COLUMNAS_GRILLA = 4;

const DIGITO = `[${ALFABETO}]`;
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

/** Valida la forma: "+" en posición par ≤ 8 y dígitos después solo si es 8. */
function formaValida(codigo: string): boolean {
  const sep = codigo.indexOf(SEPARADOR);
  if (sep < 2 || sep > POS_SEPARADOR || sep % 2 !== 0) return false;
  const despues = codigo.length - sep - 1;
  if (despues === 1) return false;
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

/** Centro del área de un código completo, [lat, lon]. */
export function decodificar(codigo: string): LatLon {
  const digitos = codigo.replace(SEPARADOR, "").toUpperCase();
  let lat = -90;
  let lon = -180;
  let resLat = 20;
  let resLon = 20;
  const pares = Math.min(digitos.length, DIGITOS_PARES);
  for (let i = 0; i < pares; i += 2) {
    const res = RES_PARES[i / 2]!;
    lat += ALFABETO.indexOf(digitos[i]!) * res;
    lon += ALFABETO.indexOf(digitos[i + 1] ?? "2") * res;
    resLat = res;
    resLon = res;
  }
  for (let i = DIGITOS_PARES; i < digitos.length; i++) {
    const v = ALFABETO.indexOf(digitos[i]!);
    resLat /= FILAS_GRILLA;
    resLon /= COLUMNAS_GRILLA;
    lat += Math.floor(v / COLUMNAS_GRILLA) * resLat;
    lon += (v % COLUMNAS_GRILLA) * resLon;
  }
  return [lat + resLat / 2, lon + resLon / 2];
}

/** Los primeros `largo` dígitos (en pares) del código de un punto. */
function codificarPares(lat: number, lon: number, largo: number): string {
  let y = Math.min(Math.max(lat, -90), 90 - 1e-10) + 90;
  let x = (((lon + 180) % 360) + 360) % 360;
  let out = "";
  for (let i = 0; i < largo / 2; i++) {
    const res = RES_PARES[i]!;
    const dy = Math.floor(y / res);
    const dx = Math.floor(x / res);
    y -= dy * res;
    x -= dx * res;
    out += ALFABETO[dy]! + ALFABETO[dx]!;
  }
  return out;
}

/**
 * Un código corto ubicado en la celda más cercana a la referencia (la
 * "recuperación" de la especificación): toma los dígitos que le faltan de la
 * referencia y corrige si el resultado cae del otro lado del borde.
 */
export function recuperarCorto(corto: string, referencia: LatLon): LatLon {
  const codigo = corto.toUpperCase();
  const faltan = POS_SEPARADOR - codigo.indexOf(SEPARADOR);
  const res = 20 ** (2 - faltan / 2);
  const mitad = res / 2;
  const [refLat, refLon] = referencia;
  const completo = codificarPares(refLat, refLon, faltan) + codigo;
  let [lat, lon] = decodificar(completo);
  if (refLat + mitad < lat && lat - res >= -90) lat -= res;
  else if (refLat - mitad > lat && lat + res <= 90) lat += res;
  if (refLon + mitad < lon) lon -= res;
  else if (refLon - mitad > lon) lon += res;
  return [lat, lon];
}
