// ═══════════════════════════════════════════════════════════════════
// 📦 ПОДКЛЮЧЕНИЕ К POCKETBASE (Столярный цех)
// ═══════════════════════════════════════════════════════════════════

const pb = new PocketBase('https://creatica.duckdns.org');
pb.autoCancellation(false);

// ═══════════════════════════════════════════════════════════════════
// 🧠 СОСТОЯНИЕ
// ═══════════════════════════════════════════════════════════════════

const state = {
    currentUser: null,
    searchQuery: '',
    partyFilter: '',
    showCompleted: false,
};

// ═══════════════════════════════════════════════════════════════════
// 🔐 АВТОРИЗАЦИЯ
// ═══════════════════════════════════════════════════════════════════

const authScreen = document.getElementById('authScreen');
const mainScreen = document.getElementById('mainScreen');
const loginBtn = document.getElementById('loginBtn');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginMessage = document.getElementById('loginMessage');
const logoutBtn = document.getElementById('logoutBtn');
const userNameDisplay = document.getElementById('userNameDisplay');

async function checkAuth() {
    if (pb.authStore.isValid) {
        await loadUserData();
        showMainScreen();
    } else {
        showAuthScreen();
    }
}

async function loadUserData() {
    try {
        state.currentUser = await pb.collection('users').authRefresh();
        userNameDisplay.textContent = state.currentUser.record?.name || state.currentUser.record?.email;
        loadAllTabs();
    } catch (err) {
        pb.authStore.clear();
        showAuthScreen();
    }
}

function showAuthScreen() {
    authScreen.style.display = 'block';
    mainScreen.style.display = 'none';
}

function showMainScreen() {
    authScreen.style.display = 'none';
    mainScreen.style.display = 'block';
}

loginBtn.addEventListener('click', async function() {
    const email = loginEmail.value.trim();
    const password = loginPassword.value.trim();

    if (!email || !password) {
        showLoginMessage('Введите email и пароль!', 'error');
        return;
    }

    try {
        await pb.collection('users').authWithPassword(email, password);
        await loadUserData();
        showMainScreen();
        showLoginMessage('✅ Вход выполнен!', 'success');
    } catch (err) {
        showLoginMessage('❌ Неверный email или пароль!', 'error');
    }
});

logoutBtn.addEventListener('click', function() {
    pb.authStore.clear();
    state.currentUser = null;
    showAuthScreen();
    loginMessage.textContent = '';
    loginMessage.style.display = 'none';
});

function showLoginMessage(text, type) {
    loginMessage.textContent = text;
    loginMessage.className = 'message ' + type;
    loginMessage.style.display = 'block';
}

// ═══════════════════════════════════════════════════════════════════
// 📑 ВКЛАДКИ
// ═══════════════════════════════════════════════════════════════════

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const tab = this.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).style.display = 'block';
        loadTab(tab);
    });
});

async function loadAllTabs() {
    await loadTab('new');
    await loadTab('active');
    await loadTab('development');
    await loadTab('completed');
}

// ═══════════════════════════════════════════════════════════════════
// 🔍 ПОИСК И ФИЛЬТРЫ
// ═══════════════════════════════════════════════════════════════════

const searchInput = document.getElementById('searchInput');
const partyFilter = document.getElementById('partyFilter');
const showCompletedCheckbox = document.getElementById('showCompleted');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

if (searchInput) {
    searchInput.addEventListener('input', function() {
        state.searchQuery = this.value.trim().toLowerCase();
        loadAllTabs();
    });
}

if (partyFilter) {
    partyFilter.addEventListener('input', function() {
        state.partyFilter = this.value.trim();
        loadAllTabs();
    });
}

if (showCompletedCheckbox) {
    showCompletedCheckbox.addEventListener('change', function() {
        state.showCompleted = this.checked;
        loadAllTabs();
    });
}

if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', function() {
        if (searchInput) searchInput.value = '';
        if (partyFilter) partyFilter.value = '';
        state.searchQuery = '';
        state.partyFilter = '';
        if (showCompletedCheckbox) showCompletedCheckbox.checked = false;
        state.showCompleted = false;
        loadAllTabs();
    });
}

// ═══════════════════════════════════════════════════════════════════
// 📦 ЗАГРУЗКА ЗАКАЗОВ ПО ВКЛАДКАМ
// ═══════════════════════════════════════════════════════════════════

