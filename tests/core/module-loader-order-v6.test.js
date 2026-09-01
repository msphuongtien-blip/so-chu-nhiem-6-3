#!/usr/bin/env node
/**
 * Regression contract for V6 dynamic module loading.
 *
 * The competition form depends on the write boundary and final boundary.
 * Dynamic scripts must therefore execute in APPLICATION_MODULES order.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

(async () => {
    const root = path.resolve(__dirname, '../..');
    const source = fs.readFileSync(
        path.join(root, 'core/module-loader.js'),
        'utf8',
    );

    const appended = [];
    const context = vm.createContext({
        console,
        setTimeout,
        clearTimeout,
        document: {
            getElementById() {
                return null;
            },
            head: {
                appendChild(script) {
                    appended.push(script.src);
                    setTimeout(() => script._load(), 0);
                },
            },
            createElement() {
                const listeners = {};
                return {
                    addEventListener(type, handler) {
                        listeners[type] = handler;
                    },
                    _load() {
                        listeners.load?.();
                    },
                };
            },
        },
    });

    vm.runInContext(source, context, {
        filename: 'core/module-loader.js',
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.equal(
        appended.length,
        context.ApplicationModuleLoaderV6.APPLICATION_MODULES.length,
    );

    const expected = context.ApplicationModuleLoaderV6.APPLICATION_MODULES.map(
        ([, src]) => src,
    );

    assert.deepEqual(appended, expected);

    console.log('PASS: V6 application modules load sequentially');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
