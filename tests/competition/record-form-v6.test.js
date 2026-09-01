#!/usr/bin/env node
/**
 * FILE: tests/competition/record-form-v6.test.js
 *
 * Mục đích:
 * Regression test cho form Ghi nhận Thi đua V6.
 *
 * Contract:
 * - Form không được còn các card criteria nhóm 1-5 dạng duplicate.
 * - Form phải có select Nhóm tiêu chí và Tiêu chí riêng.
 * - Helper nhóm phải nhận đầy đủ category từ dữ liệu bên ngoài.
 * - Category 6 phải được render nếu database trả về category 6.
 * - Người dùng chỉ chọn Ngày; Tuần phải được hệ thống tự suy ra.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const formPath = path.join(root, 'competition-record-form-v6.js');
const source = fs.readFileSync(formPath, 'utf8');

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

assert.doesNotMatch(
    source,
    /id="fWeekV6"/,
    'Form V6 không được cho người dùng chọn Tuần thủ công.',
);

assert.match(
    source,
    /CompetitionCalculationV6\.getMonday/,
    'Submit V6 phải tự suy ra tuần từ Ngày bằng calculation engine.',
);

console.log('PASS: Competition Record Form V6 contract');
