import { spawnSync } from "node:child_process";

let hosted = false;
if (!process.env.DATABASE_URL) {
  try {
    const { getConnectionString } = await import("@netlify/database");
    process.env.DATABASE_URL = getConnectionString();
    hosted = true;
  } catch {
    hosted = false;
  }
}

function run(command) {
  const result = spawnSync(command, { stdio: "inherit", shell: true, env: process.env });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

run("npx prisma generate");
if (hosted) {
  console.log("Applying the hosted database schema and stationery catalog.");
  run("npx prisma migrate deploy");
  run("npx tsx prisma/seed.ts");
}
