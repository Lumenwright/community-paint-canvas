// Shared stroke renderer — used by overlay, mod dashboard preview, and Phase 4 StrokePreview.
// Renders stroke data onto any 2D canvas context (including OffscreenCanvas).
// Single-responsibility: given strokes + widths, draw lines. No state held.

export interface Point {
	x: number;
	y: number;
}

/**
 * Renders strokes onto a 2D canvas context.
 * Accepts OffscreenCanvas contexts for off-thread bitmap creation.
 * The `color` param defaults to 'white' — Phase 3 will pass viewer-chosen palette colors.
 */
export function renderStrokes(
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	strokes: Point[],
	lineWidths: number[],
	color: string = 'white'
): void {
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	for (let i = 1; i < strokes.length; i++) {
		const path = new Path2D();
		path.moveTo(strokes[i - 1].x, strokes[i - 1].y);
		path.lineTo(strokes[i].x, strokes[i].y);
		ctx.lineWidth = lineWidths[i] ?? lineWidths[0] ?? 7;
		ctx.strokeStyle = color;
		ctx.stroke(path);
	}
}
