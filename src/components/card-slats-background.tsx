"use client";

import dynamic from "next/dynamic";
import { Pause, Play } from "lucide-react";
import { useState } from "react";

const MicroSlats = dynamic(() => import("./micro-slats"), { ssr: false });

/** Fondo decorativo de las tarjetas; no recibe datos de personas ni de formularios. */
export function CardSlatsBackground({
  variant,
}: {
  variant: "overview" | "profile";
}) {
  const [paused, setPaused] = useState(false);
  const profile = variant === "profile";

  return (
    <>
      <div className="card-slats" aria-hidden="true">
        <MicroSlats
          preset="signal"
          color="#10b981"
          glintColor="#ffffff"
          backgroundColor="#000000"
          slatWidth={10}
          slatHeight={25}
          gap={profile ? 1 : 3}
          roundness={0.75}
          interactive={!paused}
          cursorStrength={profile ? 0.9 : 1}
          cursorSize={40}
          swirl={0}
          trail={profile ? 2.4 : 1.4}
          lean={0}
          intro
          paused={paused}
        />
      </div>
      <button
        type="button"
        className="card-slats-toggle"
        aria-label={
          paused ? "Reanudar fondo de la tarjeta" : "Pausar fondo de la tarjeta"
        }
        title={paused ? "Reanudar fondo" : "Pausar fondo"}
        aria-pressed={paused}
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? (
          <Play size={14} aria-hidden="true" />
        ) : (
          <Pause size={14} aria-hidden="true" />
        )}
      </button>
    </>
  );
}
