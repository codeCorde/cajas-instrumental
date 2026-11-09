"use client";
import { useEffect, useState } from "react";

export default function TemaToggle() {
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => setOscuro(document.documentElement.classList.contains("dark")), []);

  function cambiar() {
    const nuevo = !oscuro;
    setOscuro(nuevo);
    document.documentElement.classList.toggle("dark", nuevo);
    try {
      localStorage.setItem("tema", nuevo ? "oscuro" : "claro");
    } catch {}
  }

  return (
    <button type="button" onClick={cambiar} className="btn px-3" aria-label={oscuro ? "Pasar a modo claro" : "Pasar a modo oscuro"}>
      <span aria-hidden="true">{oscuro ? "☀" : "☾"}</span>
    </button>
  );
}
