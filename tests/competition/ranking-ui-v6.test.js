#!/usr/bin/env node
/**
 * Contract test cho bảng xếp hạng Thi đua V6.
 *
 * Contract:
 * - Chỉ có 3 cột: Học sinh, Điểm tuần, Huy hiệu.
 * - Không hiển thị Hạng, Điểm tháng, Xu hướng.
 * - Legacy Nhóm được đổi thành Huy hiệu.
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

const context = vm.createContext({
    console,
    document: {
        getElementById() {
            return null;
        },
    },
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
    Array.from(api.allowedHeaders),
    ['Học sinh', 'Điểm tuần', 'Huy hiệu'],
);

assert.match(
    source,
    /textContent\.trim\(\)[\s\S]*Nhóm/, 
    'Boundary phải nhận diện nhãn Nhóm legacy.',
);

assert.match(
    source,
    /header\.textContent = 'Huy hiệu'/,
    'Boundary phải đổi Nhóm legacy thành Huy hiệu.',
);

assert.match(
    source,
    /RANKING_ALLOWED_HEADERS_V6[\s\S]*Học sinh[\s\S]*Điểm tuần[\s\S]*Huy hiệu/,
    'Boundary phải khóa bảng về đúng 3 cột nghiệp vụ.',
);

assert.match(
    appSource,
    /function group\(score\).*Kim cương.*Vàng.*Bạc.*Đồng.*Sắt/s,
    'Badge phải giữ đủ Kim cương, Vàng, Bạc, Đồng và Sắt.',
);

assert.match(
    appSource,
    /'<td><b>'+Number\(s\.weekly\)\.toFixed\(0\)<\/b><\/td>'[\s\S]*groupBadge\(s\.weekly\)/,
    'Bảng phải dùng một giá trị Điểm tuần duy nhất và badge từ cùng weekly score.',
);

assert.match(
    appSource,
    /\(s\.team\|\|''\)/,
    'Dữ liệu Tổ học sinh phải tiếp tục được sử dụng.',
);

console.log('PASS: ranking is limited to weekly score and badge');
