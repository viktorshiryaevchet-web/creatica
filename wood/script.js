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
        document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).style.display = 'block');
        
        if (tab === 'all') {
            // Вкладка "Все позиции" — загружаем по кнопке
        } else {
            loadTab(tab);
        }
    });
});

async function loadAllTabs() {
    await loadTab('new');
    await loadTab('active');
    await loadTab('development');
    await loadTab('completed');
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
            filter = `stats = "новый"`;
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

    // Поиск по клиенту или номеру
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

    const groups = {};
    filteredItems.forEach(item => {
        const key = item.mebel || 'Без названия';
        if (!groups[key]) groups[key] = 0;
        groups[key] += item.kolichestvo || 1;
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
        <select class="status-select" data-id="${order.id}">
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
                <span>📦 Позиций: ${filteredItems.length}</span>
                ${order.njna_razrabotka ? ' | 🔨 Разработка' : ''}
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
// 📋 ВСЕ ПОЗИЦИИ (ВКЛАДКА)
// ═══════════════════════════════════════════════════════════════════

document.getElementById('loadAllItemsBtn').addEventListener('click', async function() {
    const container = document.getElementById('ordersListAll');
    container.innerHTML = '<p class="empty-text">Загрузка...</p>';
    
    try {
        const orders = await pb.collection('orders').getList(1, 200, {
            sort: '+nomer_partii',
            expand: 'menedzer_id',
        });

        if (orders.items.length === 0) {
            container.innerHTML = '<p class="empty-text">Нет заказов</p>';
            return;
        }

        let allItems = [];
        let orderCounter = 0;

        for (const order of orders.items) {
            orderCounter++;
            
            const items = await pb.collection('order_items').getList(1, 100, {
                filter: `order_id = "${order.id}"`,
                sort: 'nomer_pozicii',
            });

            const filteredItems = items.items.filter(item => {
                const name = (item.mebel || '').toLowerCase();
                return !name.includes('подушк');
            });

            let positionCounter = 0;
            filteredItems.forEach(item => {
                const count = item.kolichestvo || 1;
                for (let i = 0; i < count; i++) {
                    positionCounter++;
                    allItems.push({
                        orderNumber: order.nomer_partii,
                        positionNumber: positionCounter,
                        fullNumber: `${order.nomer_partii}/${positionCounter}`,
                        name: item.mebel || 'Без названия',
                        fabric: item.tkan || '',
                        color: item.cvet_opor || '',
                        finish: item.otdelka || '',
                        deliveryDate: order.data_sdai ? new Date(order.data_sdai).toLocaleDateString() : 'не указана',
                        status: order.stats || 'новый',
                    });
                }
            });
        }

        if (allItems.length === 0) {
            container.innerHTML = '<p class="empty-text">Нет позиций (все подушки)</p>';
            return;
        }

        const statusMap = {
            'новый': { label: '🆕 Новый', class: 'new' },
            'в_столярке': { label: '🛠 В работе', class: 'active' },
            'чертеж_готов': { label: '📐 Чертёж готов', class: 'waiting' },
            'столярка_готова': { label: '✅ Готово', class: 'done' },
            'у_конструктора': { label: '↩️ У конструктора', class: 'constructor' },
        };

        let html = `
            <div class="all-items-list">
                <div class="list-header">
                    <span class="item-number">№</span>
                    <span class="item-name">Наименование</span>
                    <span class="item-detail">Детали | 📅 Сдача | Статус</span>
                </div>
        `;

        allItems.forEach(item => {
            const statusInfo = statusMap[item.status] || { label: item.status, class: '' };
            const details = [
                item.fabric ? `Ткань: ${item.fabric}` : '',
                item.color ? `Цвет опор: ${item.color}` : '',
                item.finish ? `Отделка: ${item.finish}` : '',
            ].filter(Boolean).join(' | ');

            html += `
                <div class="item-row">
                    <span class="item-number">${item.fullNumber}</span>
                    <span class="item-name">${item.name}</span>
                    <span class="item-detail">
                        ${details ? details + ' | ' : ''}📅 ${item.deliveryDate}
                        <span class="item-status ${statusInfo.class}">${statusInfo.label}</span>
                    </span>
                </div>
            `;
        });

        html += `</div>`;
        container.innerHTML = html;

    } catch (err) {
        console.error('Ошибка загрузки позиций:', err);
        container.innerHTML = `<p class="empty-text">❌ Ошибка загрузки: ${err.message || 'Неизвестная ошибка'}</p>`;
    }
});

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
