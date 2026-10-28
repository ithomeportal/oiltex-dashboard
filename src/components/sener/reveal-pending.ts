// "Review uploaded LOIs" target: scroll to and flash the first register row awaiting review.

export const PENDING_HASH = "#pending";
export const PENDING_ROW_ATTR = "data-pending-loi";

export function hasPendingRow(): boolean {
  return document.querySelector(`[${PENDING_ROW_ATTR}]`) !== null;
}

/** Returns false when no pending row is rendered yet (e.g. workspace still loading). */
export function revealPendingRows(): boolean {
  const row = document.querySelector<HTMLElement>(`[${PENDING_ROW_ATTR}]`);
  if (!row) return false;
  row.scrollIntoView({ behavior: "smooth", block: "center" });
  row.animate?.([{ backgroundColor: "#fde68a" }, { backgroundColor: "#fffbeb" }], { duration: 1800, easing: "ease-out" });
  return true;
}
