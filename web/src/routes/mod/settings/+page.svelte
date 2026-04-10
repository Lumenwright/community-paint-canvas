<script lang="ts">
  // Broadcaster settings page: three sections on a single page (D-03).
  //   1. Canvas settings — grace_seconds, fade_seconds, bits tier (SKU + amount together)
  //   2. Moderator management — add / remove active mods
  //   3. Canvas reset — destructive action with confirm() guard (T-2-06)
  //
  // All mutations go through existing EBS API routes — no new server routes needed.
  import type { PageData } from './$types.js';

  let { data }: { data: PageData } = $props();

  // Section 1: Canvas Settings
  // Bits tiers are a static list keyed by SKU — both SKU and amount must stay in sync (Research Pitfall 5)
  const BITS_TIERS = [
    { sku: 'submit_50', amount: 50 },
    { sku: 'submit_100', amount: 100 },
    { sku: 'submit_200', amount: 200 },
    { sku: 'submit_500', amount: 500 }
  ] as const;

  type BitsTier = (typeof BITS_TIERS)[number];

  function findTierIndex(sku: unknown): number {
    const idx = BITS_TIERS.findIndex((t) => t.sku === sku);
    return idx >= 0 ? idx : 0;
  }

  // Extract initial values from data before $state to avoid Svelte reactive-capture warnings.
  // data is server-loaded props — it is stable on mount; these are user-editable form fields.
  const initialGrace = (data.settings.grace_seconds as number) ?? 1200;
  const initialFade = (data.settings.fade_seconds as number) ?? 300;
  const initialTierIndex = findTierIndex(data.settings.bits_sku);

  let graceSeconds = $state(initialGrace);
  let fadeSeconds = $state(initialFade);
  let selectedTierIndex = $state(initialTierIndex);
  let saving = $state(false);
  let saveMessage = $state('');

  let selectedTier = $derived<BitsTier>(BITS_TIERS[selectedTierIndex]);

  async function saveSettings() {
    saving = true;
    saveMessage = '';
    const patches = [
      { key: 'grace_seconds', value: graceSeconds },
      { key: 'fade_seconds', value: fadeSeconds },
      { key: 'bits_sku', value: selectedTier.sku },
      { key: 'bits_amount', value: selectedTier.amount }
    ];
    try {
      for (const patch of patches) {
        const res = await fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch)
        });
        if (!res.ok) throw new Error(`Failed to save ${patch.key}`);
      }
      saveMessage = 'Settings saved!';
    } catch (e) {
      saveMessage = e instanceof Error ? e.message : 'Failed to save settings.';
    } finally {
      saving = false;
      setTimeout(() => {
        saveMessage = '';
      }, 3000);
    }
  }

  // Section 2: Moderator Management
  interface Moderator {
    twitch_user_id: string;
    username: string;
    added_at: string;
    active: boolean;
  }

  const initialModerators = data.moderators as Moderator[];
  let moderators = $state<Moderator[]>(initialModerators);
  let newModUserId = $state('');
  let newModUsername = $state('');
  let modLoading = $state(false);
  let modMessage = $state('');

  async function addMod() {
    if (!newModUserId.trim() || !newModUsername.trim()) return;
    modLoading = true;
    modMessage = '';
    const res = await fetch('/api/moderators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ twitch_user_id: newModUserId.trim(), username: newModUsername.trim() })
    });
    if (res.ok) {
      moderators = [
        ...moderators,
        {
          twitch_user_id: newModUserId.trim(),
          username: newModUsername.trim(),
          added_at: new Date().toISOString(),
          active: true
        }
      ];
      newModUserId = '';
      newModUsername = '';
      modMessage = 'Moderator added.';
    } else {
      modMessage = 'Failed to add moderator.';
    }
    modLoading = false;
    setTimeout(() => {
      modMessage = '';
    }, 3000);
  }

  async function removeMod(twitchUserId: string) {
    const res = await fetch('/api/moderators', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ twitch_user_id: twitchUserId })
    });
    if (res.ok) {
      moderators = moderators.filter((m) => m.twitch_user_id !== twitchUserId);
    }
  }

  // Section 3: Canvas Reset
  let resetting = $state(false);
  let resetMessage = $state('');

  async function resetCanvas() {
    if (!confirm('Are you sure? This will remove all live drawings from the stream overlay.')) {
      return;
    }
    resetting = true;
    resetMessage = '';
    const res = await fetch('/api/canvas/reset', { method: 'POST' });
    if (res.ok) {
      resetMessage = 'Canvas reset successfully.';
    } else {
      resetMessage = 'Failed to reset canvas.';
    }
    resetting = false;
    setTimeout(() => {
      resetMessage = '';
    }, 3000);
  }
</script>

