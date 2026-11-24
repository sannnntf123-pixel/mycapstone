/** Fired after a question is approved or rejected, so the nav's review badge stays current. */
export const REVIEW_CHANGED = "review-queue-changed";

export const notifyReviewChanged = () => window.dispatchEvent(new Event(REVIEW_CHANGED));