async function loadTab(tab) {
    const container = document.getElementById(`ordersList${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    if (!container) return;
    container.innerHTML = '<p class="empty-text">Загрузка...</p>';

    let filter = '';
    let sort = '+data_sdai, +created';

    switch (tab) {
        case 'new':
            filter = `njna_razrabotka = false`;
            break;
        case 'active':
            filter = `stats = "в_столярке" || stats = "чертеж_готов"`;
            break;
        case 'development':
            filter = `njna_razrabotka = true`;
            break;
        case 'completed':
            filter = `stats = "столярка_готова"`;
            sort = '-data_sdai, -created';
            break;
        default:
            filter = '';
    }

    // Поиск по клиенту или номеру (упрощённый)
    if (state.searchQuery) {
        const searchFilter = `klient ~ "${state.searchQuery}" || nomer_partii ~ "${state.searchQuery}"`;
        filter = filter ? `(${filter}) && (${searchFilter})` : searchFilter;
    }

    // Фильтр по партии (упрощённый)
    if (state.partyFilter) {
        const partyFilterStr = `nomer_partii ~ "${state.partyFilter}"`;
        filter = filter ? `(${filter}) && (${partyFilterStr})` : partyFilterStr;
    }

    try {
        const result = await pb.collection('orders').getList(1, 200, {
            filter: filter,
            sort: sort,
            expand: 'menedzer_id',
        });

        if (result.items.length === 0) {
            container.innerHTML = '<p class="empty-text">Нет заказов</p>';
            return;
        }

        let html = '';
        for (const order of result.items) {
            const orderHtml = await renderOrderCard(order);
            html += orderHtml;
        }
        container.innerHTML = html;

        // Обработчики для смены статуса
        document.querySelectorAll(`#ordersList${tab.charAt(0).toUpperCase() + tab.slice(1)} .status-select`).forEach(select => {
            select.addEventListener('change', function(e) {
                e.stopPropagation();
                const orderId = this.dataset.id;
                const status = this.value;
                if (status) {
                    changeOrderStatus(orderId, status);
                }
            });
        });

        // Обработчики для раскрытия позиций
        document.querySelectorAll(`#ordersList${tab.charAt(0).toUpperCase() + tab.slice(1)} .order-card`).forEach(card => {
            card.addEventListener('click', function(e) {
                if (e.target.closest('.status-select')) return;
                const id = this.dataset.id;
                const itemsContainer = document.getElementById(`items-${id}`);
                if (itemsContainer) {
                    itemsContainer.classList.toggle('show');
                }
            });
        });

    } catch (err) {
        console.error(`Ошибка загрузки заказов (${tab}):`, err);
        container.innerHTML = '<p class="empty-text">Ошибка загрузки заказов</p>';
    }
}

// ═══════════════════════════════════════════════════════════════════
// 🖥️ ОТРИСОВКА КАРТОЧКИ ЗАКАЗА
// ═══════════════════════════════════════════════════════════════════

