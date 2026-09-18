"use client";

import { useSyncExternalStore } from "react";
import {
  getProgressSnapshot,
  getServerProgressSnapshot,
  subscribeProgress
} from "@/lib/storage";

export function useLearningProgress() {
  return useSyncExternalStore(
    subscribeProgress,
    getProgressSnapshot,
    getServerProgressSnapshot
  );
}
