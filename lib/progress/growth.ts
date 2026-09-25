export interface GrowthPoint { date: string; stable: number }

export function buildObservedGrowth(
  snapshots: readonly {learningDate: string; stableCount: number}[], todayDate: string
): {points: GrowthPoint[]; hasTrend: boolean; firstObservedDate: string | null} {
  const latestByDate = new Map<string, number>();
  for (const snapshot of snapshots) {
    if (snapshot.learningDate <= todayDate) latestByDate.set(snapshot.learningDate, snapshot.stableCount);
  }
  const points = [...latestByDate].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stable]) => ({date, stable}));
  return {points, hasTrend: points.length >= 2, firstObservedDate: points[0]?.date ?? null};
}
