<script lang="ts">
  // Mod login page: a centered "Login with Twitch" button that initiates the PKCE flow.
  // Displays an error message if the callback redirected back with ?error=...
  import type { PageData } from './$types.js';

  let { data }: { data: PageData } = $props();

  function errorMessage(code: string | null): string {
    if (!code) return '';
    if (code === 'missing_code') return 'Authorization was cancelled.';
    return 'Authentication error. Please try again.';
  }
</script>

<div class="login-container">
  <h1>Mod Dashboard</h1>
  <p>Log in with your Twitch account to access the moderation queue.</p>

  {#if data.error}
    <p class="error">Login failed: {errorMessage(data.error)}</p>
  {/if}

  <form method="POST">
    <button type="submit" class="twitch-button">Login with Twitch</button>
  </form>
</div>

<style>
  :global(body) {
    margin: 0;
    background: #18181b;
    color: #fff;
    font-family: system-ui, sans-serif;
  }

  .login-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 1rem;
    padding: 2rem;
    text-align: center;
  }

  h1 {
    font-size: 2rem;
    margin: 0;
  }

  p {
    color: #adadb8;
    margin: 0;
  }

  .error {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
  }

  .twitch-button {
    background: #9146ff;
    color: #fff;
    border: none;
    padding: 0.875rem 2rem;
    font-size: 1rem;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .twitch-button:hover {
    background: #7d2df7;
  }

  .twitch-button:active {
    background: #6c25d4;
  }
</style>
