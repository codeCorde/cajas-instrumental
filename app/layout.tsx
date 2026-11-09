import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const texto = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--fuente-texto" });
const titulo = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--fuente-titulo" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--fuente-mono" });

export const metadata: Metadata = {
  title: "Control de Cajas de Instrumental",
  description: "Control de producción y stock de cajas de instrumental quirúrgico",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Aplica el tema antes de pintar para evitar parpadeo (claro / oscuro / sistema).
const scriptTema = `(function(){try{var t=localStorage.getItem('tema');var d=t?t==='oscuro':matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" suppressHydrationWarning className={`${texto.variable} ${titulo.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
