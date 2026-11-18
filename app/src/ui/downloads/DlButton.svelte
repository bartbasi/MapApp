<!--
  MapApp. Copyright 2026 Play, Inc.
  Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.
-->
<!--
  A button in the download screens: an icon and a word or two, at least
  48 px tall. "primary" is the one thing to do on a card; "danger" and
  "danger-solid" delete.
-->
<script lang="ts">
  import Icon, { type IconName } from '../Icon.svelte';

  interface Props {
    label: string;
    icon?: IconName | undefined;
    kind?: 'primary' | 'plain' | 'danger' | 'danger-solid' | 'quiet';
    wide?: boolean;
    /** Icon above a short label, for a row of three on a card. */
    stacked?: boolean;
    disabled?: boolean;
    /** A longer name for screen readers, when the label alone is not enough. */
    ariaLabel?: string | undefined;
    onclick: () => void;
  }

  let { label, icon, kind = 'plain', wide = false, stacked = false, disabled = false, ariaLabel, onclick }: Props = $props();
</script>

<button class={kind} class:wide class:stacked {disabled} aria-label={ariaLabel} {onclick}>
  {#if icon}<Icon name={icon} size={22} />{/if}
  <span>{label}</span>
</button>

<style>
  button {
    min-height: 52px;
    padding: 0 16px 0 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: var(--radius);
    border: 2px solid var(--line-strong);
    background: var(--surface);
    color: var(--text);
    font-weight: 700;
    line-height: 1.15;
    text-align: left;
    cursor: pointer;
  }

  button:not(:has(svg)) {
    padding-left: 16px;
  }

  button.wide {
    width: 100%;
  }

  button.stacked {
    min-height: 60px;
    padding: 6px 4px 5px;
    flex-direction: column;
    gap: 3px;
    font-size: 0.9rem;
    text-align: center;
  }

  button:active:not(:disabled) {
    background: var(--surface-alt);
  }

  .primary {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--accent-text);
  }

  .primary:active:not(:disabled) {
    background: #163a22;
  }

  .danger {
    border-color: #b3261e;
    color: #8c1d18;
  }

  .danger-solid {
    border-color: #b3261e;
    background: #b3261e;
    color: #fff;
  }

  .danger-solid:active:not(:disabled) {
    background: #8c1d18;
  }

  .quiet {
    border-color: transparent;
    background: var(--surface-alt);
  }

  button:disabled {
    border-color: var(--line);
    background: var(--surface-alt);
    color: #6f6a60;
    cursor: default;
  }
</style>
