import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { state, save, remove, fetchStoredLogoDataUrl, toast } = vi.hoisted(
  () => ({
    state: {
      domains: [
        {
          domain: "portal.example.com",
          logoMime: "image/png",
          logoEtag: "etag-1",
          logoDarkMime: null as string | null,
          logoDarkEtag: null as string | null,
          homeUrl: "https://www.example.com/",
          active: true,
          updatedAt: "2026-09-05T03:04:46.807Z",
          updatedBy: "owner@example.test",
        },
      ],
      isLoading: false,
      isSaving: false,
      error: null as Error | null,
    },
    save: vi.fn(),
    remove: vi.fn(),
    fetchStoredLogoDataUrl: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn() },
  })
);

vi.mock("./use-domain-brandings", () => ({
  useDomainBrandings: () => ({ ...state, save, remove }),
}));
vi.mock("./platform-data-service", () => ({
  domainLogoUrl: (domain: string, etag: string, variant = "light") =>
    `/logo/${domain}?v=${etag}&variant=${variant}`,
  fetchStoredLogoDataUrl,
}));
vi.mock("sonner", () => ({ toast }));

import DomainBrandingCard from "./domain-branding-card";

const dict = {
  domainsTitle: "Domains",
  domainsDescription: "One logo per domain.",
  domainsEmpty: "No domains configured yet.",
  loadError: "Couldn't load the configured domains.",
  addDomain: "Add domain",
  logoAlt: "{domain} logo",
  noHomeUrl: "No link",
  updatedBy: "Updated by {who}, {when}",
  hasDarkLogo: "Two logos",
  previewLight: "Light background",
  previewDark: "Dark background",
  statusActive: "Active",
  statusInactive: "Inactive",
  edit: "Edit",
  remove: "Remove",
  removeConfirm: "Confirm",
  cancel: "Cancel",
  saveError: "Couldn't save the change.",
  toast: { saved: "Saved {domain}.", removed: "Removed {domain}." },
  modal: {
    addTitle: "Add domain",
    editTitle: "Edit domain",
    subtitle: "Upload a logo.",
    editSubtitle: "Change the logo or link.",
    domainLabel: "Domain",
    domainPlaceholder: "portal.example.com",
    domainHelp: "No protocol and no port.",
    logoLabel: "Logo",
    logoHelp: "Up to {size} KB.",
    darkLogoLabel: "Dark-background logo (optional)",
    darkLogoHelp: "Use it when the main logo does not read on dark.",
    removeDarkLogo: "Remove the dark-background logo",
    darkPreviewAlt: "Dark-background logo preview",
    sameOnBoth: "This domain uses the same logo on both grounds.",
    currentLogo: "Current logo",
    newLogo: "New logo",
    previewAlt: "Logo preview",
    homeUrlLabel: "Logo link",
    homeUrlPlaceholder: "https://www.example.com/",
    homeUrlHelp: "Where the logo goes.",
    activeLabel: "Active",
    activeHelp: "Off returns the domain to the default logo.",
    save: "Save",
    saving: "Saving",
    cancel: "Cancel",
    errors: {
      domain: "Enter a valid domain.",
      logoRequired: "Choose a logo file.",
      logoType: "Unsupported format.",
      logoEmpty: "The file is empty.",
      logoSize: "The file is over the size limit.",
      logoUnreadable: "Couldn't read the logo file.",
      homeUrlLength: "The link is too long.",
      homeUrlMalformed: "The link is not a valid URL.",
      homeUrlScheme: "The link must start with http:// or https://.",
      homeUrlUserInfo: "The link can't include a username or password.",
    },
  },
};

const PNG_BYTES = new Uint8Array([1, 2, 3]);
const PNG_DATA_URL = "data:image/png;base64,AQID";

function pngFile(): File {
  return new File([PNG_BYTES], "logo.png", { type: "image/png" });
}

let user: ReturnType<typeof userEvent.setup>;

/**
 * Text goes in with fireEvent rather than userEvent.type: flowbite's modal
 * manages focus, and a portal left behind by an earlier test in this file
 * takes it back mid-word, so only the first keystroke would register.
 */
function fill(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  user = userEvent.setup();
  state.domains[0].logoDarkMime = null;
  state.domains[0].logoDarkEtag = null;
  save.mockReset();
  save.mockResolvedValue(undefined);
  remove.mockReset();
  remove.mockResolvedValue(undefined);
  fetchStoredLogoDataUrl.mockReset();
  fetchStoredLogoDataUrl.mockResolvedValue("data:image/png;base64,STORED");
  state.isLoading = false;
  state.error = null;
});

