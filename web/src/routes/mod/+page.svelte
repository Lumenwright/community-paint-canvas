<script lang="ts">
  // Mod queue review page: loads the pending_review queue client-side, renders one drawing
  // at a time on a preview canvas, and allows mods to navigate, approve, or reject submissions.
  //
  // Flow: mount → fetch /api/queue → display first entry → approve/reject triggers API call
  //       → 800ms delay (D-01) → remove from local queue → advance to next entry
  import { onMount } from 'svelte';
  import type { PageData } from './$types.js';
  import { renderStrokes, type Point } from '$lib/canvas/StrokeRenderer.js';

  let { data }: { data: PageData } = $props();

  interface QueueEntry {
    id: string;
    entry_id: string;
    strokes: Point[];
    line_widths: number[];
    username: string;
    submitted_at: string;
  }

  let queue = $state<QueueEntry[]>([]);
  let currentIndex = $state(0);
  let loading = $state(true);
  let actionPending = $state(false); // prevents double-click during 800ms auto-advance delay
  let errorMessage = $state('');
  let previewCanvas = $state<HTMLCanvasElement | undefined>(undefined);

  // Derived state for current drawing and counter display
  let currentDrawing = $derived(queue.length > 0 ? queue[currentIndex] : null);
  let counter = $derived(queue.length > 0 ? `Drawing ${currentIndex + 1} of ${queue.length}` : '');

  onMount(async () => {
    await loadQueue();
  });

  async function loadQueue() {
    loading = true;
    errorMessage = '';
    try {
      const res = await fetch('/api/queue');
      if (!res.ok) throw new Error(`Queue fetch failed: ${res.status}`);
      queue = await res.json();
      currentIndex = 0;
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : 'Failed to load queue.';
    } finally {
      loading = false;
    }
  }

  // Re-render the preview canvas whenever the current drawing changes
  $effect(() => {
    if (!previewCanvas) return;
    const ctx = previewCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    if (!currentDrawing) return;

    // Dark background so white strokes are visible
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

    renderStrokes(ctx, currentDrawing.strokes, currentDrawing.line_widths, 'white');
  });

  function goPrevious() {
    if (currentIndex > 0) currentIndex -= 1;
  }

  function goNext() {
    if (currentIndex < queue.length - 1) currentIndex += 1;
  }

  async function handleReview(action: 'approve' | 'reject') {
    if (!currentDrawing || actionPending) return;
    actionPending = true;
    errorMessage = '';

    const res = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_id: currentDrawing.entry_id, status: action === 'approve' ? 'approved' : 'rejected' })
    });

    if (!res.ok) {
      errorMessage = `Failed to ${action} drawing. Please try again.`;
      actionPending = false;
      return;
    }

    // Auto-advance after ~800ms delay so the mod can register the action visually (D-01)
    setTimeout(() => {
      const removedIndex = currentIndex;
      queue = queue.filter((_, i) => i !== removedIndex);
      // If we were at the end, step back one position
      if (currentIndex >= queue.length) {
        currentIndex = Math.max(0, queue.length - 1);
      }
      actionPending = false;
    }, 800);
  }
</script>

<div class="page">
  <header class="header">
    <h1>Mod Dashboard</h1>
    <div class="header-right">
      <span class="username">Logged in as <strong>{data.username}</strong></span>
      {#if data.is_broadcaster}
        <a href="/mod/settings" class="settings-link">Settings</a>
      {/if}
    </div>
  </header>

  <main class="main">
    {#if loading}
      <p class="status-text">Loading queue...</p>
    {:else if errorMessage}
      <p class="error">{errorMessage}</p>
      <button class="btn btn-secondary" onclick={loadQueue}>Retry</button>
    {:else if queue.length === 0}
      <div class="empty-state">
        <p>No pending drawings. The queue is empty.</p>
        <button class="btn btn-secondary" onclick={loadQueue}>Refresh</button>
      </div>
    {:else}
      <div class="review-area">
        <div class="canvas-wrapper">
          <div class="counter">{counter}</div>
          <canvas
            bind:this={previewCanvas}
            width="600"
            height="400"
            class="preview-canvas"
          ></canvas>
          <p class="submitter">Submitted by <strong>{currentDrawing?.username}</strong></p>
        </div>

        <div class="controls">
          <div class="nav-buttons">
            <button
              class="btn btn-secondary"
              onclick={goPrevious}
              disabled={currentIndex <= 0 || actionPending}
            >
              Previous
            </button>
            <button
              class="btn btn-secondary"
              onclick={goNext}
              disabled={currentIndex >= queue.length - 1 || actionPending}
            >
              Next
            </button>
          </div>

          <div class="action-buttons">
            <button
              class="btn btn-reject"
              onclick={() => handleReview('reject')}
              disabled={actionPending}
            >
              {actionPending ? 'Processing...' : 'Reject'}
            </button>
            <button
              class="btn btn-approve"
              onclick={() => handleReview('approve')}
              disabled={actionPending}
            >
              {actionPending ? 'Processing...' : 'Approve'}
            </button>
          </div>
        </div>
      </div>
    {/if}
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    background: #18181b;
    color: #fff;
    font-family: system-ui, sans-serif;
  }

  .page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 2rem;
    background: #0e0e10;
    border-bottom: 1px solid #26262c;
  }

  .header h1 {
    margin: 0;
    font-size: 1.5rem;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .username {
    color: #adadb8;
    font-size: 0.9rem;
  }

  .settings-link {
    color: #9146ff;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .settings-link:hover {
    text-decoration: underline;
  }

  .main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .status-text {
    color: #adadb8;
  }

  .error {
    color: #ef4444;
    margin-bottom: 1rem;
  }

  .empty-state {
    text-align: center;
  }

  .empty-state p {
    color: #adadb8;
    margin-bottom: 1rem;
    font-size: 1.1rem;
  }

  .review-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  .canvas-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .counter {
    position: absolute;
    top: -1.75rem;
    right: 0;
    font-size: 0.875rem;
    color: #adadb8;
    font-weight: 500;
  }

  .preview-canvas {
    border: 1px solid #26262c;
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    display: block;
    background: #1a1a2e;
  }

  .submitter {
    color: #adadb8;
    font-size: 0.875rem;
    margin: 0;
  }

  .controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    width: 100%;
    max-width: 600px;
  }

  .nav-buttons,
  .action-buttons {
    display: flex;
    gap: 1rem;
    width: 100%;
    justify-content: center;
  }

  .btn {
    padding: 0.75rem 2rem;
    font-size: 1rem;
    font-weight: 600;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s ease, opacity 0.15s ease;
    min-width: 9rem;
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: #26262c;
    color: #fff;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #3a3a44;
  }

  .btn-approve {
    background: #22c55e;
    color: #fff;
  }

  .btn-approve:hover:not(:disabled) {
    background: #16a34a;
  }

  .btn-reject {
    background: #ef4444;
    color: #fff;
  }

  .btn-reject:hover:not(:disabled) {
    background: #dc2626;
  }
</style>
