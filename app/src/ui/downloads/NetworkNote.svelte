<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  The connection, when it matters for downloads: offline (what still works)
  or on mobile data (a download uses the data plan only after a yes; the
  others wait for Wi-Fi). Nothing on Wi-Fi.
-->
<script lang="ts">
  import type { NetworkState } from '../../downloads/contract';
  import Icon from '../Icon.svelte';
  import { METERED_NOTE, METERED_NOTE_TITLE } from './text';

  interface Props {
    network: NetworkState;
  }

  let { network }: Props = $props();
</script>

{#if !network.online}
  <div class="note offline" role="status">
    <Icon name="offline" size={26} />
    <div>
      <p class="title">You are offline</p>
      <p>Maps already on this phone still work, and so does your position. Sizes and new downloads need a connection.</p>
    </div>
  </div>
{:else if network.metered}
  <div class="note metered" role="status">
    <Icon name="mobile-data" size={26} />
    <div>
      <p class="title">{METERED_NOTE_TITLE}</p>
      <p>{METERED_NOTE}</p>
    </div>
  </div>
{/if}

<style>
  .note {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin: 0 0 14px;
    padding: 12px 14px;
    border-radius: var(--radius);
    background: var(--surface-alt);
    border-left: 5px solid var(--line-strong);
  }

  .note.metered {
    border-left-color: #8a5a00;
    background: #fbf3e2;
  }

  p {
    margin: 0;
    font-size: 0.95rem;
  }

  .title {
    font-weight: 700;
    font-size: 1rem;
    margin-bottom: 2px;
  }
</style>
