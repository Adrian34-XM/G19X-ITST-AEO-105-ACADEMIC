import { Fragment } from "react";
import { labels, stateLabel } from "@/modules/workspace/labels";
/** Convierte códigos en etiquetas sin modificar la respuesta ni las cifras del modelo. */
export function StatusText({ text }: { text: string }) {
  return (
    <>
      {text.split(/\b([A-Z]+(?:_[A-Z]+)*)\b/g).map((part, index) =>
        labels[part] ? (
          <span
            key={index}
            className={
              "badge " +
              (["APPROVED", "COMPLETED", "PUBLISHED"].includes(part)
                ? "green"
                : ["REJECTED", "OVERDUE"].includes(part)
                  ? "red"
                  : "")
            }
          >
            {stateLabel(part)}
          </span>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}
