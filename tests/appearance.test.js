import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ACCENTS, BACKGROUNDS, DEFAULT_SETTINGS, contrast, isDark, luminance, parseHex, resolveAppearance, textOn,
} from '../extension/src/appearance.js';

test('parses hex colors', () => {
  assert.deepEqual(parseHex('#ff8000'), [255, 128, 0]);
  assert.deepEqual(parseHex('0af'), [0, 170, 255]);
  assert.equal(parseHex('#12345'), null);
  assert.equal(parseHex('red'), null);
});

test('luminance and contrast', () => {
  assert.equal(luminance('#000000'), 0);
  assert.equal(luminance('#ffffff'), 1);
  assert.equal(Math.round(contrast('#000', '#fff')), 21);
  assert.equal(contrast('#777', '#777'), 1);
});

test('dark detection', () => {
  assert.equal(isDark('#141312'), true);
  assert.equal(isDark('#f4f2ee'), false);
  assert.equal(isDark('#1e3a8a'), true); // navy
  assert.equal(isDark('#ffd84d'), false); // yellow
  assert.equal(textOn('#ffd84d'), '#111111');
  assert.equal(textOn('#2f6fe0'), '#ffffff');
});

test('every preset has a readable light and dark variant', () => {
  for (const b of BACKGROUNDS) {
    assert.equal(isDark(b.light), false, `${b.id} light`);
    assert.equal(isDark(b.dark), true, `${b.id} dark`);
  }
  for (const a of ACCENTS) {
    for (const variant of [a.light, a.dark]) {
      assert.ok(contrast(variant, textOn(variant)) >= 3, `${a.id} ${variant} text contrast`);
    }
  }
});

test('defaults follow the system theme', () => {
  const { vars, theme } = resolveAppearance(DEFAULT_SETTINGS);
  assert.equal(theme, '');
  assert.equal(vars['--bg'], 'light-dark(#f4f2ee, #141312)');
  assert.equal(vars['--accent'], 'light-dark(#e5483b, #ff5f52)');
});

test('custom background forces a readable theme', () => {
  assert.equal(resolveAppearance({ background: 'custom', backgroundCustom: '#0b1d33' }).theme, 'dark');
  const light = resolveAppearance({ background: 'custom', backgroundCustom: '#fde7c8' });
  assert.equal(light.theme, 'light');
  assert.equal(light.vars['--bg'], '#fde7c8');
});

test('custom accent picks its text color', () => {
  const { vars } = resolveAppearance({ accent: 'custom', accentCustom: '#ffd84d' });
  assert.equal(vars['--accent'], '#ffd84d');
  assert.equal(vars['--accent-text'], '#111111');
});

test('unknown or invalid values fall back to defaults', () => {
  const { vars, theme } = resolveAppearance({ background: 'nope', accent: 'custom', accentCustom: 'oops' });
  assert.equal(theme, '');
  assert.equal(vars['--bg'], 'light-dark(#f4f2ee, #141312)');
  assert.equal(vars['--accent'], 'light-dark(#e5483b, #ff5f52)');
});

test('background swatches are distinct, visibly tinted colors', () => {
  const swatches = BACKGROUNDS.map((b) => b.swatch);
  assert.equal(new Set(swatches).size, BACKGROUNDS.length);
  for (const b of BACKGROUNDS) {
    const [r, g, bl] = parseHex(b.swatch);
    const chroma = Math.max(r, g, bl) - Math.min(r, g, bl);
    assert.ok(chroma >= 20, `${b.id} swatch should show its hue (chroma ${chroma})`);
  }
});
