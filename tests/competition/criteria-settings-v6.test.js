#!/usr/bin/env node
/**
 * FILE: criteria-settings-v6.test.js
 *
 * Contract test cho việc hiển thị criteria từ cả category_id và group_name.
 * Không truy cập hoặc thay đổi production database.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(
    path.join(root, 'modules/competition/competition-criteria-v6.js'),
    'utf8',
);

assert.match(
    source,
    /\.from\('competition_criteria'\)[\s\S]*\.select\(/,
);
assert.match(
    source,
    /String\(row\.category_id \?\? ''\) === selectedCategoryId/,
);
assert.match(
    source,
    /String\(row\.group_name \?\? ''\) === selectedCategoryId/,
);
assert.match(
    source,
    /\.filter\(\(row\) => \{/,
);

console.log('PASS: criteria settings preserves category_id/group_name compatibility');
