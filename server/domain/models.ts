import type { Conflict, ConflictState } from "../../src/shared/types";

export class InvalidTransition extends Error {
  constructor(id: string, state: ConflictState) {
    super(`conflict ${id} is ${state}, not open`);
    this.name = "InvalidTransition";
  }
}

export function resolveConflict(conflict: Conflict, decisionId: string): Conflict {
  assertOpen(conflict);
  return { ...conflict, state: "resolved", decisionId };
}

export function dismissConflict(conflict: Conflict): Conflict {
  assertOpen(conflict);
  return { ...conflict, state: "dismissed" };
}

export function assertOpen(conflict: Conflict): void {
  if (conflict.state !== "open") {
    throw new InvalidTransition(conflict.id, conflict.state);
  }
}
