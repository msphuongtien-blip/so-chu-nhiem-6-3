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
    assert.match(
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

test('Competition V6 week label uses a Monday-to-Sunday range', () => {
    const utils = read('core/utils.js');

    assert.match(
        utils,
        /function compWeekRange\(value\)/,
        'Utils phải có helper hiển thị khoảng tuần.',
    );
    assert.match(
        utils,
        /return 'Tuần ' \+ format\(date\) \+ ' – ' \+ format\(end\)/,
        'Nhãn tuần phải hiển thị từ thứ Hai đến Chủ nhật.',
    );
});

test('Competition V6 service rejects a record date outside its canonical week', () => {
    const source = read(
        'modules/competition/competition-record-service-v6.js',
    );

    assert.match(
        source,
        /canonicalWeek = getCompetitionRecordWeekV6\(week\)/,
    );
    assert.match(
        source,
        /recordWeek = getCompetitionRecordWeekV6\(date\)/,
    );
    assert.match(
        source,
        /recordWeek !== canonicalWeek/,
    );
});

test('Competition V6 record form restricts the date to the selected week', () => {
    const source = read(
        'modules/competition/competition-record-form-v6.js',
    );

    assert.match(
        source,
        /min="\$\{escapeRecordFormV6\(selectedWeek \|\| defaultRecordDate\)\}"/,
    );
    assert.match(
        source,
        /max="\$\{escapeRecordFormV6\(selectedWeekEnd\)\}"/,
    );
});

test('Competition V6 uses the canonical Core resolver for all record-week derivation', () => {
    const service = read(
        'modules/competition/competition-record-service-v6.js',
    );
    const form = read(
        'modules/competition/competition-record-form-v6.js',
    );

    assert.match(
        service,
        /!\/^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(normalized\)/,
        'Service phải validate date-only trước khi resolve tuần.',
    );
    assert.match(
        service,
        /typeof compWeekStart !== 'function'/,
        'Service phải phụ thuộc resolver tuần canonical của Core.',
    );
    assert.match(
        service,
        /return compWeekStart\(normalized\);/,
        'Service phải dùng cùng resolver với UI.',
    );
    assert.match(
        form,
        /return compWeekStart\(dateValue\);/,
        'Form phải dùng cùng resolver với service.',
    );
    assert.match(
        form,
        /id="fWeekV6"[\s\S]*type="hidden"/,
        'Form phải giữ tuần đã chọn để submit không tự đổi sang tuần khác.',
    );
    assert.match(
        form,
        /T00:00:00Z[\s\S]*setUTCDate\(date\.getUTCDate\(\) \+ 6\)/,
        'Ngày cuối tuần phải được tính theo UTC date-only.',
    );
});
