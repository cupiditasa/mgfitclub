import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const themeCss = fs.readFileSync(new URL('mg-global-theme.css', root), 'utf8');
const membershipHtml = fs.readFileSync(new URL('membership.html', root), 'utf8');
const themes = ['modern-light', 'modern-light-coral', 'modern-dark', 'modern-dark-coral', 'modern-studio', 'classic'];

function propertiesForTheme(theme) {
  const selector = `:root[data-mg-theme="${theme}"]`;
  const properties = {};
  let offset = 0;
  while (true) {
    const matchAt = themeCss.indexOf(selector, offset);
    if (matchAt < 0) break;
    const openAt = themeCss.indexOf('{', matchAt);
    const closeAt = themeCss.indexOf('}', openAt);
    if (openAt < 0 || closeAt < 0) break;
    const declarations = themeCss.slice(openAt + 1, closeAt);
    for (const [, name, value] of declarations.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) properties[name] = value.trim();
    offset = closeAt + 1;
  }
  return properties;
}

function luminance(hex) {
  const short = hex.match(/^#([\da-f])([\da-f])([\da-f])$/i);
  const normalized = short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : hex;
  assert.match(normalized, /^#[\da-f]{6}$/i, `expected a literal hex color, got ${hex}`);
  const channels = normalized.slice(1).match(/.{2}/g).map((pair) => parseInt(pair, 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(foreground, background) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

test('semantic action and selected-state text meet AA in every theme', () => {
  for (const theme of themes) {
    const vars = propertiesForTheme(theme);
    for (const [background, foreground] of [
      ['--mg-success-bg', '--mg-on-success'], ['--mg-success-hover', '--mg-on-success'],
      ['--mg-danger-bg', '--mg-on-danger'], ['--mg-danger-hover', '--mg-on-danger'],
      ['--mg-warning-bg', '--mg-on-warning'], ['--mg-warning-hover', '--mg-on-warning'],
      ['--mg-selected-bg', '--mg-on-selected'],
    ]) {
      assert.ok(vars[background] && vars[foreground], `${theme} defines ${background} and ${foreground}`);
      assert.ok(contrast(vars[foreground], vars[background]) >= 4.5,
        `${theme} ${foreground} on ${background} falls below 4.5:1`);
    }
  }
});

test('Studio Cobalt theme keeps body copy legible and gives this palette its own visual identity', () => {
  const vars = propertiesForTheme('modern-studio');
  assert.ok(contrast(vars['--mg-text'], vars['--mg-page']) >= 4.5);
  assert.ok(contrast(vars['--mg-muted'], vars['--mg-page']) >= 4.5);
  assert.equal(vars['--mg-primary'], '#1d4ed8');
  assert.equal(vars['--mg-secondary'], '#c2410c');
  assert.match(vars['--accent'], /var\(--mg-accent\)/);
  assert.match(themeCss, /body\[data-mg-theme="modern-studio"\][\s\S]*?background-attachment:\s*fixed/);
});

test('Studio Cobalt preserves readable white text over the homepage video hero', () => {
  assert.match(themeCss, /body\.mg-home\[data-mg-theme="modern-studio"\] \.hero \{[\s\S]*?color:\s*#fffefa !important/);
});

test('semantic success, danger, and secondary buttons preserve themed hover, focus, and disabled states', () => {
  for (const className of ['green', 'success', 'danger', 'yellow', 'warning']) {
    assert.ok(themeCss.includes(`[class~="${className}"]`), `${className} semantic class is mapped`);
  }
  assert.match(themeCss, /\[class~="danger"\]:hover:not\(:disabled\)/);
  assert.match(themeCss, /\[class~="yellow"\]:hover:not\(:disabled\)/);
  assert.match(themeCss, /:is\(\.green, \.success, \.danger, \.yellow, \.warning\):focus-visible/);
  assert.match(themeCss, /:is\(\.green, \.success, \.danger, \.yellow, \.warning\):disabled/);
});

test('membership selection and WhatsApp link use semantic theme tokens with explicit selected states', () => {
  assert.match(themeCss, /\.filter-btn\[aria-pressed="true"\][\s\S]*?\.membership-duration\[aria-pressed="true"\][\s\S]*?--mg-selected-bg/);
  assert.match(themeCss, /\.floating-chat[\s\S]*?--mg-on-success[\s\S]*?--mg-success-bg/);
  assert.match(themeCss, /\.floating-chat:hover[\s\S]*?--mg-success-hover/);
  assert.match(membershipHtml, /\.filter-btn\[aria-pressed="true"\]/);
  assert.match(membershipHtml, /\.membership-duration\[aria-pressed="true"\]/);
});

test('membership content surfaces and dialog follow modern theme surfaces instead of fixed dark fills', () => {
  assert.match(membershipHtml, /body\[data-mg-theme\^="modern-"\][\s\S]*?\.plan-card[\s\S]*?var\(--mg-surface\)/);
  assert.match(membershipHtml, /\.plan-card\.featured\s*\{\s*background:\s*var\(--mg-accent-soft\)/);
  assert.match(membershipHtml, /\.visual-panel[\s\S]*?var\(--mg-surface\)/);
  assert.match(membershipHtml, /\.membership-dialog[\s\S]*?var\(--mg-surface\)/);
});
