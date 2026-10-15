"use client";

import { Pause, Play } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

// The decorative renderer is loaded separately from the authentication form.
const MicroSlats = dynamic(() => import("./micro-slats"), { ssr: false });

export function LoginBackdrop() {
  const [paused, setPaused] = useState(false);

  return (
    <>
      <div className="auth-slats" aria-hidden="true">
        <MicroSlats
          preset="swell"
          color="#10b981"
          glintColor="#d4ffed"
          backgroundColor="#0a211b"
          slatWidth={10}
          slatHeight={25}
          gap={3}
          roundness={0.75}
          speed={0.4}
          interactive={!paused}
          cursorStrength={1}
          cursorSize={40}
          trail={1.4}
          intro
          paused={paused}
        />
      </div>
      <button
        type="button"
        className="auth-motion-toggle"
        onClick={() => setPaused((value) => !value)}
        aria-label={
          paused ? "Reanudar animación de fondo" : "Pausar animación de fondo"
        }
        aria-pressed={paused}
      >
        {paused ? (
          <Play size={14} aria-hidden="true" />
        ) : (
          <Pause size={14} aria-hidden="true" />
        )}
        <span>{paused ? "Reanudar fondo" : "Pausar fondo"}</span>
      </button>
    </>
  );
}
