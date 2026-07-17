<script lang="ts">
  import { SCALE_INFO, getBrightness } from '../lib/scales';
  import type { ScaleName } from '../lib/types';

  interface Props {
    modeName: ScaleName;
  }

  let { modeName }: Props = $props();

  let info = $derived(SCALE_INFO[modeName]);
  let brightness = $derived(info ? getBrightness(modeName) : 0);
  const pips = Array.from({ length: 11 });
</script>

{#if info}
  <div class="scale-flavor">
    <div class="flavor-brightness" data-brightness={brightness} aria-label="Brightness">
      <span class="flavor-brightness-label">Brightness</span>
      {#each pips as _, idx (idx)}<span class="flavor-pip"></span>{/each}
    </div>
    <p class="flavor-feel">{info.feel}</p>
    <div class="flavor-genres">
      {#each info.genres as genre (genre)}<span class="flavor-genre-tag">{genre}</span>{/each}
    </div>
    <p class="flavor-tip">{info.tip}</p>
  </div>
{/if}

<style>
  .scale-flavor {
    border-top: 1px solid var(--color-border);
    padding-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    text-align: left;
  }

  .flavor-brightness {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .flavor-brightness-label {
    color: #78909c;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    margin-right: 0.2rem;
  }

  .flavor-pip {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--color-border);
    transition: background 0.25s;
  }

  /* Fill pips up to the brightness level (1–11). +1 offset because
     .flavor-brightness-label is the first child of the container. */
  .flavor-brightness[data-brightness="1"] .flavor-pip:nth-child(-n+2),
  .flavor-brightness[data-brightness="2"] .flavor-pip:nth-child(-n+3),
  .flavor-brightness[data-brightness="3"] .flavor-pip:nth-child(-n+4),
  .flavor-brightness[data-brightness="4"] .flavor-pip:nth-child(-n+5),
  .flavor-brightness[data-brightness="5"] .flavor-pip:nth-child(-n+6),
  .flavor-brightness[data-brightness="6"] .flavor-pip:nth-child(-n+7),
  .flavor-brightness[data-brightness="7"] .flavor-pip:nth-child(-n+8),
  .flavor-brightness[data-brightness="8"] .flavor-pip:nth-child(-n+9),
  .flavor-brightness[data-brightness="9"] .flavor-pip:nth-child(-n+10),
  .flavor-brightness[data-brightness="10"] .flavor-pip:nth-child(-n+11),
  .flavor-brightness[data-brightness="11"] .flavor-pip:nth-child(-n+12) {
    background: var(--color-root); /* orange — bright end (8–11) */
  }
  /* Override: amber for the mid band (5–7) */
  .flavor-brightness[data-brightness="1"] .flavor-pip:nth-child(-n+2),
  .flavor-brightness[data-brightness="2"] .flavor-pip:nth-child(-n+3),
  .flavor-brightness[data-brightness="3"] .flavor-pip:nth-child(-n+4),
  .flavor-brightness[data-brightness="4"] .flavor-pip:nth-child(-n+5),
  .flavor-brightness[data-brightness="5"] .flavor-pip:nth-child(-n+6),
  .flavor-brightness[data-brightness="6"] .flavor-pip:nth-child(-n+7),
  .flavor-brightness[data-brightness="7"] .flavor-pip:nth-child(-n+8) {
    background: #c4a040;
  }
  /* Override: blue for the dark band (1–4) */
  .flavor-brightness[data-brightness="1"] .flavor-pip:nth-child(-n+2),
  .flavor-brightness[data-brightness="2"] .flavor-pip:nth-child(-n+3),
  .flavor-brightness[data-brightness="3"] .flavor-pip:nth-child(-n+4),
  .flavor-brightness[data-brightness="4"] .flavor-pip:nth-child(-n+5) {
    background: var(--color-scale);
  }

  .flavor-feel {
    font-size: 0.9rem;
    color: #b0bec5;
    line-height: 1.5;
    margin: 0;
  }

  .flavor-genres {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .flavor-genre-tag {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    padding: 0.15em 0.6em;
    border-radius: 999px;
    border: 1px solid var(--color-border);
    color: #90a4ae;
    background: rgba(58, 107, 196, 0.12);
  }

  .flavor-tip {
    font-size: 0.82rem;
    font-style: italic;
    color: #607d8b;
    margin: 0;
    padding-left: 0.3rem;
    border-left: 2px solid var(--color-border);
    line-height: 1.5;
  }
</style>
