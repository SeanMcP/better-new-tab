// Background and accent colors: presets (each with a light and dark variant) or a custom color.

import { icons } from './icons.js';
import { createPopover } from './popover.js';
import { storage } from './storage.js';

export const SETTINGS_KEY = 'appearance';
/** Mirror of the resolved theme in localStorage, read synchronously by theme-boot.js before first paint. */
export const BOOT_KEY = 'appearance:boot';

// The real backgrounds are deliberately near-neutral, so each also has a `swatch`: a stronger
// version of its hue, used only for its button in the picker.
export const BACKGROUNDS = [
  { id: 'default', name: 'Paper', light: '#f4f2ee', dark: '#141312', swatch: '#d9d1c4' },
  { id: 'mist', name: 'Mist', light: '#edf1f5', dark: '#11151a', swatch: '#a9c0d8' },
  { id: 'sage', name: 'Sage', light: '#edf1ea', dark: '#121611', swatch: '#a9c49c' },
  { id: 'lavender', name: 'Lavender', light: '#f1eef9', dark: '#15131b', swatch: '#c0b0e6' },
  { id: 'blush', name: 'Blush', light: '#f8eded', dark: '#1a1313', swatch: '#e6b0b0' },
  { id: 'sand', name: 'Sand', light: '#f4ece0', dark: '#19150f', swatch: '#e0c595' },
];

export const ACCENTS = [
  { id: 'red', name: 'Red', light: '#e5483b', dark: '#ff5f52' },
  { id: 'orange', name: 'Orange', light: '#e0700f', dark: '#ff8d3a' },
  { id: 'green', name: 'Green', light: '#2f9e5b', dark: '#45c27a' },
  { id: 'teal', name: 'Teal', light: '#0e9494', dark: '#2fc3c3' },
  { id: 'blue', name: 'Blue', light: '#2f6fe0', dark: '#5b93ff' },
  { id: 'purple', name: 'Purple', light: '#7a4fd6', dark: '#a07cff' },
  { id: 'pink', name: 'Pink', light: '#d63f88', dark: '#ff6aad' },
];

export const DEFAULT_SETTINGS = {
  background: 'default',
  backgroundCustom: '#dfe8e4',
  accent: 'red',
  accentCustom: '#3a7bd5',
};

export function parseHex(hex) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!match) return null;
  const digits = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1];
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16));
}

/** WCAG relative luminance, 0 (black) – 1 (white). */
export function luminance(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Whether light text reads better than dark text on this color. */
export function isDark(hex) {
  return contrast(hex, '#ffffff') > contrast(hex, '#111111');
}

/** Text color to put on top of an accent. */
export function textOn(hex) {
  return isDark(hex) ? '#ffffff' : '#111111';
}

/**
 * Turns settings into CSS custom properties plus a forced theme (or '' to follow the system).
 * Custom backgrounds force light or dark so the text stays readable.
 */
export function resolveAppearance(settings) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const vars = {};
  let theme = '';

  if (s.background === 'custom' && parseHex(s.backgroundCustom)) {
    vars['--bg'] = s.backgroundCustom;
    theme = isDark(s.backgroundCustom) ? 'dark' : 'light';
  } else {
    const preset = BACKGROUNDS.find((b) => b.id === s.background) ?? BACKGROUNDS[0];
    vars['--bg'] = `light-dark(${preset.light}, ${preset.dark})`;
  }

  if (s.accent === 'custom' && parseHex(s.accentCustom)) {
    vars['--accent'] = s.accentCustom;
    vars['--accent-text'] = textOn(s.accentCustom);
  } else {
    const preset = ACCENTS.find((a) => a.id === s.accent) ?? ACCENTS[0];
    vars['--accent'] = `light-dark(${preset.light}, ${preset.dark})`;
    vars['--accent-text'] = `light-dark(${textOn(preset.light)}, ${textOn(preset.dark)})`;
  }

  return { vars, theme };
}

export function applyAppearance({ vars, theme }, root = document.documentElement) {
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  if (theme) root.dataset.theme = theme;
  else delete root.dataset.theme;
}

