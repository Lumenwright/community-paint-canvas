// Client-side alpha fading — derives opacity from timestamps + grace_seconds.
// No backend writes. Called every rAF frame for each cached bitmap.
// Per D-07: alpha is computed entirely client-side from approved_at/expires_at timestamps.
//
// Flow: full opacity during grace period → linear fade from graceEnd to fadeEnd → fully transparent.

/**
 * Computes the drawing's current opacity [0, 1].
 *
 * @param approvedAt - When the drawing was placed on the canvas.
 * @param expiresAt  - When the drawing should be fully transparent. Null means it never fades.
 * @param graceSeconds - Seconds of full opacity after approvedAt before fading begins.
 * @returns Opacity in the range [0.0, 1.0].
 */
export function computeAlpha(
	approvedAt: Date,
	expiresAt: Date | null,
	graceSeconds: number
): number {
	// grace_seconds = 0 (or expiresAt null) means the drawing never fades
	if (expiresAt === null) return 1.0;

	const now = Date.now();
	const graceEnd = approvedAt.getTime() + graceSeconds * 1000;
	const fadeEnd = expiresAt.getTime();

	if (now < graceEnd) return 1.0;
	if (now >= fadeEnd) return 0.0;

	// Linear interpolation through the fade window
	return 1.0 - (now - graceEnd) / (fadeEnd - graceEnd);
}
