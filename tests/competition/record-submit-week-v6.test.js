const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('Competition V6 submit derives week from the form date when no Week field exists', () => {
    const source = read(
        'modules/competition/competition-record-submit-v6.js',
    );

    assert.match(
        source,
        /const date\s*=\s*\n\s*document\.getElementById\('fDateV6'\)\?\.value/,
    );
    assert.match(
        source,
        /document\.getElementById\('fWeekV6'\)\?\.value\s*\|\|/,
    );
    assert.match(
        source,
        /CompetitionRecordFormV6\?\.getRecordFormWeekFromDateV6\?\.\(date\)/,
    );
    assert.doesNotMatch(
        source,
        /if\s*\(\s*!studentId\s*\|\|\s*!week\s*\|\|\s*!date\s*\|\|\s*!categoryId\s*\|\|\s*!criteriaId\s*\)/,
    );
});

test('Competition V6 record form defaults the recording date to the selected week', () => {
    const source = read(
        'modules/competition/competition-record-form-v6.js',
    );

    assert.match(source, /const selectedWeek\s*=\s*[\s\S]*compWeekInput/);
    assert.match(source, /const defaultRecordDate\s*=\s*[\s\S]*selectedWeek/);
    assert.match(
        source,
        /value="\$\{escapeRecordFormV6\(defaultRecordDate\)\}"/,
    );
});
