<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  A download's status as an icon in a disc. The shape carries the meaning
  (tick, arrow, clock, bars, crossed-out signal, warning triangle); the color
  only repeats it, and the words always sit beside it.
-->
<script lang="ts">
  import Icon from '../Icon.svelte';
  import type { StatusIcon, StatusTone } from './text';

  interface Props {
    icon: StatusIcon;
    tone: StatusTone;
  }

  let { icon, tone }: Props = $props();
</script>

<span class="badge {tone}" aria-hidden="true"><Icon name={icon} size={24} /></span>

<style>
  .badge {
    flex: none;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 50%;
  }

  .done {
    background: var(--accent);
    color: var(--accent-text);
  }

  .active {
    background: #dce8df;
    color: var(--accent);
  }

  .idle {
    background: var(--surface-alt);
    color: var(--text-muted);
    box-shadow: inset 0 0 0 2px var(--line);
  }

  .problem {
    background: #fbe4e2;
    color: #8c1d18;
  }
</style>
