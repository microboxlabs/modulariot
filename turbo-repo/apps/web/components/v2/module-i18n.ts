// Resolver de datos de los módulos (Torre / SuperProfile / Canales / GPS) por idioma.
// Los datos ES viven en torre-data.ts / torre-modules-data.ts; las traducciones en
// los archivos .en / .pt (mismos números, solo strings traducidos). getTorre/getModules
// devuelven el set del idioma pedido (fallback a es).

import { FAMILIES, SYMPTOMS, META, PRODDATA } from "./torre-data";
import { FAMILIES as F_EN, SYMPTOMS as S_EN, META as M_EN, PRODDATA as P_EN } from "./torre-data.en";
import { FAMILIES as F_PT, SYMPTOMS as S_PT, META as M_PT, PRODDATA as P_PT } from "./torre-data.pt";
import { GPS_DATA, ENTITY_DATA } from "./torre-modules-data";
import { GPS_DATA as GPS_EN, ENTITY_DATA as ENT_EN } from "./torre-modules-data.en";
import { GPS_DATA as GPS_PT, ENTITY_DATA as ENT_PT } from "./torre-modules-data.pt";

type Lang = "es" | "en" | "pt";

const TORRE = {
  es: { FAMILIES, SYMPTOMS, META, PRODDATA },
  en: { FAMILIES: F_EN, SYMPTOMS: S_EN, META: M_EN, PRODDATA: P_EN },
  pt: { FAMILIES: F_PT, SYMPTOMS: S_PT, META: M_PT, PRODDATA: P_PT },
};

const MODULES = {
  es: { GPS_DATA, ENTITY_DATA },
  en: { GPS_DATA: GPS_EN, ENTITY_DATA: ENT_EN },
  pt: { GPS_DATA: GPS_PT, ENTITY_DATA: ENT_PT },
};

export function getTorre(lang?: string) {
  return TORRE[(lang as Lang)] ?? TORRE.es;
}

export function getModules(lang?: string) {
  return MODULES[(lang as Lang)] ?? MODULES.es;
}
