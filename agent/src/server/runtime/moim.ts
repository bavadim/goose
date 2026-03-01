import type { MoimContext, RuntimeSession } from "./types.js";

export const createMoimStub = (sessionId: string): MoimContext => ({
  enabled: true,
  note: `moim-stub:${sessionId}`,
});

export const injectMoimInstructions = (
  session: RuntimeSession,
  baseInstructions: string,
): string => {
  if (!session.moim.enabled) {
    return baseInstructions;
  }
  const moimBlock = `MOIM_CONTEXT=${session.moim.note}`;
  return [baseInstructions, moimBlock]
    .filter((part) => part.length > 0)
    .join("\n\n");
};
