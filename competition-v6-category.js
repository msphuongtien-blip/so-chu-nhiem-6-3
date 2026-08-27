/**
 * V6 Task 1 — Dynamic competition categories.
 *
 * This compatibility layer keeps the existing app.js intact while moving
 * category selection to Supabase. Category 6 (Học tập) therefore follows
 * the same path as the other categories without hard-coded 1–5 lists.
 */

const V6_VALID_SCORES = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];
let competitionCategoriesV6 = [];

/** Load categories from the existing Supabase database. */
async function loadCompetitionCategoriesV6() {
    const { data, error } = await sb
        .from('competition_categories')
        .select('id, name, active, sort_order')
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });

    if (error) throw error;

    competitionCategoriesV6 = data || [];
    return competitionCategoriesV6;
}

/** Return categories available for new records. */
function getActiveCompetitionCategoriesV6() {
    return competitionCategoriesV6.filter(
        category => category.active !== false
    );
}

/** Resolve a category name from the database-backed list. */
function categoryName(id) {
    const category = competitionCategoriesV6.find(
        item => String(item.id) === String(id)
    );

    return category?.name || 'Không xác định';
}

/** Build category options without hard-coding category IDs. */
function competitionCategoryOptionsV6(selectedId = '') {
    return getActiveCompetitionCategoriesV6()
        .map(category => {
            const selected =
                String(category.id) === String(selectedId)
                    ? ' selected'
                    : '';

            return (
                '<option value="' + esc(category.id) + '"' + selected + '>' +
                    esc(category.id) + '. ' + esc(category.name) +
                '</option>'
            );
        })
        .join('');
}

/** Build the only allowed score values. Zero is intentionally absent. */
function scoreOptionsV6(selected = 1) {
    return V6_VALID_SCORES.map(value => {
        const selectedAttr = Number(selected) === value ? ' selected' : '';
        const label = value > 0 ? '+' + value : String(value);

        return (
            '<option value="' + value + '"' + selectedAttr + '>' +
                label +
            '</option>'
        );
    }).join('');
}

/** Support both the current legacy score fields and V6 default_score. */
function criteriaDefaultScoreV6(criteria) {
    if (criteria.default_score != null) {
        return Number(criteria.default_score);
    }

    const points = Number(criteria.points || 0);

    return criteria.type === 'minus'
        ? -Math.abs(points)
        : Math.abs(points);
}

/* Load categories before the existing application bootstrap runs. */
const loadAllV5 = loadAll;
async function loadAll() {
    await loadCompetitionCategoriesV6();
    return loadAllV5();
}

/* Refresh categories before the existing competition renderer runs. */
const renderCompetitionV5 = renderCompetition;
async function renderCompetition() {
    await loadCompetitionCategoriesV6();
    renderCompetitionCategoryFilterV6();
    return renderCompetitionV5();
}

/** Render the competition category filter from Supabase. */
function renderCompetitionCategoryFilterV6() {
    const select = $('compGroupFilter');
    if (!select) return;

    const currentValue = select.value;

    select.innerHTML =
        '<option value="">Tất cả nhóm</option>' +
        competitionCategoryOptionsV6(currentValue);

    if (currentValue) select.value = currentValue;
}

/** Render criteria grouped under every active category, including #6. */
async function renderCompetitionCriteria() {
    const box = $('criteriaSettings');
    if (!box) return;

    await loadCompetitionCategoriesV6();

    const { data, error } = await sb
        .from('competition_criteria')
        .select('*')
        .order('sort_order', { ascending: true });

    if (error) {
        box.innerHTML = '<div class="mini">Không tải được tiêu chí.</div>';
        return;
    }

    box.innerHTML = '<div class="criteria-grid">' +
        getActiveCompetitionCategoriesV6().map(category => {
            const criteria = (data || []).filter(item =>
                String(item.category_id || item.group_name) ===
                String(category.id)
            );

            const cards = criteria.map(item => {
                const score = criteriaDefaultScoreV6(item);

                return (
                    '<div class="notice"><div><b>' + esc(item.name) +
                    '</b> <span class="mini">Mặc định ' +
                    (score > 0 ? '+' : '') + score +
                    '</span></div><div class="mini">' +
                    'Thang điểm: -5,-4,-3,-2,-1,+1,+2,+3,+4,+5' +
                    '</div><div class="actions">' +
                    '<button class="btn small" onclick="editCriteria(\'' +
                    item.id + '\')">Sửa</button>' +
                    '<button class="btn small" onclick="toggleCriteria(\'' +
                    item.id + '\',' + (item.active ? 'false' : 'true') +
                    ')">' + (item.active ? 'Tắt' : 'Bật') +
                    '</button></div></div>'
                );
            }).join('');

            return (
                '<div class="criteria-group"><h4>Nhóm ' +
                esc(category.id) + ': ' + esc(category.name) +
                '</h4>' +
                (cards || '<div class="mini">Chưa có tiêu chí.</div>') +
                '</div>'
            );
        }).join('') +
        '</div><button class="btn" onclick="addCriteria()">' +
        '+ Thêm tiêu chí</button>';
}

