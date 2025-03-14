import { AutentiaParamsGet } from "./autentia.types";

const defaultOutputs = [
  "Erc",
  "NroAudit",
  "ErcDesc",
  "oNombres",
  "oSexo",
  "oFchNac",
];

export function validateRut(Rut: string): Promise<AutentiaParamsGet> {
  const Autentia = new window.plgAutentiaJS();
  const inputs = { Rut };
  const autentiaPath = process.env.NEXT_PUBLIC_AUTENTIA_PATH;
  const giveFocusToAutentia = true;
  const token = Math.floor(Math.random() * 1e15);
  const promise = new Promise<AutentiaParamsGet>((resolve, reject) => {
    try {
      Autentia.Transaccion2(
        autentiaPath!,
        inputs,
        defaultOutputs,
        giveFocusToAutentia,
        token,
        (result) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (result.ParamsGet.Erc !== 0) {
            // Error rut, resultado
            const error: Error & { status?: number } = new Error(
              result.ParamsGet.ercText || "rut validation failed",
            );
            error.status = result.ParamsGet.Erc;
            reject(error);
          }

          if (
            typeof result.token === "string" &&
            token === parseFloat(result.token.replace(",", "."))
          ) {
            resolve(result.ParamsGet);
          } else {
            // Error rut, resultado
            const error: Error & { status?: number } = new Error(
              result.ParamsGet.ercText || "rut validation failed",
            );
            error.status = 500;
            reject(error);
          }
        },
      );
    } catch (error) {
      reject(error);
    }
  });
  return promise;
}

export function fakeValidateRut(_pRut: string): Promise<AutentiaParamsGet> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        Erc: 0,
        ercText: "",
        NroAudit: "SMIN-M1KG-BYBF-JJD4",
        Rut: "",
      });
    }, 2000);
  });
}
