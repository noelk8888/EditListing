import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import sharp from "sharp";

export async function GET() {
  return NextResponse.json({ status: "Test disabled" });
}
