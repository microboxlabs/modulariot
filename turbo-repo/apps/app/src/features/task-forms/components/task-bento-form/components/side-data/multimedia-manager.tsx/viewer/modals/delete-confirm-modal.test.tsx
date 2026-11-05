import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createAlfrescoSource, MediaSourceProvider } from "../../media-source";
import { DeleteConfirmModal } from "./delete-confirm-modal";

const dictionary = {
  bento: {
    multimedia: {
      delete_modal_title: "Eliminar archivo",
      delete_modal_desc: "Esto moverá el archivo a la papelera.",
      delete_modal_desc_permanent: "Este borrado es permanente.",
      btn_cancel: "Cancelar",
      btn_delete: "Eliminar",
    },
  },
};

describe("DeleteConfirmModal", () => {
  it("shows the file texts by default", () => {
    render(
      <DeleteConfirmModal
        show
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        fileName="foto.jpg"
        dictionary={dictionary}
      />
    );
    expect(screen.getByText("Eliminar archivo")).toBeInTheDocument();
    expect(
      screen.getByText("Esto moverá el archivo a la papelera.")
    ).toBeInTheDocument();
    expect(screen.getByText("foto.jpg")).toBeInTheDocument();
  });

  it("preserves the permanent-delete warning for irrecoverable media", () => {
    render(
      <MediaSourceProvider
        value={{ ...createAlfrescoSource(undefined), recoverableDelete: false }}
      >
        <DeleteConfirmModal
          show
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          fileName="demo.jpg"
          dictionary={dictionary}
        />
      </MediaSourceProvider>
    );
    expect(screen.getByText("Este borrado es permanente.")).toBeInTheDocument();
    expect(
      screen.queryByText("Esto moverá el archivo a la papelera.")
    ).toBeNull();
  });

  it("takes another title and description for other items", () => {
    const onConfirm = vi.fn();
    render(
      <DeleteConfirmModal
        show
        onClose={vi.fn()}
        onConfirm={onConfirm}
        fileName="Demo Site"
        dictionary={dictionary}
        title="Eliminar lugar"
        description="Se retira su geocerca."
      />
    );
    expect(screen.getByText("Eliminar lugar")).toBeInTheDocument();
    expect(screen.getByText("Se retira su geocerca.")).toBeInTheDocument();
    expect(screen.queryByText("Eliminar archivo")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("can show only the title, with no description", () => {
    render(
      <DeleteConfirmModal
        show
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        fileName="Demo Site"
        dictionary={dictionary}
        title="Eliminar lugar"
        description={null}
      />
    );
    expect(screen.getByText("Eliminar lugar")).toBeInTheDocument();
    expect(
      screen.queryByText("Esto moverá el archivo a la papelera.")
    ).toBeNull();
  });
});
