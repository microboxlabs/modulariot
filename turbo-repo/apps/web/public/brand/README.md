# Brand assets

The Modular IoT platform marks live here. Both files are the **real platform
logos** rescued from the design system export
(`design-ref/.../assets/{logo.svg,logo2.svg}`).

## Files

| file                          | role                                          | notes                                                                                                                       |
|-------------------------------|-----------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| `logo-modulariot.svg`         | Horizontal lockup — mark + "ModularIoT" wordmark | 1052×256, navy `#072444` fill on transparent bg. Use on light surfaces. For dark surfaces, apply CSS `brightness-0 invert` to render white. |
| `logo-modulariot-mark.svg`    | Mark only                                     | 1024×1024, same navy fill. Use for favicon source, social cards, places where the wordmark is redundant.                    |

A dedicated knocked-out white lockup (e.g. `logo-modulariot-dark.svg`) is
listed as "TBD" in the design system. Until it ships, the CSS-filter trick
on `logo-modulariot.svg` is the supported dark-mode treatment.

## Tenant-vs-platform reminder

These are **platform** assets — every tenant implementation (Mintral, Gama,
SQM, etc.) gets its own logo slotted in via the same dimensions and clear-
space rules. Tenant logos are NOT shipped on this marketing site; they live
under `assets/tenants/<tenant>/` in the design system and are loaded only
inside the secured app surfaces a given tenant runs.

## What used to be here

Run-1 of the ralph loop rescued Mintral-tenant SVG logos from
`apps/web-site/public/` thinking they were Modular IoT platform brand. They
were actually Mintral assets (Selective Yellow `#FFB017` + Blaze Orange
`#C54600` — Mintral's mining-logistics brand). Those were purged in PA-iter-2
of run-2 once the design system clarified the platform-vs-tenant split, and
replaced briefly with a CSS BrandMark pattern. PA-iter-13 (this iter) rescues
the **real** platform marks from the design system export and uses them in
header + footer. The CSS BrandMark file was deleted.