async function renderOrderCard(order) {
    const items = await pb.collection('order_items').getList(1, 100, {
        filter: `order_id = "${order.id}"`,
        sort: 'nomer_pozicii',
    });

    const filteredItems = items.items.filter(item => {
        const name = (item.mebel || '').toLowerCase();
        return !name.includes('подушк');
    });

    // Разворачиваем каждую позицию отдельно
    const expandedItems = [];
    filteredItems.forEach(item => {
        const count = item.kolichestvo || 1;
        for (let i = 0; i < count; i++) {
            expandedItems.push({
                ...item,
                individualNumber: i + 1,
                mebel: item.mebel || 'Без названия',
                tkan: item.tkan || '',
                cvet_opor: item.cvet_opor || '',
                otdelka: item.otdelka || '',
            });
        }
    });

    // Группировка для сводки
    const groups = {};
    expandedItems.forEach(item => {
        const key = item.mebel;
        if (!groups[key]) groups[key] = 0;
        groups[key]++;
    });

    let summaryHtml = Object.entries(groups)
        .map(([name, count]) => {
            const deliveryDate = order.data_sdai ? new Date(order.data_sdai).toLocaleDateString() : 'не указана';
            return `<div class="group-item">
                <span>${name}</span>
                <span><span class="count">${count}</span> шт. | 📅 ${deliveryDate}</span>
            </div>`;
        })
        .join('');

    if (!summaryHtml) summaryHtml = 'Нет позиций (все подушки)';

    // Список каждой позиции отдельно
    let itemsHtml = expandedItems.map((item, idx) => {
        return `
            <div class="item-row">
                <span class="item-name">${item.mebel}</span>
                <span class="item-detail">
                    ${item.tkan ? `Ткань: ${item.tkan}` : ''} 
                    ${item.cvet_opor ? `| Цвет опор: ${item.cvet_opor}` : ''} 
                    ${item.otdelka ? `| Отделка: ${item.otdelka}` : ''}
                </span>
            </div>
        `;
    }).join('');

    if (!itemsHtml) itemsHtml = 'Нет позиций';

    const statusMap = {
        'новый': { label: '🆕 Новый', class: 'new' },
        'в_столярке': { label: '🛠 В работе', class: 'active' },
        'чертеж_готов': { label: '📐 Чертёж готов', class: 'waiting' },
        'столярка_готова': { label: '✅ Готово', class: 'done' },
        'у_конструктора': { label: '↩️ У конструктора', class: 'constructor' },
    };
    const statusInfo = statusMap[order.stats] || { label: order.stats || 'новый', class: '' };

    const statusOptions = [
        { value: 'новый', label: '🆕 Новый' },
        { value: 'в_столярке', label: '🛠 Взять в работу' },
        { value: 'чертеж_готов', label: '📐 Чертёж готов' },
        { value: 'столярка_готова', label: '✅ Готово' },
        { value: 'у_конструктора', label: '↩️ Нет чертежа' },
    ];

    let statusSelectHtml = `
        <select class="status-select" data-id="${order.id}" style="padding:6px 12px; border-radius:8px; border:1px solid #ddd; font-size:13px; background:white; cursor:pointer;">
            <option value="">📌 Сменить статус...</option>
    `;
    statusOptions.forEach(opt => {
        const selected = opt.value === order.stats ? 'selected' : '';
        statusSelectHtml += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
    });
    statusSelectHtml += `</select>`;

    const deliveryDate = order.data_sdai ? new Date(order.data_sdai).toLocaleDateString() : 'не указана';
    const createdDate = new Date(order.created).toLocaleDateString();

    return `
        <div class="order-card" data-id="${order.id}" style="${order.stats === 'столярка_готова' ? 'border-left-color: #22c55e;' : ''}">
            <div class="order-header">
                <span class="order-number">Партия #${order.nomer_partii}</span>
                <span class="order-status ${statusInfo.class}">${statusInfo.label}</span>
            </div>
            <div class="order-client">👤 Клиент: ${order.klient || 'Не указан'}</div>
            <div class="order-meta">
                <span>📅 Сдача: ${deliveryDate}</span>
                <span>📅 Создан: ${createdDate}</span>
                <span>📦 Позиций: ${expandedItems.length}</span>
                ${order.njna_razrabotka ? ' | 🔨 Разработка' : ''}
            </div>
            <div class="order-items-group">
                📋 Сводка по позициям:<br>
                ${summaryHtml}
            </div>
            <div id="items-${order.id}" class="items-list">
                ${itemsHtml}
            </div>
            <div class="order-actions" style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; align-items:center;">
                ${statusSelectHtml}
            </div>
            <div class="order-date" style="margin-top:4px;">
                ${order.kommentarii ? `💬 ${order.kommentarii}` : ''}
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════════
// 📌 СМЕНА СТАТУСА ЗАКАЗА
// ═══════════════════════════════════════════════════════════════════

async function changeOrderStatus(orderId, newStatus) {
    if (!newStatus || !orderId) {
        showMessage('❌ Ошибка: не указан ID заказа или статус', 'error');
        return;
    }

    try {
        console.log(`🔄 Меняем статус заказа ${orderId} на "${newStatus}"`);
        
        await pb.collection('orders').update(orderId, {
            stats: newStatus,
        });
        
        showMessage(`✅ Статус заказа изменён на "${newStatus}"`, 'success');
        loadAllTabs();
    } catch (err) {
        console.error('Ошибка смены статуса:', err);
        showMessage('❌ Ошибка смены статуса: ' + (err.message || 'Неизвестная ошибка'), 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════
// 💬 СООБЩЕНИЯ
// ═══════════════════════════════════════════════════════════════════

function showMessage(text, type) {
    const el = document.getElementById('loginMessage');
    el.textContent = text;
    el.className = 'message ' + type;
    el.style.display = 'block';

    clearTimeout(window.messageTimeout);
    window.messageTimeout = setTimeout(() => {
        el.style.display = 'none';
    }, 5000);
}

// ═══════════════════════════════════════════════════════════════════
// 🚀 ЗАПУСК
// ═══════════════════════════════════════════════════════════════════

console.log('🚀 Столярный цех загружается...');
checkAuth();
