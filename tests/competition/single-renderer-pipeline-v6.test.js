/**
 * FILE: tests/competition/single-renderer-pipeline-v6.test.js
 *
 * Regression contract:
 * - Chỉ consolidated Competition pipeline được phép gán lại renderCompetition.
 * - Các compatibility module không được bọc renderer nữa.
 * - Pipeline phải là module cuối cùng trong APPLICATION_MODULES.
 * - app.js phải có cả History và Ranking trong cùng một render pass.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const loader = fs.readFileSync(
    path.join(root, 'core/module-loader.js'),
    'utf8',
);
const pipeline = fs.readFileSync(
    path.join(root, 'modules/competition/competition-renderer-v6.js'),
    'utf8',
);

const compatibilityModules = [
    'competition-v6-category.js',
    'competition-ranking-ui-v6.js',
    'competition-ranking-columns-v6.js',
    'competition-calculation-runtime-v6.js',
    'competition-issues-renderer-v6.js',
    'competition-snapshot-notification-v6.js',
];

for (const file of compatibilityModules) {
    const source = fs.readFileSync(path.join(root, 'modules/competition', file), 'utf8');

    assert.doesNotMatch(
        source,
        /window\.renderCompetition\s*=|globalThis\.renderCompetition\s*=/,
        file + ' không được override renderCompetition.',
    );
}

assert.match(
    pipeline,
    /globalThis\.renderCompetition\s*=\s*renderCompetitionPipelineV6/,
    'Consolidated pipeline phải là renderer duy nhất.',
);

const pipelineIndex = loader.indexOf('modules/competition/competition-renderer-v6.js');
const testCenterIndex = loader.indexOf("'test-center-entry-v6.js'");
assert.ok(pipelineIndex > 0, 'Pipeline phải được khai báo trong module-loader.');
assert.ok(
    pipelineIndex > testCenterIndex,
    'Pipeline phải được nạp sau các application modules khác.',
);

assert.match(
    app,
    /LỊCH SỬ: độc lập với bảng xếp hạng/,
    'Renderer phải giữ History độc lập với Ranking.',
);
assert.match(
    app,
    /id=\\?['"]competitionRecent/,
    'Renderer phải cập nhật khu vực Lịch sử.',
);
assert.match(
    app,
    /id=\\?['"]rankBody/,
    'Renderer phải cập nhật khu vực Ranking.',
);

console.log('single-renderer-pipeline-v6.test.js: all assertions passed');
