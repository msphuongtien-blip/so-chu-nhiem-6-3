#!/usr/bin/env node
/**
 * FILE: tests/competition/save-pipeline-readiness-v6.test.js
 *
 * Regression:
 * Form V6 may become usable before the dynamically loaded write boundary.
 * In that window, submit must wait rather than report a false readiness error.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

(async () => {
    const root = path.resolve(__dirname, '../..');
    const source = fs.readFileSync(
        path.join(root, 'modules/competition/competition-record-form-v6.js'),
        'utf8',
    );

    const elements = {
        fStudentV6: { value: 'student-1' },
        fDateV6: { value: '2030-01-09' },
        fGroupV6: { value: '6' },
        fCriteriaV6: { value: 'criteria-6-1' },
        fPointsV6: { value: '3' },
        fNoteV6: { value: 'Tích cực' },
    };

    let writerCalls = 0;
    let writerReady = false;

    const client = {
        from() {
            return {
                select() {
                    return this;
                },
                eq() {
                    return this;
                },
                async single() {
                    return {
                        data: {
                            id: 'criteria-6-1',
                            name: 'Hoàn thành tốt',
                            active: true,
                            category_id: 6,
                        },
                        error: null,
                    };
                },
            };
        },
    };

    const context = vm.createContext({
        console,
        setTimeout,
        clearTimeout,
        document: {
            getElementById(id) {
                return elements[id] || null;
            },
        },
        alert() {
            throw new Error('Unexpected alert during save pipeline test.');
        },
        window: {
            supabase: {
                createClient() {
                    return client;
                },
            },
        },
        closeModal() {},
        renderStudents: async () => {},
        renderCompetition: async () => {},
        renderDashboard: async () => {},
        SNCoreSupabase: { client },
        CompetitionCalculationV6: {
            getMonday() {
                return '2030-01-07';
            },
        },
        addCompetition: async () => {
            if (!writerReady) {
                return false;
            }
            writerCalls += 1;
            return true;
        },
    });

    vm.runInContext(source, context, {
        filename: 'modules/competition/competition-record-form-v6.js',
    });

    writerReady = true;

    const ok = await context.submitCompetitionV6();

    assert.equal(ok, true);
    assert.equal(writerCalls, 1);

    console.log('PASS: competition save uses the current write boundary');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
