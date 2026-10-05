// Inline SVG icons (stroke-based, inherit currentColor).

const svg = (body, cls = '') =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const sunBody =
  '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>';
const moonBody = '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>';
const cloudPath = 'M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 11.1 3.5 3.5 0 0 0 7 18z';

export const icons = {
  clear: svg(sunBody, 'icon-sun'),
  clearNight: svg(moonBody, 'icon-moon'),
  partly: svg(
    '<path d="M8 3.5v1.2M3.5 8h1.2M4.8 4.8l.9.9M11.2 4.8l-.9.9"/><path d="M5.6 10.4A3 3 0 1 1 10.7 7"/>' +
      '<path d="M9 20h8a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 8.2 14 3 3 0 0 0 9 20z"/>',
    'icon-partly',
  ),
  partlyNight: svg(
    '<path d="M10.5 7.2A4 4 0 0 1 4.8 3a3.6 3.6 0 0 0 5.7 4.2z"/>' +
      '<path d="M9 20h8a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 8.2 14 3 3 0 0 0 9 20z"/>',
    'icon-partly',
  ),
  cloud: svg(`<path d="${cloudPath}"/>`, 'icon-cloud'),
  fog: svg('<path d="M4 9h16M3 13h18M5 17h14"/>', 'icon-cloud'),
  drizzle: svg(`<path d="M7 15h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 8.1 3.5 3.5 0 0 0 7 15z"/><path d="M9 18.5v.5M13 18.5v.5M17 18.5v.5"/>`, 'icon-rain'),
  rain: svg(`<path d="M7 15h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 8.1 3.5 3.5 0 0 0 7 15z"/><path d="M9 17.5l-1 3M13 17.5l-1 3M17 17.5l-1 3"/>`, 'icon-rain'),
  snow: svg(`<path d="M7 15h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 8.1 3.5 3.5 0 0 0 7 15z"/><path d="M9 18.5h.01M13 20h.01M17 18.5h.01M11 21.5h.01M15 21.5h.01"/>`, 'icon-snow'),
  storm: svg(`<path d="M7 15h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 8.1 3.5 3.5 0 0 0 7 15z"/><path d="M12.5 15l-2 3.5h3l-2 3.5"/>`, 'icon-storm'),
  location: svg('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'),
  palette: svg(
    '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/>' +
      '<circle cx="7.5" cy="11.5" r="1.1"/><circle cx="10.5" cy="7.5" r="1.1"/><circle cx="15" cy="7.5" r="1.1"/>',
  ),
  // Scaled to 85% so its teeth sit inside the same margin as the palette; stroke compensated.
  gear: svg(
    '<g transform="translate(1.8 1.8) scale(0.85)" stroke-width="1.88"><circle cx="12" cy="12" r="3"/>' +
      '<path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></g>',
  ),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
};
