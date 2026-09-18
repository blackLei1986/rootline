import { notFound } from "next/navigation";
import manifest from "@/data/vocabulary/production-manifest.json";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function VocabularyHealthPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const quality = manifest.quality;
  const checks = [
    ["Accepted lemmas", manifest.acceptedLemmaCount.toLocaleString()],
    ["Core meaning coverage", `${Math.round(quality.coreMeaningCoverage * 100)}%`],
    ["Example coverage", `${Math.round(quality.exampleCoverage * 100)}%`],
    ["Source metadata coverage", `${Math.round(quality.sourceMetadataCoverage * 100)}%`],
    ["Tier assignment coverage", `${Math.round(quality.tierAssignmentCoverage * 100)}%`],
    ["Duplicate critical errors", quality.duplicateCriticalErrors],
    ["Broken references", quality.brokenReferences],
    ["Tier depth issues", quality.tierDepthIssues],
    ["Rejected before acceptance", manifest.rejectedBeforeAcceptance]
  ];
  return <div className="page-shell py-10 sm:py-14"><p className="label-caps text-xs font-bold text-[var(--primary)]">Development only</p><h1 className="mt-2 text-4xl font-bold">Vocabulary health</h1><p className="mt-3 text-[var(--muted-foreground)]">Production data version {manifest.version} · generated {new Date(manifest.generatedAt).toLocaleString("zh-CN")}</p><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{checks.map(([label, value]) => <Card key={label}><CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--muted-foreground)]">{label}</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{value}</p></CardContent></Card>)}</div><Card className="mt-6"><CardHeader><CardTitle>Tier distribution</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">{Object.entries(manifest.tierCounts).map(([tier, count]) => <div key={tier} className="rounded-xl bg-[var(--background)] p-4"><p className="text-xs text-[var(--muted-foreground)]">{tier}</p><p className="mt-2 text-2xl font-bold">{count}</p></div>)}</CardContent></Card></div>;
}
