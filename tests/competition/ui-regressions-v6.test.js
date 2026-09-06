#!/usr/bin/env node
const fs = require('node:fs');
/** Regression tests for V6 ranking, student picker, and record form UI. */

const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const rawIndexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const indexSource = rawIndexSource.replace(/\s+/g, ' ');
const autocompleteSource = fs.readFileSync(path.join(root, 'modules/students/student-autocomplete-v6.js'), 'utf8');
const appSource = fs.readFileSync('app.js', 'utf8');
const finalFormSource = fs.readFileSync(path.join(root, 'modules/competition/competition-record-form-v6.js'), 'utf8');
const rankingColumnsSource = fs.readFileSync(path.join(root, 'modules/competition/competition-ranking-columns-v6.js'), 'utf8');

const rankingHeaderMatch = rankingColumnsSource.match(
    /RANKING_ALLOWED_HEADERS_V6\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/,
);
assert.ok(rankingHeaderMatch, 'Ranking V6 phải định nghĩa danh sách cột được phép.');
assert.match(
    rankingHeaderMatch[1],
    /'Hạng'\s*,\s*'Học sinh'\s*,\s*'Điểm tuần'\s*,\s*'Huy hiệu'/,
    'Ranking V6 phải định nghĩa đúng 4 cột.',
);
assert.doesNotMatch(rankingHeaderMatch[1], /Điểm tháng|Xu hướng|Nhóm/);
assert.doesNotMatch(autocompleteSource, /<label>Học sinh/);
assert.match(
    finalFormSource,
    /const date = document\.getElementById\('fDateV6'\)\?\.value/,
);
assert.match(
    finalFormSource,
    /const week = getRecordFormWeekFromDateV6\(date\)/,
);
assert.match(
    finalFormSource,
    /const categoryId = document\.getElementById\('fGroupV6'\)\?\.value/,
);
assert.match(
    finalFormSource,
    /const criteriaId = document\.getElementById\('fCriteriaV6'\)\?\.value/,
);
assert.match(
    finalFormSource,
    /function submitCompetitionV6\(\)/,
);
assert.match(
    finalFormSource,
    /fStudentV6/,
);
assert.match(
    finalFormSource,
    /fCriteriaV6/,
);
assert.match(
    finalFormSource,
    /fPointsV6/,
);
assert.match(
    finalFormSource,
    /getRecordFormCriteriaDefaultScoreV6/,
    'Form V6 phải có contract cho default score theo tiêu chí.',
);
console.log('PASS: UI regressions for ranking, student picker, and record form');


/*
 * Regression contract: competition page must fetch fresh students and
 * competition_records whenever it renders, rather than trusting stale cache.
 */
assert.match(appSource, /let competitionRenderRequestId = 0/);
assert.match(appSource, /sb\.from\('students'\)\.select\('\*'\)/);
assert.match(appSource, /sb\.from\('competition_records'\)/);
assert.match(appSource, /competitionRenderRequestId/);


/*
 * Regression contract:
 * - Ranking must use CompetitionCalculationV6 when it is available.
 * - History must normalize week/week_start/date before filtering.
 */
assert.match(appSource, /CompetitionCalculationV6/);
assert.match(appSource, /const canonicalWeek = String[\s\S]*?record\.week_start \|\| record\.week/);
assert.match(appSource, /selectedStudentIds/);
