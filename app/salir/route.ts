import { NextResponse } from "next/server";
import { COOKIE_SESION } from "@/lib/sesion";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/ingresar", req.url), { status: 303 });
  res.cookies.delete(COOKIE_SESION);
  return res;
}
