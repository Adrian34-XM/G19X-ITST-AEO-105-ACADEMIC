"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

/** La URL usa la sesión del navegador; un fallo de lectura vuelve a las iniciales. */
export function ProfileAvatar({
  id,
  name,
  photoPath,
  className = "profile-avatar",
}: {
  id: string;
  name: string;
  photoPath?: string;
  className?: string;
}) {
  const src = photoPath
    ? `/api/profile-photo?id=${encodeURIComponent(id)}&v=${encodeURIComponent(photoPath.split("/").pop() || "")}`
    : "";
  const [failed, setFailed] = useState("");
  return (
    <span className={`${className} photo-avatar`}>
      {src && failed !== src ? (
        <Image
          src={src}
          alt={`Foto de ${name}`}
          width={80}
          height={80}
          unoptimized
          className="photo-avatar-image"
          onError={() => setFailed(src)}
        />
      ) : (
        <span aria-hidden="true">
          {name
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((n) => n[0])
            .join("") || "N"}
        </span>
      )}
    </span>
  );
}
export function ProfilePhotoEditor({
  id,
  name,
  photoPath,
  onSaved,
}: {
  id: string;
  name: string;
  photoPath?: string;
  onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);
  async function save(remove = false) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body = new FormData();
      if (file) body.set("file", file);
      const response = await fetch("/api/profile-photo", {
        method: remove ? "DELETE" : "POST",
        ...(remove ? {} : { body }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "No se pudo guardar la foto.");
      setFile(null);
      setPreview("");
      setMessage(remove ? "Foto eliminada." : "Foto de perfil actualizada.");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la foto.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel profile-photo-editor" aria-label="Foto de perfil">
      <div className="profile-photo-preview">
        {preview ? (
          <Image
            src={preview}
            alt="Vista previa de tu nueva foto"
            width={80}
            height={80}
            unoptimized
          />
        ) : (
          <ProfileAvatar id={id} name={name} photoPath={photoPath} />
        )}
      </div>
      <div className="profile-photo-controls">
        <h2>Tu foto de perfil</h2>
        <p>
          Se mostrará en tu perfil y en el organigrama a quienes puedan
          consultar tu información. PNG o JPG, máximo 2 MB. La imagen se recorta
          al centro.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label>
            Seleccionar foto
            <input
              type="file"
              accept="image/png,image/jpeg"
              disabled={busy}
              key={photoPath || "empty"}
              onChange={(e) => {
                const next = e.target.files?.[0] || null;
                setError("");
                setMessage("");
                if (
                  next &&
                  (next.size > 2 * 1024 * 1024 ||
                    !["image/png", "image/jpeg"].includes(next.type))
                ) {
                  setError("Selecciona una foto PNG o JPG de máximo 2 MB.");
                  e.target.value = "";
                  setFile(null);
                  setPreview("");
                  return;
                }
                setFile(next);
                setPreview(next ? URL.createObjectURL(next) : "");
              }}
            />
          </label>
          <div className="actions">
            <button disabled={busy || !file}>
              {busy ? "Guardando…" : "Guardar foto"}
            </button>
            {photoPath && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void save(true)}
              >
                Quitar foto
              </button>
            )}
          </div>
        </form>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="success" role="status">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
