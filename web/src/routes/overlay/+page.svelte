<script lang="ts">
	// OBS browser source overlay — renders approved drawings with alpha fading on a transparent canvas.
	// No auth required; the overlay is a public read-only surface for the stream audience.
	//
	// Flow: mount → subscribe to Realtime (INSERT/DELETE drawings, UPDATE settings) →
	//        load existing drawings → rAF loop composites cached bitmaps with computeAlpha() fading.
	import { onMount } from 'svelte';
	import { supabase } from '$lib/client/supabase.js';
	import { renderStrokes, type Point } from '$lib/canvas/StrokeRenderer.js';
	import { computeAlpha } from '$lib/canvas/computeAlpha.js';

	// CachedDrawing holds the pre-rendered bitmap and the timestamps needed for fading.
	interface CachedDrawing {
		bitmap: ImageBitmap;
		approvedAt: Date;
		expiresAt: Date | null;
	}

	// Raw row shape returned by Supabase queries and Realtime INSERT payloads.
	interface DrawingRow {
		id: string;
		strokes: Point[];
		line_widths: number[];
		approved_at: string;
		expires_at: string | null;
	}

	// canvas is bound via bind:this — must NOT be $state (bind:this does not work with $state proxy).
	let canvas: HTMLCanvasElement;

	// Fade configuration — defaults match migration seed data; updated live via settings Realtime.
	let graceSeconds = $state(1200);
	let fadeSeconds = $state(300);

	// Bitmap cache keyed by drawings.id UUID (NOT entry_id).
	// Critical: DELETE Realtime payloads with RLS enabled only contain the primary key `id`.
	let bitmaps = $state(new Map<string, CachedDrawing>());

	// --- Bitmap creation helper ---

	/**
	 * Renders a drawing row onto an OffscreenCanvas and returns a cached drawing entry.
	 * Each drawing is rendered exactly once; the resulting ImageBitmap is GPU-composited
	 * every frame via drawImage() without re-executing the stroke path logic.
	 */
	async function createCachedDrawing(
		row: DrawingRow,
		canvasWidth: number,
		canvasHeight: number
	): Promise<[string, CachedDrawing]> {
		const offscreen = new OffscreenCanvas(canvasWidth, canvasHeight);
		const octx = offscreen.getContext('2d')!;
		renderStrokes(octx, row.strokes, row.line_widths, 'white');
		const bitmap = await createImageBitmap(offscreen);
		return [
			row.id,
			{
				bitmap,
				approvedAt: new Date(row.approved_at),
				expiresAt: row.expires_at ? new Date(row.expires_at) : null
			}
		];
	}

	// --- rAF render loop ---

	// $effect runs after DOM paint, so canvas is guaranteed to be set here.
	// Each frame: clear the canvas, then composite each cached bitmap at its current alpha.
	// clearRect keeps the background transparent — required for OBS chroma-key overlay (D-08).
	$effect(() => {
		const ctx = canvas.getContext('2d')!;
		let frame: number;

		function render() {
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			for (const drawing of bitmaps.values()) {
				const alpha = computeAlpha(drawing.approvedAt, drawing.expiresAt, graceSeconds);
				if (alpha <= 0) continue;
				ctx.globalAlpha = alpha;
				ctx.drawImage(drawing.bitmap, 0, 0);
			}

			// Reset global alpha so clearRect and future draws are not affected.
			ctx.globalAlpha = 1;

			frame = requestAnimationFrame(render);
		}

		frame = requestAnimationFrame(render);

		return () => {
			cancelAnimationFrame(frame);
		};
	});

	// --- Realtime subscriptions + initial load ---

	onMount(() => {
		// Size the canvas to the full viewport on mount.
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

		// Disconnect watchdog (D-04): Supabase JS handles reconnect automatically.
		// If still disconnected after 60 s, force a page reload to recover from stale state.
		function clearDisconnectTimer() {
			if (disconnectTimer !== null) {
				clearTimeout(disconnectTimer);
				disconnectTimer = null;
			}
		}

		function startDisconnectTimer() {
			if (disconnectTimer !== null) return; // already running
			disconnectTimer = setTimeout(() => {
				location.reload();
			}, 60_000);
		}

		// Single channel with three .on() listeners chained before .subscribe().
		// Separating them into multiple channels would waste quota and add complexity.
		const channel = supabase
			.channel('overlay')
			.on(
				'postgres_changes',
				{ event: 'INSERT', schema: 'public', table: 'drawings' },
				async (payload) => {
					// New drawing approved — render to OffscreenCanvas and add to cache.
					const row = payload.new as DrawingRow;
					const [id, cached] = await createCachedDrawing(row, canvas.width, canvas.height);
					bitmaps = new Map(bitmaps).set(id, cached);
				}
			)
			.on(
				'postgres_changes',
				{ event: 'DELETE', schema: 'public', table: 'drawings' },
				(payload) => {
					// RLS means payload.old only contains { id } — that is why we key by id, not entry_id.
					const id = (payload.old as { id: string }).id;
					const next = new Map(bitmaps);
					next.delete(id);
					bitmaps = next;
				}
			)
			.on(
				'postgres_changes',
				{ event: 'UPDATE', schema: 'public', table: 'settings' },
				(payload) => {
					// Settings UPDATE arrives live — no page reload needed (D-09).
					const { key, value } = payload.new as { key: string; value: unknown };
					if (key === 'grace_seconds') graceSeconds = value as number;
					if (key === 'fade_seconds') fadeSeconds = value as number;
				}
			)
			.subscribe((status) => {
				if (status === 'SUBSCRIBED') {
					clearDisconnectTimer();
				} else if (
					status === 'CHANNEL_ERROR' ||
					status === 'TIMED_OUT' ||
					status === 'CLOSED'
				) {
					startDisconnectTimer();
				}
			});

		// Initial load — fetch all currently-approved drawings and active settings.
		// Uses the anon client; RLS allows public reads on both tables (D-05).
		(async () => {
			const [drawingsResult, settingsResult] = await Promise.all([
				supabase.from('drawings').select('*'),
				supabase.from('settings').select('*')
			]);

			// Apply settings first so the rAF loop uses correct fade values from frame 1.
			if (settingsResult.data) {
				for (const row of settingsResult.data as { key: string; value: unknown }[]) {
					if (row.key === 'grace_seconds') graceSeconds = row.value as number;
					if (row.key === 'fade_seconds') fadeSeconds = row.value as number;
				}
			}

			// Render all existing drawings into the bitmap cache.
			// Merge rather than replace so any Realtime INSERTs that arrived during
			// the async fetch are preserved rather than discarded.
			if (drawingsResult.data) {
				const entries = await Promise.all(
					(drawingsResult.data as DrawingRow[]).map((row) =>
						createCachedDrawing(row, canvas.width, canvas.height)
					)
				);
				const freshMap = new Map(entries);
				for (const [id, cached] of bitmaps) {
					if (!freshMap.has(id)) freshMap.set(id, cached);
				}
				bitmaps = freshMap;
			}
		})();

		// Resize handler — update canvas dimensions and rebuild all bitmaps.
		// OffscreenCanvas dimensions are fixed at creation time, so they must be recreated.
		function onResize() {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;

			// Rebuild bitmaps at the new dimensions so drawings fill the updated viewport.
			const currentBitmaps = bitmaps;
			supabase
				.from('drawings')
				.select('*')
				.then(async ({ data }) => {
					if (!data) return;
					// Only rebuild entries that are still in the cache (not yet removed).
					const entries = await Promise.all(
						(data as DrawingRow[])
							.filter((row) => currentBitmaps.has(row.id))
							.map((row) => createCachedDrawing(row, canvas.width, canvas.height))
					);
					bitmaps = new Map(entries);
				});
		}

		window.addEventListener('resize', onResize);

		return () => {
			clearDisconnectTimer();
			window.removeEventListener('resize', onResize);
			supabase.removeChannel(channel);
		};
	});
</script>

<canvas bind:this={canvas}></canvas>

<style>
	:global(html),
	:global(body) {
		background: transparent;
		margin: 0;
		overflow: hidden;
	}

	canvas {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100vh;
	}
</style>