<div class="page">
  <header class="header">
    <h1>Broadcaster Settings</h1>
    <div class="header-right">
      <span class="username">Logged in as <strong>{data.username}</strong></span>
      <a href="/mod" class="back-link">Back to Queue</a>
    </div>
  </header>

  <main class="main">

    <!-- Section 1: Canvas Settings -->
    <section class="card">
      <h2>Canvas Settings</h2>

      <div class="field">
        <label for="grace-seconds">Grace period (seconds)</label>
        <p class="field-hint">How long drawings stay at full opacity before fading begins</p>
        <input
          id="grace-seconds"
          type="number"
          min="0"
          max="86400"
          step="60"
          bind:value={graceSeconds}
        />
      </div>

      <div class="field">
        <label for="fade-seconds">Fade duration (seconds)</label>
        <p class="field-hint">How long the fade-out takes after the grace period ends</p>
        <input
          id="fade-seconds"
          type="number"
          min="0"
          max="3600"
          step="30"
          bind:value={fadeSeconds}
        />
      </div>

      <div class="field">
        <label for="bits-tier">Bits tier</label>
        <p class="field-hint">
          Amount of Bits viewers spend to place a drawing (SKU and amount are always kept in sync)
        </p>
        <select id="bits-tier" bind:value={selectedTierIndex}>
          {#each BITS_TIERS as tier, i}
            <option value={i}>{tier.amount} Bits ({tier.sku})</option>
          {/each}
        </select>
      </div>

      <div class="form-footer">
        {#if saveMessage}
          <p class="save-message" class:error={!saveMessage.includes('saved')}>{saveMessage}</p>
        {/if}
        <button class="btn btn-primary" onclick={saveSettings} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </section>

    <!-- Section 2: Moderator Management -->
    <section class="card">
      <h2>Moderator Management</h2>

      {#if moderators.length === 0}
        <p class="empty-text">No active moderators.</p>
      {:else}
        <table class="mod-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Added</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each moderators as mod}
              <tr>
                <td>{mod.username}</td>
                <td class="date-cell">{new Date(mod.added_at).toLocaleDateString()}</td>
                <td>
                  <button class="btn btn-sm btn-danger" onclick={() => removeMod(mod.twitch_user_id)}>
                    Remove
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}

      <div class="add-mod-form">
        <h3>Add Moderator</h3>
        <div class="add-mod-inputs">
          <input
            type="text"
            placeholder="Twitch User ID"
            bind:value={newModUserId}
            disabled={modLoading}
          />
          <input
            type="text"
            placeholder="Username"
            bind:value={newModUsername}
            disabled={modLoading}
          />
          <button class="btn btn-primary" onclick={addMod} disabled={modLoading || !newModUserId.trim() || !newModUsername.trim()}>
            {modLoading ? 'Adding...' : 'Add'}
          </button>
        </div>
        {#if modMessage}
          <p class="save-message" class:error={modMessage.includes('Failed')}>{modMessage}</p>
        {/if}
      </div>
    </section>

    <!-- Section 3: Canvas Reset (danger zone) -->
    <section class="card danger-zone">
      <h2>Danger Zone</h2>
      <p class="danger-description">
        Resetting the canvas permanently removes all live drawings from the stream overlay.
        This action cannot be undone.
      </p>
      <div class="danger-footer">
        {#if resetMessage}
          <p class="save-message" class:error={resetMessage.includes('Failed')}>{resetMessage}</p>
        {/if}
        <button class="btn btn-danger" onclick={resetCanvas} disabled={resetting}>
          {resetting ? 'Resetting...' : 'Reset Canvas'}
        </button>
      </div>
    </section>

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

  .back-link {
    color: #9146ff;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  .main {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 2rem;
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
  }

  .card {
    background: #0e0e10;
    border: 1px solid #26262c;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .card h2 {
    margin: 0 0 1.5rem;
    font-size: 1.25rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-bottom: 1.25rem;
  }

  .field label {
    font-weight: 600;
    font-size: 0.925rem;
  }

  .field-hint {
    color: #adadb8;
    font-size: 0.8rem;
    margin: 0;
  }

  .field input,
  .field select {
    background: #18181b;
    color: #fff;
    border: 1px solid #3a3a44;
    border-radius: 6px;
    padding: 0.6rem 0.75rem;
    font-size: 1rem;
    max-width: 280px;
  }

  .field input:focus,
  .field select:focus {
    outline: 2px solid #9146ff;
    outline-offset: 1px;
  }

  .form-footer {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 0.5rem;
  }

  .save-message {
    margin: 0;
    font-size: 0.9rem;
    color: #22c55e;
  }

  .save-message.error {
    color: #ef4444;
  }

  .empty-text {
    color: #adadb8;
    font-style: italic;
  }

  .mod-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1.5rem;
  }

  .mod-table th {
    text-align: left;
    font-size: 0.8rem;
    color: #adadb8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #26262c;
  }

  .mod-table td {
    padding: 0.6rem 0;
    border-bottom: 1px solid #1a1a1f;
    font-size: 0.95rem;
  }

  .date-cell {
    color: #adadb8;
    font-size: 0.85rem;
  }

  .add-mod-form h3 {
    margin: 0 0 0.75rem;
    font-size: 1rem;
  }

  .add-mod-inputs {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .add-mod-inputs input {
    background: #18181b;
    color: #fff;
    border: 1px solid #3a3a44;
    border-radius: 6px;
    padding: 0.6rem 0.75rem;
    font-size: 0.95rem;
    flex: 1;
    min-width: 150px;
  }

  .add-mod-inputs input:focus {
    outline: 2px solid #9146ff;
    outline-offset: 1px;
  }

  .danger-zone {
    border-color: rgba(239, 68, 68, 0.4);
  }

  .danger-zone h2 {
    color: #ef4444;
  }

  .danger-description {
    color: #adadb8;
    margin: 0 0 1.25rem;
    font-size: 0.9rem;
  }

  .danger-footer {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s ease, opacity 0.15s ease;
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #9146ff;
    color: #fff;
  }

  .btn-primary:hover:not(:disabled) {
    background: #7d2df7;
  }

  .btn-danger {
    background: #ef4444;
    color: #fff;
  }

  .btn-danger:hover:not(:disabled) {
    background: #dc2626;
  }

  .btn-sm {
    padding: 0.35rem 0.875rem;
    font-size: 0.85rem;
  }
</style>
