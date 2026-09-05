#!/usr/bin/env node
/**
 * FILE: tests/core/bootstrap-contract.test.js
 *
 * Mục đích:
 * Kiểm tra các contract tĩnh của entry point sau đợt Core refactor.
 *
 * Trách nhiệm:
 * - Kiểm tra thứ tự dependency chính.
 * - Bảo đảm index.html không quay lại CSS inline.
 * - Bảo đảm module loader được khai báo sau app legacy.
 *
 * Không chịu trách nhiệm:
 * - Đăng nhập thật.
 * - Ghi database.
 * - Kiểm thử UI browser hoặc dữ liệu production.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(
    path.join(root, 'index.html'),
    'utf8',
);

const requiredScripts = [
    'core/config.js',
    'core/supabase.js',
    'core/state.js',
    'core/utils.js',
    'app.js',
    'core/module-loader.js',
];

for (const script of requiredScripts) {
    assert.ok(
        new RegExp(`src="${script.replace(/\./g, '\\.')}(?:\\?[^\"]*)?"`).test(html),
        `index.html must load ${script}`,
    );
}

const positions = requiredScripts.map((script) =>
    html.search(new RegExp(`src="${script.replace(/\./g, '\\.')}(?:\\?[^\"]*)?"`)),
);

for (let index = 1; index < positions.length; index += 1) {
    assert.ok(
        positions[index - 1] < positions[index],
        `${requiredScripts[index - 1]} must load before ${requiredScripts[index]}`,
    );
}

assert.equal(
    /<style\b/i.test(html),
    false,
    'index.html must not contain a style block',
);

assert.equal(
    /\sstyle\s*=\s*["']/i.test(html),
    false,
    'index.html must not contain inline style attributes',
);

const moduleLoader = fs.readFileSync(
    path.join(root, 'core/module-loader.js'),
    'utf8',
);

assert.match(
    moduleLoader,
    /FILE:\s*core\/module-loader\.js/,
);
assert.match(
    moduleLoader,
    /APPLICATION_MODULES/,
);

console.log('Bootstrap contract tests: PASS');
