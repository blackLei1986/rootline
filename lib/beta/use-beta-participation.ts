"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getBetaParticipation, subscribeBetaParticipation } from "@/lib/beta/validation-store";

const serverSnapshot = () => false;

export function useBetaParticipation(userId: string): boolean {
  const subscribe = useCallback((listener: () => void) => subscribeBetaParticipation(userId, listener), [userId]);
  const getSnapshot = useCallback(() => getBetaParticipation(userId), [userId]);
  return useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
}
