// src/state/theme.svelte.ts — dark/light theme toggle, persisted to localStorage

const LS_KEY = 'improwiz_theme';

function loadDark(): boolean {
  // Dark is the design default; only an explicit stored 'light' opts out.
  return localStorage.getItem(LS_KEY) !== 'light';
}

class ThemeState {
  dark = $state(loadDark());

  constructor() {
    this.apply();
  }

  /** The <html> data-theme attribute is what the light token overrides key off. */
  private apply(): void {
    document.documentElement.dataset.theme = this.dark ? 'dark' : 'light';
  }

  toggle(): void {
    this.dark = !this.dark;
    localStorage.setItem(LS_KEY, this.dark ? 'dark' : 'light');
    this.apply();
  }
}

export const theme = new ThemeState();
