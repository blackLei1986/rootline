export function estimateRemainingMinutes(estimatedMinutes: number, completed: number, required: number): number | null {
  if (!Number.isFinite(estimatedMinutes) || estimatedMinutes <= 0 || !Number.isFinite(required) || required <= 0) return null;
  const remaining = Math.max(0, required - Math.min(required, Math.max(0, completed)));
  return Math.ceil(estimatedMinutes * remaining / required);
}
