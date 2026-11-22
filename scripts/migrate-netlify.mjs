import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

let hostedUrl = process.env.NETLIFY_DB_URL || "";
if (!hostedUrl) {
  try {
    const { getConnectionString } = await import("@netlify/database");
    hostedUrl = getConnectionString() || "";
  } catch (error) {
    console.error("hosted-db", error instanceof Error ? error.name : "unavailable");
  }
}

function run(command) {
  const result = spawnSync(command, { stdio: "inherit", shell: true, env: process.env });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

run("npx prisma generate");

if (!hostedUrl) {
  if (process.env.NETLIFY === "true") {
    console.error("hosted-db missing during the Netlify build");
    process.exit(1);
  }
  process.exit(0);
}

process.env.DATABASE_URL = hostedUrl;
const user = hostedUrl.match(/^postgres(?:ql)?:\/\/([^:@/]+)/)?.[1] ?? "unknown";
if (process.env.NETLIFY === "true") {
  writeFileSync("src/lib/hosted-db.ts", `import "server-only";\n\nexport const hostedDatabaseUrl = ${JSON.stringify(hostedUrl)};\n`);
}
console.log(`Applying the hosted database schema and stationery catalog as ${user}.`);
run("npx prisma migrate deploy");
run("npx tsx prisma/seed.ts");
