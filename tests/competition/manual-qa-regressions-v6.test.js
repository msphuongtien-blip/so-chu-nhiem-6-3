#!/usr/bin/env node
/**
 * Regression tests for the Competition V6 issues reported during manual QA.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const loader = read('core/module-loader.js');
const index = read('index.html');
const app = read('app.js');
const form = read('modules/competition/competition-record-form-v6.js');
const service = read('modules/competition/competition-record-service-v6.js');
const submit = read('modules/competition/competition-record-submit-v6.js');

// 1. Saving a record must have the Service V6 and Submit V6 modules loaded.
assert.match(loader, /competition-record-service-v6-script.*competition-record-service-v6\.js/s);
assert.match(loader, /competition-record-submit-v6-script.*competition-record-submit-v6\.js/s);
assert.ok(
    loader.indexOf('competition-record-service-v6-script') <
    loader.indexOf('competition-record-submit-v6-script'),
    'Record Service must load before Record Submit.',
);

// 2. The same source file must not be loaded multiple times under old compatibility IDs.
const competitionLoaderEntries = [...loader.matchAll(
    /\['[^']+',\s*'modules\/competition\/([^']+)'\]/g,
)].map(match => match[1]);
const duplicateSources = competitionLoaderEntries.filter(
    (source, index) => competitionLoaderEntries.indexOf(source) !== index,
);
assert.deepEqual(
    [...new Set(duplicateSources)],
    [],
    'A V6 module source must be loaded only once.',
);

// 3. Criterion default score must be stored/read and used by the record form.
assert.match(form, /default_score/);
assert.match(form, /getRecordFormCriteriaDefaultScoreV6/);
assert.match(
    form,
    /buildRecordScoreOptionsV6\(\s*getRecordFormCriteriaDefaultScoreV6/,
    'Record form must initialize the score from the selected criterion default.',
);


// 4. Multi-student filter keeps the full 44-student ranking and exposes
// the selected students' ranks within that full ranking.
assert.match(index, /id="compStudentFilter"[^>]*multiple/);
assert.match(app, /selectedStudentIds/);
assert.match(
    app,
    /selectedStudentIds\.includes\(String\(record\.student_id\)\)/,
    'History must accept multiple selected students.',
);
assert.match(
    app,
    /rankingText \+ ' \/ 44'/,
    'Selected students must keep their rank against the full 44-student ranking.',
);

// 5. Record boundary may install only after the service is ready.
const boundary = read('modules/competition/competition-record-boundary-v6.js');
assert.match(boundary, /CompetitionRecordServiceV6[\s\S]*saveCompetitionRecordV6/);
assert.match(boundary, /if \(typeof submitV6 !== 'function'\)/);

// 6. Existing edit flow remains separate from the new create/save service.
assert.match(app, /function editCompetitionRecord\(/);
assert.match(app, /function deleteCompetitionRecord\(/);

// 7. User-facing feature removals remain absent from navigation.
assert.doesNotMatch(index, /Phản hồi học sinh/);
assert.doesNotMatch(index, /onclick="[^"]*sFeedback/);

// 8. Basic syntax check for the modules touched by this QA cycle.
for (const file of [
    'core/module-loader.js',
    'modules/competition/competition-record-form-v6.js',
    'modules/competition/competition-record-service-v6.js',
    'modules/competition/competition-record-submit-v6.js',
    'app.js',
]) {
    assert.doesNotThrow(
        () => new Function(read(file)),
        `Syntax error in ${file}`,
    );
}

console.log('PASS: Competition V6 manual-QA regression contracts');
