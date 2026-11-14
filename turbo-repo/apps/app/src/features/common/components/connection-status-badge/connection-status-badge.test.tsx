import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ConnectionStatusBadge from "./connection-status-badge";

const labels = {
  connectedLabel: "Conectado",
  disconnectedLabel: "Desconectado",
};

describe("ConnectionStatusBadge", () => {
  it.each([
    {
      name: "names the signal bars with signalLabel when given",
      props: {
        isConnected: true,
        signalStrength: 60,
        signalLabel: "Señal 3 de 4",
      },
      expected: "Señal 3 de 4",
    },
    {
      name: "names the signal bars with the status and level without signalLabel",
      props: { isConnected: true, signalStrength: 60 },
      expected: "Conectado (3/4)",
    },
    {
      name: "falls back to the status and level when signalLabel is empty",
      props: { isConnected: true, signalStrength: 20, signalLabel: "" },
      expected: "Conectado (1/4)",
    },
    {
      name: "announces no active bars while disconnected, even with a stale strength",
      props: { isConnected: false, signalStrength: 90 },
      expected: "Desconectado (0/4)",
    },
  ])("$name", ({ props, expected }) => {
    render(<ConnectionStatusBadge {...labels} {...props} />);

    expect(screen.getByRole("img", { name: expected })).toBeInTheDocument();
  });
});
