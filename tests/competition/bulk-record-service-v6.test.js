/**
 * FILE: bulk-record-service-v6.test.js
 *
 * Regression contract cho thao tác Ghi nhận một tiêu chí cho nhiều HS.
 * Không gọi Supabase production.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

function read(file) {
    return fs.readFileSync(path.join(root, file), 'utf8');
}

test('Bulk record operation has one shared service entry point', () => {
    const service = read('modules/competition/competition-record-service-v6.js');
    const submit = read('modules/competition/competition-record-submit-v6.js');

    assert.match(service, /function buildCompetitionRecordPayloadsV6/);
    assert.match(service, /function saveCompetitionRecordsV6/);
    assert.match(service, /\.insert\(payloads\)/);
    assert.match(service, /refreshCompetitionRecordStateV6/);
    assert.match(submit, /getCompetitionRecordSelectedStudentsV6/);
    assert.match(submit, /service\.saveCompetitionRecordsV6/);
    assert.doesNotMatch(submit, /Promise\.all\(studentIds\.map/, 'Submit không được tự triển khai bulk insert riêng.');
});

test('Bulk payload reuses the same single-record validation path', () => {
    const service = read('modules/competition/competition-record-service-v6.js');
    assert.match(service, /buildCompetitionRecordPayloadV6\(\{/);
    assert.match(service, /studentIds[\s\S]*new Set/);
});
