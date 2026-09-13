declare global {
  interface Window {
    plgAutentiaJS: new () => AutentiaType;
  }
}

export type AutentiaType = {
  Transaccion2: (
    autentiaPath: string,
    inputs: Record<string, string>,
    outputs: string[],
    giveFocusToAutentia: boolean,
    token: string | number,
    callback: AutentiaTypeCallback
  ) => void;
};

export type AutentiaTypeCallback = (result: CallbackParams) => void;

export type CallbackParams = {
  ParamsGet?: AutentiaParamsGet;
  token?: string | number;
  signature?: string;
  error?: string;
};

export type AutentiaParamsGet = {
  Erc: number;
  ercText: string;
  ErcDesc?: string;
  NroAudit?: string;
  Rut: string;
  SerialNumber?: string;
  oNombres?: string;
  oSexo?: string;
  oFchNac?: string;
};
