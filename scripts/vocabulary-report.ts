import { createCoverageReport } from "@/pipeline/reports";

console.log("Vocabulary Coverage Report");
console.log(JSON.stringify(createCoverageReport(), null, 2));
