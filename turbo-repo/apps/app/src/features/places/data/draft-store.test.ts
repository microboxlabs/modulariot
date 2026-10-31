import { beforeEach, describe, expect, it } from "vitest";
import {
  borrarBorrador,
  guardarBorrador,
  hayBorrador,
  leerBorrador,
} from "./draft-store";
import { FORM_VACIO, TRAY_VACIO } from "../places.types";

const SCOPE = JSON.stringify(["demo-user", "demo-org"]);
const DIA = 24 * 60 * 60 * 1000;

describe("draft store", () => {
  beforeEach(() => window.localStorage.clear());

  it("brings back a place form as it was left", () => {
    // with its shape and the "Posicionar geocerca" search
    const form = {
      ...FORM_VACIO,
      name: "Planta",
      lat: -33,
      lon: -70,
      geom: "polygon" as const,
      polyBase: "rect" as const,
      rect_w_m: 340,
      vertices: [
        [-33, -70],
        [-33, -69.99],
        [-33.01, -69.99],
      ] as [number, number][],
      busqueda: "Parque Araucano, Las Condes",
      ubicadoEn: "Parque Araucano, Las Condes",
    };
    guardarBorrador("geografico", SCOPE, {
      tipo: "lugar",
      form,
      paso: "interiores",
      original: null,
      inicial: null,
    });
    expect(leerBorrador("geografico", SCOPE)).toEqual({
      tipo: "lugar",
      form,
      paso: "interiores",
      original: null,
      inicial: null,
    });
  });

  it("brings back a route form with its snapped path", () => {
    const tray = { ...TRAY_VACIO, id: "t1", name: "Ruta 5" };
    guardarBorrador("viaje", SCOPE, {
      tipo: "trayecto",
      tray,
      paso: "datos",
      original: tray,
      inicial: tray,
      pathAjustado: [[-33, -70]],
    });
    const b = leerBorrador("viaje", SCOPE);
    expect(b?.tipo).toBe("trayecto");
    if (b?.tipo !== "trayecto") return;
    expect(b.tray).toEqual(tray);
    expect(b.original).toEqual(tray);
    expect(b.pathAjustado).toEqual([[-33, -70]]);
  });

  it("keeps one draft per map", () => {
    guardarBorrador("viaje", SCOPE, {
      tipo: "lugar",
      form: FORM_VACIO,
      paso: "geocerca",
      original: null,
      inicial: null,
    });
    expect(hayBorrador("viaje", SCOPE)).toBe(true);
    expect(hayBorrador("geografico", SCOPE)).toBe(false);
  });

  it("fills fields added after the draft was saved", () => {
    window.localStorage.setItem(
      `miot.places.draft.v1.geografico:${encodeURIComponent(SCOPE)}`,
      JSON.stringify({
        guardadoEn: Date.now(),
        borrador: {
          tipo: "lugar",
          form: { name: "Viejo" },
          paso: "geocerca",
          original: null,
          inicial: null,
        },
      })
    );
    const b = leerBorrador("geografico", SCOPE);
    expect(b?.tipo === "lugar" && b.form).toEqual({
      ...FORM_VACIO,
      name: "Viejo",
    });
  });

  it("drops unreadable and week-old drafts", () => {
    window.localStorage.setItem(
      `miot.places.draft.v1.geografico:${encodeURIComponent(SCOPE)}`,
      "{nope"
    );
    expect(leerBorrador("geografico", SCOPE)).toBeNull();
    expect(
      window.localStorage.getItem(
        `miot.places.draft.v1.geografico:${encodeURIComponent(SCOPE)}`
      )
    ).toBeNull();

    guardarBorrador("geografico", SCOPE, {
      tipo: "lugar",
      form: FORM_VACIO,
      paso: "geocerca",
      original: null,
      inicial: null,
    });
    expect(leerBorrador("geografico", SCOPE, Date.now() + 8 * DIA)).toBeNull();
    expect(hayBorrador("geografico", SCOPE)).toBe(false);
  });

  it("forgets the draft once it is cleared", () => {
    guardarBorrador("geografico", SCOPE, {
      tipo: "lugar",
      form: FORM_VACIO,
      paso: "geocerca",
      original: null,
      inicial: null,
    });
    borrarBorrador("geografico", SCOPE);
    expect(hayBorrador("geografico", SCOPE)).toBe(false);
  });
});

describe("draft identity isolation", () => {
  it("does not restore or clear another identity's draft or legacy data", () => {
    localStorage.clear();
    const draft = {
      tipo: "lugar" as const,
      form: { ...FORM_VACIO, name: "Demo private" },
      paso: "geocerca" as const,
      original: null,
      inicial: null,
    };
    guardarBorrador("geografico", SCOPE, draft);
    localStorage.setItem(
      "miot.places.draft.v1.geografico",
      JSON.stringify({ guardadoEn: Date.now(), borrador: draft })
    );
    for (const other of [null, "demo-other-user", "demo-other-org"]) {
      expect(leerBorrador("geografico", other)).toBeNull();
      borrarBorrador("geografico", other);
      guardarBorrador("geografico", other, draft);
    }
    expect(leerBorrador("geografico", SCOPE)).toEqual(draft);
    expect(
      localStorage.getItem("miot.places.draft.v1.geografico")
    ).not.toBeNull();
    expect(localStorage).toHaveLength(4);
  });
});
