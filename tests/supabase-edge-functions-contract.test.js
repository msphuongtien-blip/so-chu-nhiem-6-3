/**
 * FILE: supabase-edge-functions-contract.test.js
 *
 * Regression contract cho các Edge Function production hiện có.
 * Chỉ kiểm tra source contract; không gọi endpoint và không mutate database.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

const provision = fs.readFileSync(
    path.join(root, 'supabase/functions/provision-student-accounts/index.ts'),
    'utf8',
);
const snapshots = fs.readFileSync(
    path.join(root, 'supabase/functions/create-weekly-snapshots/index.ts'),
    'utf8',
);

function includes(source, value, message) {
    assert.ok(source.includes(value), message || 'Missing: ' + value);
}

test('Student provisioning Edge Function requires authenticated teacher access', () => {
    for (const value of [
        'getUser',
        'callerProfile',
        'role',
        'Authorization',
        'provision',
    ]) {
        includes(provision, value);
    }
});

test('Student provisioning does not accept or store removed student fields', () => {
    for (const field of ['birth_date', 'parent_phone', 'students.email']) {
        assert.equal(
            provision.includes(field),
            false,
            'Edge Function không được sử dụng field đã loại bỏ: ' + field,
        );
    }
});

test('Student provisioning is idempotent for existing accounts', () => {
    includes(provision, 'existing');
    includes(provision, 'reset');
    includes(provision, 'student_id');
});

test('Weekly snapshot function has explicit authorization and snapshot write flow', () => {
    for (const value of [
        'Authorization',
        'Bearer',
        'competition_weekly_snapshots',
        'competition_records',
        'students',
    ]) {
        includes(snapshots, value);
    }
});

test('Weekly snapshot function does not expose service credentials to client code', () => {
    for (const value of ['SUPABASE_SERVICE_ROLE_KEY']) {
        includes(snapshots, value);
    }
    assert.equal(
        snapshots.includes('localStorage'),
        false,
        'Edge Function không được phụ thuộc localStorage.',
    );
});
