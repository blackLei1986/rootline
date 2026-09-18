import { getOptionalViewer } from "@/lib/auth/session";
import { LocalDataMigration } from "@/components/local-data-migration";

export async function LocalDataMigrationShell() {
  const viewer = await getOptionalViewer();
  if (!viewer?.emailVerified) return null;
  return <LocalDataMigration />;
}
