#!/usr/bin/env node
/**
 * FILE: tests/competition/record-form-v6.test.js
 *
 * Mục đích:
 * Regression test cho form Ghi nhận Thi đua V6 và clean boundary.
 *
 * Contract:
 * - Form vẫn có Nhóm tiêu chí và Tiêu chí.
 * - Category 6 vẫn được hỗ trợ.
 * - Người dùng không nhập Ngày hoặc Tuần.
 * - Ngày hiện tại và Tuần tương ứng được tự suy ra khi submit.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const formPath = path.join(root, 'competition-record-form-v6.js');
const cleanPath = path.join(root, 'competition-record-form-clean-v6.js');
const source = fs.readFileSync(formPath, 'utf8');
const cleanSource = fs.readFileSync(cleanPath, 'utf8');

assert.match(
    source,
    /id="fGroupV6"/,
    'Form V6 phải có select Nhóm tiêu chí.',
);

assert.match(
    source,
    /id="fCriteriaV6"/,
    'Form V6 phải có select Tiêu chí.',
);

assert.match(
    source,
    /getActiveCompetitionCategoriesV6/,
    'Form V6 phải lấy category từ module Category V6.',
);

assert.match(
    source,
    /category_id/,
    'Criteria phải liên kết với category qua category_id.',
);

assert.doesNotMatch(
    source,
    /criteria-group.*criteria-chip/s,
    'Form V6 không được render block criteria cards duplicate.',
);

assert.match(
    cleanSource,
    /fDateV6.*closest\('\.field'\).*remove/s,
    'Clean boundary phải loại field Ngày khỏi UI.',
);

assert.match(
    cleanSource,
    /fWeekV6.*closest\('\.field'\).*remove/s,
    'Clean boundary phải loại field Tuần khỏi UI.',
);

assert.match(
    cleanSource,
    /const date = localDate\(\)/,
    'Ngày ghi nhận phải tự lấy ngày hiện tại.',
);

assert.match(
    cleanSource,
    /CompetitionCalculationV6\?\.getMonday/,
    'Tuần ghi nhận phải tự suy ra từ Ngày bằng calculation engine.',
);

console.log('PASS: Competition Record Form V6 clean-boundary contract');
