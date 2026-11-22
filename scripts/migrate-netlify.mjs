import { spawnSync } from "node:child_process";

if (process.env.NETLIFY) {
  const { getConnectionString } = await import("@netlify/database");
  process.env.DATABASE_URL = getConnectionString();
}

function run(command) {
  const result = spawnSync(command, { stdio: "inherit", shell: true, env: process.env });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

run("npx prisma generate");
if (process.env.NETLIFY) {
  run("npx prisma migrate deploy");
  run("npx tsx prisma/seed.ts");
}