describe("DomainBrandingCard", () => {
  it("lists each configured domain with its link and status", () => {
    render(<DomainBrandingCard dict={dict} />);

    expect(screen.getByText("portal.example.com")).toBeInTheDocument();
    expect(screen.getByText("https://www.example.com/")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("reports a failed load instead of an empty list", () => {
    state.error = new Error("boom");
    render(<DomainBrandingCard dict={dict} />);

    expect(
      screen.getByText("Couldn't load the configured domains.")
    ).toBeInTheDocument();
  });

  it("saves a new domain with the picked file as a data: URL", async () => {
    render(<DomainBrandingCard dict={dict} />);

    await user.click(screen.getByRole("button", { name: "Add domain" }));
    fill("Domain", "New.Example.COM");
    await user.upload(screen.getByLabelText("Logo"), pngFile());
    await waitFor(() =>
      expect(screen.getByText("New logo")).toBeInTheDocument()
    );
    // Both grounds are captioned, so the reader is not left guessing which is
    // the light one.
    expect(screen.getByText("Light background")).toBeInTheDocument();
    expect(screen.getByText("Dark background")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith("new.example.com", {
        logoDataUrl: PNG_DATA_URL,
        logoDarkDataUrl: null,
        homeUrl: null,
        active: true,
      })
    );
  });

  it("refuses an unsupported file without calling the API", async () => {
    render(<DomainBrandingCard dict={dict} />);

    await user.click(screen.getByRole("button", { name: "Add domain" }));
    fill("Domain", "new.example.com");
    // userEvent.upload honours the accept attribute and would drop this file
    // before the handler sees it; a drag-and-drop would not.
    fireEvent.change(screen.getByLabelText("Logo"), {
      target: { files: [new File(["%PDF"], "logo.pdf", { type: "application/pdf" })] },
    });

    expect(screen.getByText("Unsupported format.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(save).not.toHaveBeenCalled();
  });

  it("refuses a domain that is not a plausible host", async () => {
    render(<DomainBrandingCard dict={dict} />);

    await user.click(screen.getByRole("button", { name: "Add domain" }));
    fill("Domain", "not..a..domain");
    await user.upload(screen.getByLabelText("Logo"), pngFile());
    await waitFor(() =>
      expect(screen.getByText("New logo")).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(save).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a valid domain.")).toBeInTheDocument();
  });

  it("refuses a home URL whose scheme would run on the sign-in page", async () => {
    render(<DomainBrandingCard dict={dict} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    fill("Logo link", "javascript:alert(1)");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(save).not.toHaveBeenCalled();
    expect(
      screen.getByText("The link must start with http:// or https://.")
    ).toBeInTheDocument();
  });

  it("resends the stored logo when an edit changes only the link", async () => {
    render(<DomainBrandingCard dict={dict} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    fill("Logo link", "https://moved.example.test/");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith("portal.example.com", {
        logoDataUrl: "data:image/png;base64,STORED",
        logoDarkDataUrl: null,
        homeUrl: "https://moved.example.test/",
        active: true,
      })
    );
    expect(fetchStoredLogoDataUrl).toHaveBeenCalledWith(
      "portal.example.com",
      "etag-1"
    );
  });

  it("does not let an edit change the domain, which would create a second row", async () => {
    render(<DomainBrandingCard dict={dict} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText("Domain")).toBeDisabled();
  });

  it("takes two clicks to remove a domain", async () => {
    render(<DomainBrandingCard dict={dict} />);

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(remove).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith("portal.example.com")
    );
  });

  it("sends both files when a dark variant is picked", async () => {
    render(<DomainBrandingCard dict={dict} />);

    await user.click(screen.getByRole("button", { name: "Add domain" }));
    fill("Domain", "new.example.com");
    await user.upload(screen.getByLabelText("Logo"), pngFile());
    await user.upload(
      screen.getByLabelText("Dark-background logo (optional)"),
      new File([new Uint8Array([4, 5, 6])], "dark.png", { type: "image/png" })
    );
    await waitFor(() =>
      expect(
        screen.getByAltText("Dark-background logo preview")
      ).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith("new.example.com", {
        logoDataUrl: PNG_DATA_URL,
        logoDarkDataUrl: "data:image/png;base64,BAUG",
        homeUrl: null,
        active: true,
      })
    );
  });

  it("says so when one logo covers both grounds", async () => {
    render(<DomainBrandingCard dict={dict} />);

    await user.click(screen.getByRole("button", { name: "Add domain" }));
    await user.upload(screen.getByLabelText("Logo"), pngFile());

    await waitFor(() =>
      expect(
        screen.getByText("This domain uses the same logo on both grounds.")
      ).toBeInTheDocument()
    );
  });

  it("resends a stored dark variant an edit does not touch", async () => {
    state.domains[0].logoDarkMime = "image/png";
    state.domains[0].logoDarkEtag = "dark-1";
    fetchStoredLogoDataUrl.mockImplementation(
      async (_domain: string, _etag: string, variant = "light") =>
        variant === "dark"
          ? "data:image/png;base64,STOREDDARK"
          : "data:image/png;base64,STORED"
    );
    render(<DomainBrandingCard dict={dict} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith("portal.example.com", {
        logoDataUrl: "data:image/png;base64,STORED",
        logoDarkDataUrl: "data:image/png;base64,STOREDDARK",
        homeUrl: "https://www.example.com/",
        active: true,
      })
    );
  });

  it("clears a stored dark variant when it is removed", async () => {
    state.domains[0].logoDarkMime = "image/png";
    state.domains[0].logoDarkEtag = "dark-1";
    render(<DomainBrandingCard dict={dict} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(
      screen.getByRole("button", { name: "Remove the dark-background logo" })
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        "portal.example.com",
        expect.objectContaining({ logoDarkDataUrl: null })
      )
    );
    // The stored dark bytes are not re-read once removal is asked for.
    expect(fetchStoredLogoDataUrl).not.toHaveBeenCalledWith(
      "portal.example.com",
      "dark-1",
      "dark"
    );
  });

  it("marks a row that ships two logos", () => {
    state.domains[0].logoDarkMime = "image/png";
    state.domains[0].logoDarkEtag = "dark-1";
    render(<DomainBrandingCard dict={dict} />);

    expect(screen.getByText("Two logos")).toBeInTheDocument();
  });
});
