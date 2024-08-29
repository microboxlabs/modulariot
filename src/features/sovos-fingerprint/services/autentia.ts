const defaultOutputs = [
  "Erc",
  "NroAudit",
  "ErcDesc",
  "oNombres",
  "oSexo",
  "oFchNac",
];

export function validateRut(pRut: string): Promise<boolean> {
  const Autentia = new window.plgAutentiaJS();
  const inputs = { pRut };
  const autentiaPath = process.env.NEXT_PUBLIC_AUTENTIA_PATH;
  const giveFocusToAutentia = true;
  const token = Math.floor(Math.random() * 1e15);
  const promise = new Promise<boolean>((resolve, reject) => {
    try {
      Autentia.Transaccion2(
        autentiaPath!,
        inputs,
        defaultOutputs,
        giveFocusToAutentia,
        token,
        (result) => {
          console.log(result);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (result.ParamsGet.Erc > 0) {
            // Error rut, resultado
            console.error(result);
            const error: Error & { status?: number } = new Error(
              "rut validation failed",
            );
            error.status = result.ParamsGet.Erc;
            reject(error);
          }

          if (
            typeof result.token === "string" &&
            token === parseFloat(result.token.replace(",", "."))
          ) {
            resolve(true);
          } else {
            // Error rut, resultado
            console.error(result);
            const error: Error & { status?: number } = new Error(
              "rut validation failed",
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

export function fakeValidateRut(_pRut: string): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, 2000);
  });
}
