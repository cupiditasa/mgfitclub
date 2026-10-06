import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = fs.existsSync(new URL('../../current/account.html', import.meta.url))
  ? new URL('../../current/', import.meta.url)
  : new URL('../../', import.meta.url);
const html = fs.readFileSync(new URL('account.html', root), 'utf8');

test('login accepts phone only and shows a numeric mobile keyboard', () => {
  const field = html.match(/<input\s+id="target"[\s\S]*?\/>/)?.[0] || '';
  assert.match(field, /type="tel"/);
  assert.match(field, /inputmode="numeric"/);
  assert.match(field, /autocomplete="tel"/);
  assert.match(html, /شمارهٔ موبایل معتبر وارد کنید/);
  assert.doesNotMatch(html, /ایمیل|email|includes\("@"\)/i);
  assert.match(html, /\/api\/auth\/request-code[\s\S]{0,120}\{ phone, role: selected/);
  assert.match(html, /\/api\/auth\/verify-code[\s\S]{0,120}\{[\s\S]{0,80}phone,/);
});
