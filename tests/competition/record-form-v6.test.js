#!/usr/bin/env node
/**
 * FILE: tests/competition/record-form-v6.test.js
 *
 * Mục đích:
 * Regression test cho form Ghi nhận Thi đua V6.
 *
 * Contract:
 * - Form vẫn có Nhóm tiêu chí và Tiêu chí.
 * - Category 6 vẫn được hỗ trợ.
 * - Người dùng được chọn Ngày.
 * - Người dùng không được chọn Tuần.
 * - Tuần được hệ thống tự suy ra từ Ngày khi submit.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const formPath = path.join(root, 'competition-record-form-v6.js');
const cleanPath = path.join(root, 'competition-record-form-clean-v6.js');
const source = fs.readFileSync(formPath, 'utf8');
const cleanSource = fs.readFileSync(cleanPath, 'utf8');

assert.match(source, /id="fGroupV6"/);
assert.match(source, /id="fCriteriaV6"/);
assert.match(source, /getActiveCompetitionCategoriesV6/);
assert.match(source, /category_id/);

assert.doesNotMatch(
    source,
    /criteria-group.*criteria-chip/s,
    'Form V6 không được render block criteria cards duplicate.',
);

assert.match(
    source,
    /id="fDateV6"/, 
    'Form phải cho giáo viên chọn Ngày.',
);

assert.match(
    cleanSource,
    /fWeekV6.*closest\('\.field'\).*remove/s,
    'Clean boundary phải loại field Tuần khỏi UI.',
);

assert.doesNotMatch(
    cleanSource,
    /fDateV6.*closest\('\.field'\).*remove/s,
    'Clean boundary không được loại field Ngày.',
);

assert.match(
    cleanSource,
    /const date = document\.getElementById\('fDateV6'\)\?\.value/,
    'Submit phải lấy Ngày do người dùng chọn.',
);

assert.match(
    cleanSource,
    /CompetitionCalculationV6\?\.getMonday\?\.\(date\)/,
    'Tuần phải tự suy ra từ Ngày bằng calculation engine.',
);

console.log('PASS: Competition Record Form V6 date-driven week contract');
