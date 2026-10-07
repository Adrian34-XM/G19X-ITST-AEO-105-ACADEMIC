import type { Row } from "./types";
/** La finalización validada prevalece sobre banderas antiguas de pendiente. */
export function pendingTrainingReview(assignment: Row): boolean {
  return (
    assignment.status !== "COMPLETED" &&
    (assignment.progress_review_pending === true ||
      assignment.status === "SUBMITTED")
  );
}
