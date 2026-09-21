import type { RootExpansionCandidate } from "@/lib/morphology/types";

// Planning data only. These entries are intentionally outside Gold Dataset v1.
const candidate = (
  root: string,
  coreMeaning: string,
  lexicalCues: string[],
  pedagogicalClarity: number,
  riskNotes: string
): RootExpansionCandidate => ({ root, coreMeaning, lexicalCues, pedagogicalClarity, riskNotes });

export const rootExpansionCandidates: RootExpansionCandidate[] = [
  candidate("act", "do; drive", ["act", "action", "active"], 92, "Can overlap with fac; require family-level review."),
  candidate("ann", "year", ["annual", "anniversary"], 91, "Short form can occur coincidentally."),
  candidate("arch", "rule; chief", ["architect", "monarch"], 78, "Multiple Greek senses need separation."),
  candidate("art", "skill; craft", ["article", "artist"], 74, "High spelling ambiguity across borrowings."),
  candidate("aud", "hear", ["audio", "audience", "audible"], 94, "Sound changes require reviewed segmentation."),
  candidate("bene", "good", ["benefit", "benevolent"], 88, "Latin prefix variants need explicit scope."),
  candidate("bio", "life", ["biology", "biography"], 93, "Greek combining form, not a universal substring."),
  candidate("centr", "center", ["central", "concentrate"], 87, "Concentrate has historical complexity."),
  candidate("chron", "time", ["chronology", "chronic"], 85, "Chronic's semantic route needs a teaching note."),
  candidate("corp", "body", ["corporate", "corps"], 83, "Separate corpus/corpse lookalikes."),
  candidate("cosm", "world; order", ["cosmic", "cosmopolitan"], 82, "Primarily academic vocabulary."),
  candidate("cur", "run; care", ["current", "occur"], 62, "Several unrelated Latin roots share the surface form."),
  candidate("dem", "people", ["democracy", "demographic"], 89, "Greek form; avoid matching common English dem- noise."),
  candidate("dom", "house; control", ["domestic", "domain"], 72, "Multiple historical senses require family split."),
  candidate("equ", "equal", ["equal", "equity", "equivalent"], 90, "Keep distinct from the lexical-family head only."),
  candidate("gen", "birth; kind", ["generate", "genetic", "general"], 76, "Broad allomorphy creates false positives."),
  candidate("grad", "step", ["graduate", "gradual"], 86, "Require semantic validation for each family."),
  candidate("graph", "write; draw", ["graphic", "photograph"], 92, "Greek combining form with transparent variants."),
  candidate("jur", "law; swear", ["jury", "jurisdiction"], 84, "Legal-register skew should be reported."),
  candidate("liter", "letter", ["literal", "literature"], 80, "Avoid confusion with unit spelling."),
  candidate("loc", "place", ["local", "location"], 88, "Short root needs exact lexical cues."),
  candidate("manu", "hand", ["manual", "manufacture"], 91, "Keep Latin and modern compounds distinct."),
  candidate("metr", "measure", ["metric", "geometry"], 86, "Greek variants need reviewed transformations."),
  candidate("nav", "ship; travel", ["navigate", "naval"], 85, "Narrow coverage; useful as an extension root."),
  candidate("nom", "name; rule", ["nominate", "economy"], 68, "Several unrelated roots share nom- forms.")
];
