#!/usr/bin/env node
/**
 * FILE: tests/competition/legacy-boundary-v6.test.js
 *
 * Mục đích:
 * Contract test bảo đảm các tên hàm legacy dùng trong inline HTML đã được
 * route sang implementation V6 sau bootstrap.
 *
 * Không test database và không tạo dữ liệu production.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(
    path.join(root, 'modules/competition/competition-record-boundary-v6.js'),
    'utf8',
);

const legacyOpen = function legacyOpen() {};
const legacyAdd = function legacyAdd() {};
const legacySubmit = function legacySubmit() {};
const v6Open = function openCompetitionFormV6() {};
const v6Add = function addCompetitionThroughV6Boundary() {};
const v6Submit = function submitCompetitionV6() {};

const context = vm.createContext({
    console,
    setTimeout,
    Date,
    window: {
        setInterval,
        clearInterval,
    },
    openCompetitionForm: legacyOpen,
    addCompetition: legacyAdd,
    submitCompetition: legacySubmit,
    openCompetitionFormV6: v6Open,
    addCompetitionThroughV6Boundary: v6Add,
    submitCompetitionV6: v6Submit,
    CompetitionRecordServiceV6: {
        saveCompetitionRecordV6: async () => ({ ok: true }),
    },
});

vm.runInContext(source, context, {
    filename: 'modules/competition/competition-record-boundary-v6.js',
});

const installed = context.installCompetitionLegacyBoundaryV6();

assert.equal(installed, true);
assert.equal(context.openCompetitionForm, v6Open);
assert.equal(context.addCompetition, v6Add);
assert.equal(context.submitCompetition, v6Submit);
assert.equal(
    context.__competitionLegacyBoundaryV6Installed,
    true,
);

console.log('PASS: legacy competition entrypoints route to V6');
