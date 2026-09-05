#!/usr/bin/env node
/**
 * FILE: tests/competition/issues.test.js
 *
 * Contract test cho task sửa điểm và notification nhắc GVCN xử lý.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const servicePath = path.join(root, 'competition-issues-v6.js');
const rendererPath = path.join(root, 'competition-issues-renderer-v6.js');

assert.equal(fs.existsSync(servicePath), true, 'Phải có service quản lý issue.');
assert.equal(fs.existsSync(rendererPath), true, 'Phải có renderer quản lý issue.');

const service = fs.readFileSync(servicePath, 'utf8');
const renderer = fs.readFileSync(rendererPath, 'utf8');

assert.match(service, /competition_data_issues/);
assert.match(service, /createIssue/);
assert.match(service, /listOpenIssues/);
assert.match(service, /resolveIssue/);
assert.match(service, /status.*OPEN|OPEN.*status/);
assert.match(service, /resolution_note/);

assert.match(renderer, /task.*sửa điểm|sửa điểm.*task/i);
assert.match(renderer, /OPEN/);
assert.match(renderer, /RESOLVED/);
assert.match(renderer, /editCompetitionRecord/);
assert.match(renderer, /resolveIssue/);
assert.match(renderer, /notification|thông báo/i);

console.log('PASS: competition issues contract');