// ---- Widget ---------------------------------------------------------------------------------

const swatch = (group, option, selected) => `
  <label class="swatch" title="${option.name}">
    <input type="radio" name="${group}" value="${option.id}" ${selected ? 'checked' : ''}>
    <span class="swatch-color" style="--swatch: ${option.swatch ?? `light-dark(${option.light}, ${option.dark})`}"></span>
    <span class="visually-hidden">${option.name}</span>
  </label>`;

const customSwatch = (group, value, selected) => `
  <label class="swatch swatch-custom" title="Custom color">
    <input type="radio" name="${group}" value="custom" ${selected ? 'checked' : ''}>
    <span class="swatch-color" style="--swatch: ${value}"></span>
    <span class="visually-hidden">Custom</span>
    <input type="color" name="${group}Custom" value="${value}" aria-label="Custom ${group} color">
  </label>`;

export async function mountAppearance(toolbar) {
  let settings = { ...DEFAULT_SETTINGS, ...(await storage.get(SETTINGS_KEY)) };

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-button';
  button.setAttribute('aria-label', 'Appearance');
  button.innerHTML = icons.palette;

  const form = document.createElement('form');
  form.className = 'popover appearance-settings';
  form.hidden = true;
  form.setAttribute('aria-label', 'Appearance');

  function renderForm() {
    form.innerHTML = `
      <fieldset>
        <legend>Background</legend>
        <div class="swatches">
          ${BACKGROUNDS.map((b) => swatch('background', b, settings.background === b.id)).join('')}
          ${customSwatch('background', settings.backgroundCustom, settings.background === 'custom')}
        </div>
      </fieldset>
      <fieldset>
        <legend>Accent</legend>
        <div class="swatches">
          ${ACCENTS.map((a) => swatch('accent', a, settings.accent === a.id)).join('')}
          ${customSwatch('accent', settings.accentCustom, settings.accent === 'custom')}
        </div>
      </fieldset>
      <button type="button" class="pill-button" data-action="reset">Reset to defaults</button>
    `;
  }

  function apply() {
    const resolved = resolveAppearance(settings);
    applyAppearance(resolved);
    try {
      localStorage.setItem(BOOT_KEY, JSON.stringify(resolved));
    } catch {
      // Storage can be unavailable; the theme still applies once chrome.storage loads.
    }
  }

  function readForm() {
    settings = {
      background: form.background.value,
      backgroundCustom: form.backgroundCustom.value,
      accent: form.accent.value,
      accentCustom: form.accentCustom.value,
    };
  }

  // `input` fires continuously while dragging in the color picker: preview live, save on `change`.
  form.addEventListener('input', (event) => {
    if (event.target.type === 'color') {
      const group = event.target.name.replace('Custom', '');
      form.querySelector(`input[name="${group}"][value="custom"]`).checked = true;
      event.target.closest('.swatch').querySelector('.swatch-color').style.setProperty('--swatch', event.target.value);
    }
    readForm();
    apply();
  });
  form.addEventListener('change', () => {
    readForm();
    storage.set(SETTINGS_KEY, settings);
  });
  form.addEventListener('click', (event) => {
    // Opening the picker selects "custom" right away, even if the color isn't changed.
    if (event.target.type === 'color') {
      const radio = form.querySelector(`input[name="${event.target.name.replace('Custom', '')}"][value="custom"]`);
      if (!radio.checked) {
        radio.checked = true;
        readForm();
        apply();
        storage.set(SETTINGS_KEY, settings);
      }
      return;
    }
    if (event.target.closest('[data-action="reset"]')) {
      settings = { ...DEFAULT_SETTINGS };
      storage.set(SETTINGS_KEY, settings);
      renderForm();
      apply();
    }
  });

  storage.onChange((key, value) => {
    if (key !== SETTINGS_KEY) return;
    settings = { ...DEFAULT_SETTINGS, ...value };
    if (form.hidden) renderForm();
    apply();
  });

  toolbar.prepend(button, form);
  createPopover(button, form);
  renderForm();
  apply();
}
