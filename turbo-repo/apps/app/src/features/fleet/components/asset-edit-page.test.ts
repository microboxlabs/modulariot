import { describe, expect, it } from "vitest";
import type { AssetDetail } from "../fleet-api";
import { initialValues } from "./asset-edit-page";

const asset = {
  id: "TR1",
  fields: [
    { key: "label", value: "Tracto 1", source: "MANUAL", editable: true },
    { key: "carrier", value: "Andes", source: "TRIP", editable: true },
    {
      key: "gpsProvider",
      value: "GPS Austral",
      source: "SIGNAL",
      editable: false,
    },
  ],
  documents: [
    { key: "insurance", expiresAt: "2027-03-31", status: "VALID" },
    { key: "accreditation", expiresAt: null, status: "MISSING" },
  ],
} as unknown as AssetDetail;

describe("initialValues", () => {
  it("starts from the manual values only, so integration values stay as placeholders", () => {
    expect(initialValues(asset)).toEqual({
      fields: { label: "Tracto 1", carrier: "" },
      documents: {
        accreditation: "",
        technicalReview: "",
        circulationPermit: "",
        insurance: "2027-03-31",
      },
    });
  });
});