/** Edit a criterion and allow moving it to any active category. */
async function editCriteria(id) {
    const { data, error } = await sb
        .from('competition_criteria')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) {
        alert('Không tìm thấy tiêu chí.');
        return;
    }

    await loadCompetitionCategoriesV6();

    openModal(
        'Điều chỉnh tiêu chí thi đua',
        '<div class="field"><label>Tên tiêu chí</label>' +
        '<input id="crName" value="' + esc(data.name) + '"></div>' +
        '<div class="field"><label>Nhóm tiêu chí</label>' +
        '<select id="crGroup">' +
        competitionCategoryOptionsV6(data.category_id || data.group_name) +
        '</select></div>' +
        '<div class="field"><label>Mức điểm mặc định</label>' +
        '<select id="crPoints">' +
        scoreOptionsV6(criteriaDefaultScoreV6(data)) +
        '</select></div>' +
        '<button class="btn primary" onclick="saveCriteria(\'' +
        id + '\')">Lưu</button>'
    );
}

/** Add a criterion to any active category. */
async function addCriteria() {
    await loadCompetitionCategoriesV6();
    const categories = getActiveCompetitionCategoriesV6();

    if (!categories.length) {
        alert('Chưa có nhóm tiêu chí đang hoạt động.');
        return;
    }

    openModal(
        'Thêm tiêu chí thi đua',
        '<div class="field"><label>Tên tiêu chí</label>' +
        '<input id="crName"></div>' +
        '<div class="field"><label>Nhóm tiêu chí</label>' +
        '<select id="crGroup">' +
        competitionCategoryOptionsV6(categories[0].id) +
        '</select></div>' +
        '<div class="field"><label>Mức điểm mặc định</label>' +
        '<select id="crPoints">' + scoreOptionsV6(1) + '</select></div>' +
        '<button class="btn primary" onclick="createCriteria()">Thêm</button>'
    );
}

/** Save criterion changes using category_id as the relationship. */
async function saveCriteria(id) {
    const name = $('crName').value.trim();
    const points = Number($('crPoints').value);
    const categoryId = Number($('crGroup').value);

    if (!name || !V6_VALID_SCORES.includes(points)) {
        alert('Thông tin tiêu chí không hợp lệ.');
        return;
    }

    const { error } = await sb
        .from('competition_criteria')
        .update({
            name,
            points: Math.abs(points),
            type: points < 0 ? 'minus' : 'plus',
            category_id: categoryId,
            group_name: String(categoryId),
            default_score: points,
            updated_at: new Date().toISOString()
        })
        .eq('id', id);

    if (error) {
        alert(error.message);
        return;
    }

    closeModal();
    await renderCompetitionCriteria();
}

/** Create a criterion with the selected category and score. */
async function createCriteria() {
    const name = $('crName').value.trim();
    const points = Number($('crPoints').value);
    const categoryId = Number($('crGroup').value);

    if (!name || !V6_VALID_SCORES.includes(points)) {
        alert('Thông tin tiêu chí không hợp lệ.');
        return;
    }

    const { data: existing, error: existingError } = await sb
        .from('competition_criteria')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1);

    if (existingError) {
        alert('Không thể xác định thứ tự tiêu chí.');
        return;
    }

    const sortOrder = (existing?.[0]?.sort_order || 0) + 1;

    const { error } = await sb
        .from('competition_criteria')
        .insert({
            name,
            points: Math.abs(points),
            type: points < 0 ? 'minus' : 'plus',
            category_id: categoryId,
            group_name: String(categoryId),
            default_score: points,
            sort_order: sortOrder
        });

    if (error) {
        alert(error.message);
        return;
    }

    closeModal();
    await renderCompetitionCriteria();
}
