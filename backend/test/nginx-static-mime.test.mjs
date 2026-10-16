import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const configs = [
  '../../deploy/nginx/mgfitclub.conf',
  '../ops/nginx-mgfitclub.conf.example',
  '../ops/nginx-mgfitclub-http-staging.conf.example',
];

test('MG nginx vhosts compress and cache static text and binary assets safely', () => {
  for (const relativePath of configs) {
    const config = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    const denyHiddenFiles = config.indexOf('location ~ /\\.(?!well-known/)');
    const htmlHandler = config.indexOf('location ~* \\.html?$');
    const textHandler = config.indexOf('location ~* \\.(?:css|js|mjs|json|svg)$');
    const binaryHandler = config.indexOf('location ~* \\.(?:avif|gif|jpe?g|png|webp|ico|woff2?|ttf|otf|glb)$');
    const apiHandler = config.indexOf('location ^~ /api/api01/');
    const staticHandler = config.indexOf('location / {', binaryHandler);

    assert.notEqual(denyHiddenFiles, -1, `${relativePath}: hidden-file protection exists`);
    assert.ok(htmlHandler > denyHiddenFiles && htmlHandler < textHandler, `${relativePath}: HTML revalidation precedes asset handlers`);
    assert.ok(config.slice(htmlHandler, textHandler).includes('expires -1;'), `${relativePath}: HTML is revalidated`);
    assert.ok(textHandler > htmlHandler, `${relativePath}: static asset handlers follow HTML`);
    assert.ok(binaryHandler > textHandler, `${relativePath}: text and binary assets have separate policies`);
    assert.ok(staticHandler > binaryHandler, `${relativePath}: asset handlers precede generic static handler`);
    assert.ok(apiHandler > -1 && apiHandler < textHandler, `${relativePath}: API proxy is explicit and unaffected`);

    const textAssets = config.slice(textHandler, binaryHandler);
    for (const directive of [
      'default_type application/javascript;',
      'gzip on;',
      'gzip_vary on;',
      'gzip_min_length 1024;',
      'gzip_types text/css application/javascript text/javascript application/json image/svg+xml;',
      'expires $mgfitclub_static_expires;',
      'try_files $uri =404;',
    ]) {
      assert.ok(textAssets.includes(directive), `${relativePath}: text handler includes ${directive}`);
    }
    assert.ok(config.slice(binaryHandler, staticHandler).includes('expires $mgfitclub_static_expires;'));
    assert.ok(config.slice(binaryHandler, staticHandler).includes('try_files $uri =404;'));
  }
});

test('MG static-cache map assigns one week by default and one year to versioned URLs', () => {
  const map = fs.readFileSync(new URL('../../deploy/nginx/mgfitclub-cache-map.conf', import.meta.url), 'utf8');
  assert.ok(map.includes('map $arg_v $mgfitclub_static_expires {'));
  assert.ok(map.includes('default 7d;'));
  assert.ok(map.includes('~.+ 1y;'));
});
