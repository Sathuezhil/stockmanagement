import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const FILE_NAME = /^[a-f0-9]{32}\.(jpg|png|webp)$/;

export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  if (!FILE_NAME.test(filename)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stored = await prisma.storedFile.findUnique({ where: { filename } });
  if (stored) {
    return new NextResponse(Buffer.from(stored.data), {
      headers: {
        "Content-Type": stored.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  try {
    const disk = await readFile(path.join(process.cwd(), "public", "uploads", filename));
    const type = filename.endsWith(".png") ? "image/png" : filename.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return new NextResponse(disk, {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
