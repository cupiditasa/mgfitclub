import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('profile editor persists names and compressed avatar through the authenticated profile API', () => {
  const js = read('../../access-center.js');
  const dashboard = read('../../dashboard.html');
  assert.match(js, /api\("\/api\/me\/profile"\)/);
  assert.match(js, /photo\.field\.accept = "image\/jpeg,image\/png,image\/webp"/);
  assert.match(js, /canvas\.toDataURL\("image\/jpeg", \.82\)/);
  assert.match(js, /avatarData: avatar/);
  assert.match(js, /await api\("\/api\/me\/profile", "PATCH"/);
  assert.match(js, /حذف تصویر پس از ذخیره ثبت می‌شود/);
  assert.match(dashboard, /data-profile-avatar/);
  assert.match(dashboard, /profile\.avatar_data/);
});

test('profile editor gives clear preview, accessible image selection, and responsive icon fields', () => {
  const js = read('../../access-center.js');
  const css = read('../../access-center.css');
  assert.match(js, /access-avatar-frame/);
  assert.match(js, /setAttribute\("aria-label", "انتخاب تصویر پروفایل"\)/);
  assert.match(js, /emptyAvatar\.hidden = true/);
  assert.match(css, /\.access-profile-editor\{display:grid;grid-template-columns/);
  assert.match(css, /\.access-profile-actions\{display:flex/);
  assert.match(css, /@media\(max-width:640px\)/);
});
