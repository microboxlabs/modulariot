export function formatRut(rut: string) {
  return rut.replace(/\./g, "").replace(/-/g, "");
}

export function isRutValid(rut: string): boolean {
  if (!rut) return false;
  rut = rut.replace(/\./g, "").replace(/-/g, "").toUpperCase();

  if (!/^\d{7,8}[0-9K]$/.test(rut)) return false;

  const body = rut.slice(0, -1);
  const dv = rut.slice(-1);

  let sum = 0,
    multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const expectedDv = 11 - (sum % 11);
  const dvCalc =
    expectedDv === 11 ? "0" : expectedDv === 10 ? "K" : expectedDv.toString();

  return dv === dvCalc;
}
