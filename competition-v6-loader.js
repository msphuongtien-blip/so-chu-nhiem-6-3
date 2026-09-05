/**
 * FILE: competition-v6-loader.js
 *
 * Baseline integration loader for Competition V6.
 * Source module set: v6/task-1-category-foundation.
 *
 * Important:
 * - Loads after app.js so V6 can wrap the existing legacy competition API.
 * - Does not load Core state/config files because baseline already owns those
 *   global bindings.
 * - Keeps the seating-chart module and all non-competition baseline features untouched.
 */
(function () {
    'use strict';

    const MODULES = [
        ['competition-v6-category', 'competition-v6-category.js'],
        ['competition-criteria-settings-boot-v6', 'competition-criteria-settings-boot-v6.js'],
        ['competition-record-sync-v6', 'competition-record-sync-v6.js'],
        ['competition-record-student-picker-v6', 'competition-record-student-picker-v6.js'],
        ['competition-render-helpers-v6', 'competition-render-helpers-v6.js'],
        ['competition-ux-v6', 'competition-ux-v6.js'],
        ['competition-record-edit-sync-v6', 'competition-record-edit-sync-v6.js'],
        ['competition-criteria-settings-ux-v6', 'competition-criteria-settings-ux-v6.js'],
        ['competition-calculation-v6', 'competition-calculation-v6.js'],
        ['competition-calculation-runtime-v6', 'competition-calculation-runtime-v6.js'],
        ['competition-record-form-v6', 'competition-record-form-v6.js'],
        ['competition-record-write-boundary-v6', 'competition-record-write-boundary-v6.js'],
        ['competition-ranking-ui-v6', 'competition-ranking-ui-v6.js'],
        ['competition-legacy-boundary-v6', 'competition-legacy-boundary-v6.js'],
        ['competition-record-form-clean-v6', 'competition-record-form-clean-v6.js'],
        ['competition-record-date-v6', 'competition-record-date-v6.js'],
        ['competition-record-edit-date-v6', 'competition-record-edit-date-v6.js'],
        ['competition-ranking-columns-v6', 'competition-ranking-columns-v6.js'],
        ['competition-issues-service-v6', 'competition-issues-service-v6.js'],
        ['competition-issues-renderer-v6', 'competition-issues-renderer-v6.js'],
        ['competition-recalculation-v6', 'competition-recalculation-v6.js'],
        ['competition-snapshot-notification-v6', 'competition-snapshot-notification-v6.js'],
        ['competition-snapshot-edit-v6', 'competition-snapshot-edit-v6.js'],
        ['student-autocomplete-v6', 'student-autocomplete-v6.js'],
        ['competition-record-form-final-v6', 'competition-record-form-final-v6.js'],
        ['competition-record-submit-v6', 'competition-record-submit-v6.js'],
    ];

    function loadStyle(id, href) {
        if (document.getElementById(id)) {
            return;
        }

        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }

    function loadScript(id, src) {
        const existing = document.getElementById(id);

        if (existing) {
            return Promise.resolve(existing);
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.id = id;
            script.src = src;
            script.defer = true;
            script.addEventListener('load', () => resolve(script), {
                once: true,
            });
            script.addEventListener('error', () => {
                reject(new Error('Không thể nạp module Thi đua V6: ' + src));
            }, { once: true });
            document.head.appendChild(script);
        });
    }

    async function bootCompetitionV6() {
        loadStyle(
            'competition-ux-v6-baseline-style',
            'competition-ux-v6.css',
        );
        loadStyle(
            'competition-record-student-picker-v6-style',
            'competition-record-student-picker-v6.css',
        );
        loadStyle(
            'student-autocomplete-v6-style',
            'student-autocomplete-v6.css',
        );

        for (const [id, src] of MODULES) {
            try {
                await loadScript(id, src);
            } catch (error) {
                console.error('[Competition V6] Module load failed:', src, error);
            }
        }
    }

    globalThis.CompetitionV6BaselineLoader = Object.freeze({
        bootCompetitionV6,
        MODULES,
    });

    bootCompetitionV6();
})();
