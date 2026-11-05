import { describe, expect, it } from "vitest";
import type { TowerContact } from "@/features/symptoms/control-tower/control-tower-api";
import { contactSamples, MAX_CONTACT_SAMPLES } from "./contact-samples";

const contact = (patch: Partial<TowerContact>): TowerContact =>
  ({
    id: "c",
    name: "Ana",
    role: "Conductor",
    phone: "+12025550101",
    methods: [],
    active: true,
    notes: null,
    nationalId: "000000019",
    nationalIdType: "RUT",
    company: "Transportes Sur",
    companyRut: "000000030",
    position: null,
    channels: null,
    tags: null,
    memberUserId: null,
    provisional: false,
    lastCalledAt: null,
    answered: 0,
    missed: 0,
    ...patch,
  }) as TowerContact;

describe("contactSamples", () => {
  it("gives each active contact as `contact`, as the server builds it, beside the event's fields", () => {
    const { samples, labels } = contactSamples(
      [contact({}), contact({ id: "off", name: "Inactivo", active: false })],
      [{ name: "carrierRut", type: "string", label: "RUT" }]
    );
    expect(labels).toEqual(["Ana"]);
    expect(samples).toEqual([
      {
        contact: {
          id: "c",
          name: "Ana",
          role: "Conductor",
          roleKey: "conductor",
          tags: [],
          company: "Transportes Sur",
          companyRut: "000000030",
          nationalId: "000000019",
          position: "",
          member: false,
          email: "",
          whatsapp: "+12025550101",
        },
        event: { data: { carrierRut: "" } },
      },
    ]);
  });

  it("pages through at most the first contacts", () => {
    const many = Array.from({ length: MAX_CONTACT_SAMPLES + 5 }, (_, i) =>
      contact({ id: String(i), name: `C${i}` })
    );
    expect(contactSamples(many, []).samples).toHaveLength(MAX_CONTACT_SAMPLES);
  });
});
