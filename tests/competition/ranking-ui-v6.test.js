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
 * - Đổi nhãn legacy Nhóm thành Huy hiệu.
 * - Giữ toàn bộ badge: Kim cương, Vàng, Bạc, Đồng, Sắt.
 * - Không đụng dữ liệu Tổ học sinh.
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
    source,
    /textContent\.trim\(\) === 'Nhóm'/,
    'Boundary phải nhận diện nhãn Nhóm legacy.',
);

assert.match(
    source,
    /header\.textContent = 'Huy hiệu'/,
    'Boundary phải đổi Nhóm legacy thành Huy hiệu.',
);

assert.match(
    appSource,
    /function group\(score\).*Kim cương.*Vàng.*Bạc.*Đồng.*Sắt/s,
    'Badge phải giữ đủ Kim cương, Vàng, Bạc, Đồng và Sắt.',
);

assert.doesNotMatch(
    source,
    /trendText\(/,
    'Ranking boundary không được render Xu hướng.',
);

assert.doesNotMatch(
    source,
    /calculateStudentMonth\(/,
    'Ranking boundary không được render Điểm tháng.',
);

assert.match(
    appSource,
    /\(s\.team\|\|''\)/,
    'Dữ liệu Tổ học sinh phải tiếp tục được sử dụng.',
);

console.log('PASS: ranking removes monthly/trend while preserving all badges');
