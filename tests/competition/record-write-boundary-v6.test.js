#!/usr/bin/env node
/**
 * FILE: tests/competition/record-write-boundary-v6.test.js
 *
 * Mục đích:
 * Contract test cho boundary addCompetition() trong giai đoạn app.js legacy
 * vẫn tồn tại.
 *
 * Contract:
 * - Legacy signature được chuyển thành input chuẩn cho Record Service V6.
 * - Không tự cộng/trừ điểm tổng học sinh.
 * - Giữ student, criteria, category, week, date và created_by.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(
    path.join(root, 'competition-record-write-boundary-v6.js'),
    'utf8',
);

const context = vm.createContext({
    console,
    window: {},
});

vm.runInContext(source, context, {
    filename: 'competition-record-write-boundary-v6.js',
});

const api = context.CompetitionRecordWriteBoundaryV6;

assert.ok(api, 'CompetitionRecordWriteBoundaryV6 phải được expose.');

const input = api.buildLegacyCompetitionRecordInputV6({
    studentId: 'student-1',
    points: 3,
    criteriaName: 'Phát biểu xây dựng bài',
    note: 'Tích cực',
    categoryId: 6,
    week: '2030-01-07',
    date: '2030-01-09',
    createdBy: 'teacher-1',
    criteriaId: 'criteria-6-1',
});

assert.deepEqual(
    JSON.parse(JSON.stringify(input)),
    {
        studentId: 'student-1',
        points: 3,
        criteria: {
            id: 'criteria-6-1',
            name: 'Phát biểu xây dựng bài',
        },
        note: 'Tích cực',
        categoryId: 6,
        week: '2030-01-07',
        date: '2030-01-09',
        createdBy: 'teacher-1',
    },
);

assert.throws(
    () => api.buildLegacyCompetitionRecordInputV6({
        studentId: 'student-1',
        points: 0,
        criteriaName: 'Sai',
        categoryId: 6,
        week: '2030-01-07',
        date: '2030-01-09',
        createdBy: 'teacher-1',
        criteriaId: 'criteria-6-1',
    }),
    /Điểm chỉ được chọn/,
);

console.log('PASS: legacy competition write boundary contract');
