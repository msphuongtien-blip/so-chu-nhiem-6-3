#!/usr/bin/env node
/**
 * FILE: tests/competition/category-v6.test.js
 *
 * Mục đích:
 * Regression test cho C2.1 - Category Foundation.
 *
 * Contract:
 * - Có đúng 6 category nghiệp vụ.
 * - Category 6 (Học tập) đi cùng đường dữ liệu với 1-5.
 * - Module V6 expose helper dùng chung để render category.
 * - Entry point hiện tại phải load module Category V6.
 *
 * Một số literal 1-5 vẫn tồn tại trong app.js legacy ở C2.1. Chúng là
 * điểm tích hợp tạm thời và sẽ được loại bỏ khi C2.3 tách Record CRUD.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const categoryModulePath = path.join(root, 'competition-v6-category.js');
const indexPath = path.join(root, 'index.html');

const categorySource = fs.readFileSync(categoryModulePath, 'utf8');
const indexSource = fs.readFileSync(indexPath, 'utf8');

const context = vm.createContext({
    console,
    esc: (value) => String(value ?? ''),
    window: {
        supabase: {
            createClient() {
                return {
                    from() {
                        return {
                            select() {
                                return {
                                    order() {
                                        return this;
                                    },
                                };
                            },
                        };
                    },
                };
            },
        },
    },
    document: {},
});

vm.runInContext(categorySource, context, {
    filename: 'competition-v6-category.js',
});

const api = context.window.CompetitionCategoryV6;

assert.ok(
    api,
    'competition-v6-category.js phải expose CompetitionCategoryV6.',
);

const categories = [
    {
        id: 1,
        name: 'Giờ giấc – chuyên cần',
        active: true,
        sort_order: 1,
    },
    {
        id: 2,
        name: 'Nội quy – trật tự',
        active: true,
        sort_order: 2,
    },
    {
        id: 3,
        name: 'Vệ sinh – môi trường',
        active: true,
        sort_order: 3,
    },
    {
        id: 4,
        name: 'Tác phong – trang phục',
        active: true,
        sort_order: 4,
    },
    {
        id: 5,
        name: 'Trách nhiệm – ứng xử',
        active: true,
        sort_order: 5,
    },
    {
        id: 6,
        name: 'Học tập',
        active: true,
        sort_order: 6,
    },
];

const options = api.buildOptions(categories);

assert.equal(
    options.length,
    6,
    'Helper category phải render đủ 6 category.',
);

assert.ok(
    options.some((option) => option.includes('6. Học tập')),
    'Category 6 phải xuất hiện trong option được sinh từ dữ liệu category.',
);

assert.equal(
    indexSource.includes('competition-v6-category.js'),
    true,
    'index.html phải load module Category V6.',
);

console.log('PASS: Competition Category V6 contract');
