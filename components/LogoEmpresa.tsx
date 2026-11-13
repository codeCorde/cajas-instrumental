/** Logo de Configuración → Apariencia (servido por /archivos/logo). Si no hay, una marca simple. */
export default function LogoEmpresa({ logoPath, grande }: { logoPath: string | null; grande?: boolean }) {
  const tam = grande ? "h-14 w-14" : "h-8 w-8";
  if (logoPath) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/archivos/logo" alt="" className={`${tam} object-contain`} />;
  }
  return (
    <span aria-hidden="true" className={`${tam} grid place-items-center rounded bg-acento text-acento-texto font-mono text-xs font-bold`}>
      CI
    </span>
  );
}
