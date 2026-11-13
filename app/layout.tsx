import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import { leerApariencia } from "@/lib/datos";
import "./globals.css";

const texto = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--fuente-texto" });
const titulo = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--fuente-titulo" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--fuente-mono" });

export async function generateMetadata(): Promise<Metadata> {
  const ap = await leerApariencia().catch(() => null);
  return { title: ap?.empresa ?? "Cajas de Instrumental", description: "Control de producción y stock de cajas de instrumental quirúrgico" };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

const COLOR_OK = /^#[0-9a-f]{6}$/i;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ap = await leerApariencia().catch(() => null);
  const color = ap && COLOR_OK.test(ap.color) ? ap.color : null;
  const modo = ap?.modo ?? "auto";
  // Tema antes de pintar: lo que eligió la persona en este dispositivo, si no el de Configuración, si no el del sistema.
  const scriptTema = `(function(){try{var t=localStorage.getItem('tema');var m=${JSON.stringify(modo)};var d=t?t==='oscuro':m==='auto'?matchMedia('(prefers-color-scheme: dark)').matches:m==='oscuro';if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;
  return (
    <html lang="es-AR" suppressHydrationWarning className={`${texto.variable} ${titulo.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
        {color && <style>{`:root:not(.dark){--acento:${color}}`}</style>}
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
