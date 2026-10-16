import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');

test('dark lime, gold and silver is the shared default while alternate palettes remain available', () => {
  const themeScript = read('mg-global-theme.js');
  const themeCss = read('mg-global-theme.css');
  const apiScript = read('mg-api.js');
  const dashboard = read('dashboard.html');
  const serviceWorker = read('sw.js');

  assert.match(themeScript, /return "modern-dark";/);
  assert.match(themeScript, /const defaultMigrationKey = "mg_theme_default_dark_migrated";/);
  assert.match(themeScript, /cookieTheme === "modern-light" \|\| \(!validThemes\.has\(cookieTheme\) && stored === "modern-light"\)/);
  assert.match(themeScript, /if \(validThemes\.has\(cookieTheme\)\) return cookieTheme;/);
  assert.match(themeScript, /if \(validThemes\.has\(localTheme\)\) return localTheme;/);
  assert.match(themeScript, /modern-dark", "#0d1510"/);
  assert.match(themeCss, /--mg-primary: #c6ff3f;/);
  assert.match(themeCss, /--mg-secondary: #f0c866;/);
  assert.match(themeCss, /--mg-muted: #bac7b7;/);
  assert.match(themeCss, /data-theme="modern-dark"[^\n]*nth-child\(4\).*#aeb9b2/);
  assert.match(apiScript, /if \(!mgThemeValues\.has\(theme\)\) theme = "modern-dark";/);
  assert.match(apiScript, /mg_theme_default_dark_migrated/);
  assert.match(apiScript, /currentCookieTheme === "modern-light" \|\| \(!mgThemeValues\.has\(currentCookieTheme\) && oldChoice === "modern-light"\)/);
  assert.match(dashboard, /<html[^>]*data-mg-theme="modern-dark"/);
  assert.match(dashboard, /const migrationKey = "mg_theme_default_dark_migrated";/);
  assert.match(dashboard, /data-mg-theme-choice="modern-dark" aria-pressed="true"/);
  assert.match(dashboard, /let initialMgDashboardTheme = "modern-dark";/);
  for (const theme of ['modern-light', 'modern-light-coral', 'modern-dark-coral', 'classic'])
    assert.match(themeScript, new RegExp(`id: "${theme}"`));
  assert.match(themeScript, /id: "modern-studio", label: "استودیو · عاجی، کبالت و نارنگی"/);
  assert.match(apiScript, /"modern-studio"/);
  assert.match(dashboard, /data-mg-theme-choice="modern-studio"/);
  assert.match(serviceWorker, /mg-fitclub-v20261016-doll-detail-v28/);
  assert.match(serviceWorker, /mg-global-theme\.js\?v=20261012-studio-contrast/);
});
