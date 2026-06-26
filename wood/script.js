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
    filterText: '',
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
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
            loadTab(activeTab.dataset.tab);
        }
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

document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        const tab = this.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(function(b) {
            b.classList.remove('active');
        });
        this.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(function(c) {
            c.style.display = 'none';
        });
        const content = document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1));
        if (content) {
            content.style.display = 'block';
        }
        loadTab(tab);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 📦 ЗАГРУЗКА ПОЗИЦИЙ ПО ВКЛАДКАМ
// ═══════════════════════════════════════════════════════════════════

async function loadTab(tab) {
    const containerId = 'ordersList' + tab.charAt(0).toUpperCase() + tab.slice(1);
    const container = document.getElementById(containerId);
    if (!container) return;
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

        for (const order of orders.items) {
            const items = await pb.collection('order_items').getList(1, 100, {
                filter: 'order_id = "' + order.id + '"',
                sort: 'nomer_pozicii',
            });

            const filteredItems = items.items.filter(function(item) {
                const name = (item.mebel || '').toLowerCase();
                return !name.includes('подушк');
            });

            let positionCounter = 0;
            for (const item of filteredItems) {
                // Получаем единицы из item_units
                const units = await pb.collection('item_units').getList(1, 100, {
                    filter: 'order_item_id = "' + item.id + '"',
                    sort: 'number',
                });

                for (const unit of units.items) {
                    positionCounter++;
                    allItems.push({
                        unitId: unit.id,
                        orderId: order.id,
                        orderNumber: order.nomer_partii,
                        positionNumber: positionCounter,
                        fullNumber: order.nomer_partii + '/' + positionCounter,
                        name: item.mebel || 'Без названия',
                        fabric: item.tkan || '',
                        color: item.cvet_opor || '',
                        finish: item.otdelka || '',
                        deliveryDate: order.data_sdai ? new Date(order.data_sdai).toLocaleDateString() : 'не указана',
                        status: unit.status || 'новый',
                        isDevelopment: order.njna_razrabotka || false,
                    });
                }
            }
        }

        if (allItems.length === 0) {
            container.innerHTML = '<p class="empty-text">Нет позиций (все подушки)</p>';
            return;
        }

        let filteredItems = [];
        if (tab === 'all') {
            filteredItems = allItems;
        } else if (tab === 'development') {
            filteredItems = allItems.filter(function(item) {
                return item.status === 'у_конструктора';
            });
        } else if (tab === 'active') {
            filteredItems = allItems.filter(function(item) {
                return item.status === 'в_столярке';
            });
        } else if (tab === 'completed') {
            filteredItems = allItems.filter(function(item) {
                return item.status === 'столярка_готова';
            });
        }

        if (state.filterText && tab === 'all') {
            const lowerFilter = state.filterText.toLowerCase();
            filteredItems = filteredItems.filter(function(item) {
                return item.name.toLowerCase().includes(lowerFilter);
            });
        }

        if (filteredItems.length === 0) {
            container.innerHTML = '<p class="empty-text">Нет позиций</p>';
            return;
        }

        const statusMap = {
            'новый': { label: '🆕 Новый', class: 'new' },
            'в_столярке': { label: '🛠 В работе', class: 'active' },
            'столярка_готова': { label: '✅ Готово', class: 'done' },
            'у_конструктора': { label: '↩️ У конструктора', class: 'constructor' },
        };

        const statusOptions = [
            { value: 'новый', label: '🆕 Новый' },
            { value: 'у_конструктора', label: '↩️ У конструктора' },
            { value: 'в_столярке', label: '🛠 Взять в работу' },
            { value: 'столярка_готова', label: '✅ Готово' },
        ];

        let filterHtml = '';
        if (tab === 'all') {
            filterHtml = `
                <div class="filter-container">
                    <input type="text" id="allFilterInput" placeholder="🔍 Фильтр по названию мебели..." value="${state.filterText}">
                </div>
            `;
        }

        let html = filterHtml + '<div class="all-items-list">' +
            '<div class="list-header">' +
                '<span class="item-number">№</span>' +
                '<span class="item-name">Наименование</span>' +
                '<span class="item-detail">Детали | 📅 Сдача | Статус</span>' +
            '</div>';

        filteredItems.forEach(function(item) {
            const statusInfo = statusMap[item.status] || { label: item.status, class: '' };
            let details = '';
            if (item.fabric) details += 'Ткань: ' + item.fabric;
            if (item.color) {
                if (details) details += ' | ';
                details += 'Цвет опор: ' + item.color;
            }
            if (item.finish) {
                if (details) details += ' | ';
                details += 'Отделка: ' + item.finish;
            }

            let statusSelectHtml = '<select class="status-select" data-unit-id="' + item.unitId + '">';
            statusOptions.forEach(function(opt) {
                const selected = opt.value === item.status ? 'selected' : '';
                statusSelectHtml += '<option value="' + opt.value + '" ' + selected + '>' + opt.label + '</option>';
            });
            statusSelectHtml += '</select>';

            html += '<div class="item-row">' +
                '<span class="item-number">' + item.fullNumber + '</span>' +
                '<span class="item-name">' + item.name + '</span>' +
                '<span class="item-detail">' +
                    (details ? details + ' | ' : '') + '📅 ' + item.deliveryDate +
                    ' ' + statusSelectHtml +
                '</span>' +
            '</div>';
        });

        html += '</div>';
        container.innerHTML = html;

        const filterInput = document.getElementById('allFilterInput');
        if (filterInput) {
            filterInput.addEventListener('input', function() {
                state.filterText = this.value.trim();
                loadTab('all');
            });
        }

        const selects = container.querySelectorAll('.status-select');
        selects.forEach(function(select) {
            select.addEventListener('change', function(e) {
                e.stopPropagation();
                const unitId = this.dataset.unitId;
                const newStatus = this.value;
                if (newStatus) {
                    changeItemStatus(unitId, newStatus);
                }
            });
        });

    } catch (err) {
        console.error('Ошибка загрузки позиций (' + tab + '):', err);
        container.innerHTML = '<p class="empty-text">Ошибка загрузки позиций</p>';
    }
}

// ═══════════════════════════════════════════════════════════════════
// 📌 СМЕНА СТАТУСА У КОНКРЕТНОЙ ЕДИНИЦЫ
// ═══════════════════════════════════════════════════════════════════

async function changeItemStatus(unitId, newStatus) {
    if (!newStatus || !unitId) {
        showMessage('❌ Ошибка: не указан статус', 'error');
        return;
    }

    try {
        console.log('🔄 Меняем статус единицы ' + unitId + ' на "' + newStatus + '"');
        
        await pb.collection('item_units').update(unitId, {
            status: newStatus,
        });
        
        showMessage('✅ Статус позиции изменён на "' + newStatus + '"', 'success');
        
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
            loadTab(activeTab.dataset.tab);
        }
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
    window.messageTimeout = setTimeout(function() {
        el.style.display = 'none';
    }, 5000);
}

// ═══════════════════════════════════════════════════════════════════
// 🚀 ЗАПУСК
// ═══════════════════════════════════════════════════════════════════

console.log('🚀 Столярный цех загружается...');
checkAuth();
