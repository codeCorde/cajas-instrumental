// Todas las rutas piden sesión (también las del QR). Sin sesión → /ingresar y después vuelve a la página original.
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, leerSesion } from "@/lib/sesion";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const sesion = await leerSesion(req.cookies.get(COOKIE_SESION)?.value);
  const volver = encodeURIComponent(pathname + search);

  if (pathname.startsWith("/ingresar")) {
    // /ingresar/nombre necesita haber puesto la contraseña
    if (pathname.startsWith("/ingresar/nombre") && !sesion) return NextResponse.redirect(new URL(`/ingresar${search}`, req.url));
    return NextResponse.next();
  }
  if (!sesion) return NextResponse.redirect(new URL(`/ingresar?volver=${volver}`, req.url));
  if (!sesion.nombre) return NextResponse.redirect(new URL(`/ingresar/nombre?volver=${volver}`, req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
