#!/usr/bin/env node
/**
 * FILE: tests/competition/ranking-ui-v6.test.js
 *
 * Mục đích:
 * Contract test cho bảng xếp hạng Thi đua V6.
 *
 * Contract:
 * - Không hiển thị Điểm tháng.
 * - Không hiển thị Xu hướng.
 * - Giữ Huy hiệu và toàn bộ các mức badge.
 * - Tổ học sinh không thuộc contract này và không bị xóa khỏi dữ liệu.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(
    path.join(root, 'competition-ranking-columns-v6.js'),
    'utf8',
);
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const document = {
    getElementById() {
        return null;
    },
};

const context = vm.createContext({
    console,
    document,
    window: {
        setInterval,
        clearInterval,
    },
    globalThis: null,
});

context.globalThis = context;

vm.runInContext(source, context, {
    filename: 'competition-ranking-columns-v6.js',
});

const api = context.CompetitionRankingColumnsV6;

assert.ok(api, 'CompetitionRankingColumnsV6 phải được expose.');
assert.deepEqual(
    Array.from(api.hiddenHeaders),
    ['Điểm tháng', 'Xu hướng'],
);

assert.match(
    indexSource,
    /<th>Huy hiệu<\/th>/,
    'Ranking phải hiển thị cột Huy hiệu.',
);

assert.doesNotMatch(
    indexSource,
    /<th>Điểm tháng<\/th>/,
    'Ranking không được khai báo cột Điểm tháng.',
);

assert.doesNotMatch(
    indexSource,
    /<th>Xu hướng<\/th>/,
    'Ranking không được khai báo cột Xu hướng.',
);

assert.match(
    appSource,
    /group\(score\).*Kim cương.*Vàng.*Bạc.*Đồng.*Sắt/s,
    'Badge phải giữ đủ Kim cương, Vàng, Bạc, Đồng và Sắt.',
);

assert.doesNotMatch(
    appSource,
    /calculateStudentMonth\(/,
    'Logic Điểm tháng không được còn trong app.js.',
);

assert.doesNotMatch(
    appSource,
    /monthly:calcMonth|monthly\s*:/,
    'Ranking không được tính điểm tháng.',
);

assert.match(
    appSource,
    /\(s\.team\|\|''\)/,
    'Dữ liệu Tổ học sinh phải tiếp tục được sử dụng.',
);

console.log('PASS: ranking removes monthly/trend while preserving all badges');
