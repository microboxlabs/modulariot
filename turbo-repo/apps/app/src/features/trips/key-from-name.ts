/** Lowercase letters, digits and dashes from a name: "Servicio directo" → "servicio-directo". */
export function keyFromName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-/, "")
    .replace(/-$/, "")
    .slice(0, 64);
}
