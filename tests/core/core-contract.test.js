#!/usr/bin/env node
/**
 * FILE: tests/core/core-contract.test.js
 *
 * Mục đích:
 * Kiểm tra contract tối thiểu của 4 file Core bằng Node VM.
 * Test dùng mock browser nhỏ để bảo đảm Core không phụ thuộc vào DOM thật
 * khi kiểm tra các utility và state mặc định.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const context = vm.createContext({
    console,
    window: {
        supabase: {
            createClient: (url, key) => ({
                __url: url,
                __key: key,
            }),
        },
    },
    document: {
        getElementById: (id) => ({ id }),
    },
    localStorage: {
        getItem: () => '[]',
    },
    Date,
    Number,
    String,
    JSON,
    Math,
});

for (const file of [
    'core/config.js',
    'core/supabase.js',
    'core/state.js',
    'core/utils.js',
]) {
    const source = fs.readFileSync(
        path.join(root, file),
        'utf8',
    );

    vm.runInContext(source, context, {
        filename: file,
    });
}

assert.equal(
    vm.runInContext('APP_VERSION', context),
    'V5-SUPABASE-DATABASE',
);
assert.equal(
    vm.runInContext('sb.__url', context),
    'https://fdyhnwklzizzbiyqqlxo.supabase.co',
);
assert.equal(
    vm.runInContext('role', context),
    'teacher',
);
assert.equal(
    JSON.stringify(vm.runInContext('classSettings', context)),
    JSON.stringify({
        class_name: '6/3',
        school_year: '2026-2027',
        teacher_name: 'Phượng Tiên',
    }),
);
assert.equal(
    JSON.stringify(vm.runInContext('randomHistory', context)),
    '[]',
);
assert.equal(
    vm.runInContext("esc('<b>A & B</b>')", context),
    '&lt;b&gt;A &amp; B&lt;/b&gt;',
);
assert.match(
    vm.runInContext('getCurrentWeekStart()', context),
    /^\d{4}-\d{2}-\d{2}$/,
);
assert.equal(
    vm.runInContext("compWeekStart('2026-08-27')", context),
    '2026-08-24',
);

console.log('Core contract tests: PASS');


/*
 * Deployment contract: every browser must receive the same versioned V6
 * assets. This prevents one machine from executing an older cached module.
 */
const indexHtml = fs.readFileSync('index.html', 'utf8');
assert.match(indexHtml, /app\.js\?v=20260905-competition-history-3/);
assert.match(indexHtml, /core\/module-loader\.js\?v=20260905-competition-history-3/);
