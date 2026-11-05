import "server-only";
import { notFound } from "next/navigation";
import {
  boardEnabled,
  type BoardModule,
} from "@/features/layout/models/board-module";

/** A 404 for the pages of a board that `BOARD_MODULE` turns off. */
export function requireBoard(module: BoardModule): void {
  if (!boardEnabled(module, process.env.BOARD_MODULE)) notFound();
}
