// ═══════════════════════════════════════════════════════════════════
// 📦 ПОДКЛЮЧЕНИЕ К POCKETBASE
// ═══════════════════════════════════════════════════════════════════

const pb = new PocketBase('https://creatica.duckdns.org');
pb.autoCancellation(false);

// ═══════════════════════════════════════════════════════════════════
// 🧠 СОСТОЯНИЕ
// ═══════════════════════════════════════════════════════════════════

const state = {
    currentUser: null,
    searchQuery: '',
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
const showCompletedCheckbox = document.getElementById('showCompleted');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

searchInput.addEventListener('input', function() {
    state.searchQuery = this.value.trim().toLowerCase();
    loadAllTabs();
});

showCompletedCheckbox.addEventListener('change', function() {
    state.showCompleted = this.checked;
    loadAllTabs();
});

resetFiltersBtn.addEventListener('click', function() {
    searchInput.value = '';
    state.searchQuery = '';
    showCompletedCheckbox.checked = false;
    state.showCompleted = false;
    loadAllTabs();
});

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
            filter = `stats = "Insuik"`;
            break;
        case 'active':
            filter = `stats = "в_столярке" || stats = "чертеж_готов"`;
            break;
        case 'development':
            filter = `stats = "у_конструктора" || нужна_разработка = true`;
            break;
        case 'completed':
            filter = `stats = "столярка_готова"`;
            sort = '-data_sdai, -created';
            break;
        default:
            filter = '';
    }

    // Поиск
    if (state.searchQuery) {
        const searchFilter = `(LOWER(klient) ~ "${state.searchQuery}" || LOWER(nomer_partii) ~ "${state.searchQuery}")`;
        filter = filter ? `(${filter}) && ${searchFilter}` : searchFilter;
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

        document.querySelectorAll(`#ordersList${tab.charAt(0).toUpperCase() + tab.slice(1)} .btn-status`).forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const orderId = this.dataset.id;
                const status = this.dataset.status;
                changeOrderStatus(orderId, status);
            });
        });

        document.querySelectorAll(`#ordersList${tab.charAt(0).toUpperCase() + tab.slice(1)} .order-card`).forEach(card => {
            card.addEventListener('click', function(e) {
                if (e.target.closest('.btn-status')) return;
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

    const groups = {};
    filteredItems.forEach(item => {
        const key = item.mebel || 'Без названия';
        if (!groups[key]) groups[key] = { count: 0, items: [] };
        groups[key].count += item.kolichestvo || 1;
        groups[key].items.push(item);
    });

    let summaryHtml = Object.entries(groups)
        .map(([name, data]) => {
            const deliveryDate = order.data_sdai ? new Date(order.data_sdai).toLocaleDateString() : 'не указана';
            return `<div class="group-item">
                <span>${name}</span>
                <span><span class="count">${data.count}</span> шт. | 📅 ${deliveryDate}</span>
            </div>`;
        })
        .join('');

    if (!summaryHtml) summaryHtml = 'Нет позиций (все подушки)';

    const statusMap = {
        'Insuik': { label: '🆕 Новый', class: 'insuik' },
        'в_столярке': { label: '🛠 В работе', class: 'active' },
        'чертеж_готов': { label: '📐 Чертёж готов', class: 'waiting' },
        'столярка_готова': { label: '✅ Готово', class: 'done' },
        'у_конструктора': { label: '↩️ У конструктора', class: 'constructor' },
    };
    const statusInfo = statusMap[order.stats] || { label: order.stats || 'новый', class: '' };

    let actionsHtml = '';
    if (order.stats === 'в_столярке' || order.stats === 'чертеж_готов' || order.stats === 'Insuik') {
        actionsHtml = `
            <button class="btn btn-success btn-sm btn-status" data-id="${order.id}" data-status="столярка_готова">✅ Готово</button>
            <button class="btn btn-danger btn-sm btn-status" data-id="${order.id}" data-status="у_конструктора">↩️ Нет чертежа</button>
        `;
    } else if (order.stats === 'столярка_готова') {
        actionsHtml = `<span style="color:#22c55e; font-weight:600;">✅ Завершён</span>`;
    } else if (order.stats === 'у_конструктора' || order.нужна_разработка) {
        actionsHtml = `<span style="color:#f59e0b; font-weight:600;">📐 В разработке</span>`;
    }

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
                <span>📦 Позиций: ${filteredItems.length}</span>
                ${order.нужна_разработка ? ' | 🔨 Разработка' : ''}
            </div>
            <div class="order-items-group">
                📋 Сводка по позициям:<br>
                ${summaryHtml}
            </div>
            <div id="items-${order.id}" class="items-list">
                ${filteredItems.map(item => `
                    <div class="item-row">
                        <span class="item-name">${item.mebel || 'Без названия'}</span>
                        <span class="item-detail">${item.tkan ? `Ткань: ${item.tkan}` : ''} ${item.cvet_opor ? `| Цвет опор: ${item.cvet_opor}` : ''} ${item.otdelka ? `| Отделка: ${item.otdelka}` : ''} | Количество: ${item.kolichestvo || 1}</span>
                    </div>
                `).join('')}
            </div>
            <div class="order-actions">
                ${actionsHtml}
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
    try {
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
