import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DataSourcesPageContent from "./data-sources-page-content";

const trainer = vi.hoisted(() => ({ isTrainer: false }));

vi.mock("@/features/knowledge/hooks/use-knowledge-trainer", () => ({
  useKnowledgeTrainer: () => ({
    isTrainer: trainer.isTrainer,
    isLoading: false,
  }),
}));

vi.mock("../hooks/use-data-sources", () => ({
  useDataSources: () => ({
    dataSources: [],
    isLoading: false,
    error: null,
    actionLoading: false,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    testConnection: vi.fn(),
    testInline: vi.fn(),
    toggleActive: vi.fn(),
    refetch: vi.fn(),
  }),
}));

vi.mock("@/features/common/components/Breadcrumb/Breadcrumb", () => ({
  Breadcrumb: () => null,
}));
vi.mock("./data-source-table", () => ({ DataSourceTable: () => null }));
vi.mock("./data-source-modal", () => ({ DataSourceModal: () => null }));
vi.mock("./data-source-delete-dialog", () => ({
  DataSourceDeleteDialog: () => null,
}));

const dict = {
  dataSources: {
    title: "Data sources",
    learningWorkspace: {
      text: "Knowledge moved.",
      link: "Open learning workspace",
    },
  },
};

describe("DataSourcesPageContent", () => {
  beforeEach(() => {
    trainer.isTrainer = false;
  });

  it("links trainers to the learning workspace", () => {
    trainer.isTrainer = true;
    render(<DataSourcesPageContent dict={dict} siteId="acme" lang="es" />);

    expect(
      screen.getByRole("link", { name: "Open learning workspace" })
    ).toHaveAttribute("href", "/es/harness/learning");
  });

  it("hides the link from other members", () => {
    render(<DataSourcesPageContent dict={dict} siteId="acme" lang="es" />);

    expect(
      screen.queryByRole("link", { name: "Open learning workspace" })
    ).not.toBeInTheDocument();
  });
});
