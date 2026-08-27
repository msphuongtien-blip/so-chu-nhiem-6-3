const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '../..');

/**
 * Tải một classic script vào VM context để kiểm tra Core độc lập với browser.
 *
 * Các test này không gọi Supabase thật và không thay đổi database.
 */
function loadScript(relativePath, extra = {}) {
    const context = {
        console,
        document: {
            getElementById: () => null,
        },
        ...extra,
    };

    context.globalThis = context;

    const filePath = path.join(projectRoot, relativePath);

    vm.runInNewContext(
        fs.readFileSync(filePath, 'utf8'),
        context,
        {
            filename: filePath,
        },
    );

    return context;
}

test('config points to the existing Supabase project', () => {
    const context = loadScript('core/config.js');

    assert.equal(
        context.SNCoreConfig.SUPABASE_URL,
        'https://fdyhnwklzizzbiyqqlxo.supabase.co',
    );

    assert.equal(
        context.SNCoreConfig.APP_VERSION,
        'V5-SUPABASE-DATABASE',
    );
});

test('state preserves the current application defaults', () => {
    const context = loadScript('core/state.js');
    const state = context.SNCoreState.createInitialState();

    assert.equal(state.currentUser, null);
    assert.equal(state.currentProfile, null);
    assert.equal(state.role, 'teacher');
    assert.equal(state.students.length, 0);
    assert.equal(state.randomHistory.length, 0);
    assert.equal(state.supabaseCache.students.length, 0);
    assert.equal(state.supabaseCache.competitionRecords.length, 0);
    assert.equal(state.classSettings.class_name, '6/3');
    assert.equal(state.classSettings.school_year, '2026-2027');
    assert.equal(state.classSettings.teacher_name, 'Phượng Tiên');
});

test('escapeHtml preserves the existing HTML escaping contract', () => {
    const context = loadScript('core/utils.js');

    assert.equal(
        context.SNCoreUtils.escapeHtml('<script>"x"</script>'),
        '&lt;script&gt;&quot;x&quot;&lt;/script&gt;',
    );
});

test('getCurrentWeekStart returns the Monday of the selected week', () => {
    const context = loadScript('core/utils.js');

    assert.equal(
        context.SNCoreUtils.getCurrentWeekStart(
            new Date('2026-08-26T00:00:00Z'),
        ),
        '2026-08-24',
    );

    assert.equal(
        context.SNCoreUtils.getCurrentWeekStart(
            new Date('2026-08-30T00:00:00Z'),
        ),
        '2026-08-24',
    );
});

test('compWeekStart normalizes a date to Monday', () => {
    const context = loadScript('core/utils.js');

    assert.equal(
        context.SNCoreUtils.compWeekStart('2026-08-27'),
        '2026-08-24',
    );
});

test('supabase client factory uses the existing Supabase global', () => {
    const context = loadScript(
        'core/config.js',
        {
            supabase: {
                createClient: (url, key) => ({
                    url,
                    key,
                }),
            },
        },
    );

    vm.runInNewContext(
        fs.readFileSync(
            path.join(projectRoot, 'core/supabase.js'),
            'utf8',
        ),
        context,
        {
            filename: path.join(projectRoot, 'core/supabase.js'),
        },
    );

    assert.equal(
        typeof context.SNCoreSupabase.createClient,
        'function',
    );

    assert.equal(
        context.SNCoreSupabase.client.url,
        context.SNCoreConfig.SUPABASE_URL,
    );

    assert.equal(
        context.SNCoreSupabase.client.key,
        context.SNCoreConfig.SUPABASE_PUBLISHABLE_KEY,
    );
});
