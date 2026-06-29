// ═══════════════════════════════════════════════════════════════════
// 📦 ПОДКЛЮЧЕНИЕ К POCKETBASE (Конструкторский отдел)
// ═══════════════════════════════════════════════════════════════════

const pb = new PocketBase('https://creatica.duckdns.org');
pb.autoCancellation(false);

// ═══════════════════════════════════════════════════════════════════
// 🎨 ПОДСВЕТКА ДАТЫ СДАЧИ
// ═══════════════════════════════════════════════════════════════════

function getDateColor(deliveryDate) {
    if (!deliveryDate) return '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const delivery = new Date(deliveryDate);
    delivery.setHours(0, 0, 0, 0);
    
    const diffDays = Math.ceil((delivery - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'date-overdue';
    if (diffDays <= 2) return 'date-urgent';
    if (diffDays <= 10) return 'date-warning';
    return 'date-ok';
}

// ═══════════════════════════════════════════════════════════════════
// 🧠 СОСТОЯНИЕ
// ═══════════════════════════════════════════════════════════════════

const state = {
    currentUser: null,
    searchQuery: '',
    furnitureFilter: '',
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
            await loadTab(activeTab.dataset.tab);
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
// 🔍 ПОИСК И ФИЛЬТРЫ
// ═══════════════════════════════════════════════════════════════════

const searchInput = document.getElementById('searchInput');
const furnitureFilter = document.getElementById('furnitureFilter');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

if (searchInput) {
    searchInput.addEventListener('input', function() {
        state.searchQuery = this.value.trim().toLowerCase();
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) loadTab(activeTab.dataset.tab);
    });
}

if (furnitureFilter) {
    furnitureFilter.addEventListener('change', function() {
        state.furnitureFilter = this.value;
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) loadTab(activeTab.dataset.tab);
    });
}

if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', function() {
        if (searchInput) searchInput.value = '';
        if (furnitureFilter) furnitureFilter.value = '';
        state.searchQuery = '';
        state.furnitureFilter = '';
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) loadTab(activeTab.dataset.tab);
    });
}

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
            sort: '+data_sdai, +created',
            expand: 'menedzer_id',
        });

        if (orders.items.length === 0) {
            container.innerHTML = '<p class="empty-text">Нет заказов</p>';
            return;
        }

        let allItems = [];

        for (let oi = 0; oi < orders.items.length; oi++) {
            const order = orders.items[oi];
            
            const items = await pb.collection('order_items').getList(1, 100, {
                filter: 'order_id = "' + order.id + '"',
                sort: 'nomer_pozicii',
            });

            const filteredItems = items.items.filter(function(item) {
                const name = (item.mebel || '').toLowerCase();
                return !name.includes('подушк');
            });

            for (let fi = 0; fi < filteredItems.length; fi++) {
                const item = filteredItems[fi];
                const units = await pb.collection('item_units').getList(1, 100, {
                    filter: 'order_item_id = "' + item.id + '"',
                    sort: 'number',
                });

                for (let ui = 0; ui < units.items.length; ui++) {
                    const unit = units.items[ui];
                    
                    allItems.push({
                        unitId: unit.id,
                        orderId: order.id,
                        orderNumber: order.nomer_partii,
                        fullNumber: order.nomer_partii + '/' + (ui + 1),
                        name: item.mebel || 'Без названия',
                        fabric: item.tkan || '',
                        color: item.cvet_opor || '',
                        finish: item.otdelka || '',
                        deliveryDate: order.data_sdai ? new Date(order.data_sdai).toLocaleDateString() : 'не указана',
                        deliveryDateRaw: order.data_sdai,
                        status: unit.status || 'новый',
                        hasFile: order.file ? true : false,
                        fileUrl: order.file ? pb.files.getURL(order, order.file) : null,
                        klient: order.klient || 'Не указан',
                        kommentarii: order.kommentarii || '',
                        orderItemId: item.id,
                    });
                }
            }
        }

        if (allItems.length === 0) {
            container.innerHTML = '<p class="empty-text">Нет позиций (все подушки)</p>';
            return;
        }

        let filteredItems = [];
        if (tab === 'active') {
            filteredItems = allItems.filter(function(item) {
                return item.status === 'у_конструктора';
            });
        } else if (tab === 'completed') {
            filteredItems = allItems.filter(function(item) {
                return item.status === 'чертеж_готов';
            });
        }

        if (state.furnitureFilter) {
            filteredItems = filteredItems.filter(function(item) {
                return item.name === state.furnitureFilter;
            });
        }

        if (state.searchQuery) {
            const lowerQuery = state.searchQuery;
            filteredItems = filteredItems.filter(function(item) {
                return item.name.toLowerCase().includes(lowerQuery) || 
                       String(item.orderNumber).includes(lowerQuery);
            });
        }

        filteredItems.sort(function(a, b) {
            if (!a.deliveryDateRaw) return 1;
            if (!b.deliveryDateRaw) return -1;
            return new Date(a.deliveryDateRaw) - new Date(b.deliveryDateRaw);
        });

        if (filteredItems.length === 0) {
            container.innerHTML = '<p class="empty-text">Нет позиций</p>';
            return;
        }

        const uniqueNames = [...new Set(filteredItems.map(function(item) { return item.name; }).filter(Boolean))].sort();
        const select = document.getElementById('furnitureFilter');
        if (select) {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Все изделия</option>';
            for (let i = 0; i < uniqueNames.length; i++) {
                const name = uniqueNames[i];
                const selected = name === currentValue ? 'selected' : '';
                select.innerHTML += '<option value="' + name + '" ' + selected + '>' + name + '</option>';
            }
        }

        const statusMap = {
            'у_конструктора': { label: '🛠 В работе', class: 'active' },
            'чертеж_готов': { label: '✅ Готово', class: 'done' },
        };

        let html = '<div class="all-items-list">';

        for (let i = 0; i < filteredItems.length; i++) {
            const item = filteredItems[i];
            const statusInfo = statusMap[item.status] || { label: item.status, class: '' };
            
            const dateColorClass = getDateColor(item.deliveryDateRaw);
            const deliveryDisplay = item.deliveryDate || 'не указана';
            
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

            let fileHtml = '';
            if (item.hasFile && item.fileUrl) {
                fileHtml = '<div class="order-file">📎 <a href="' + item.fileUrl + '" target="_blank" class="file-link">Скачать файл</a></div>';
            } else {
                fileHtml = '<div class="order-file" style="background: #f8f9fa; color: #999;">📎 Файл не приложен</div>';
            }

            let actionsHtml = '';
            if (item.status === 'у_конструктора') {
                actionsHtml = '<button class="btn btn-success btn-sm btn-status" data-unit-id="' + item.unitId + '" data-order-item-id="' + item.orderItemId + '" data-order-id="' + item.orderId + '" data-status="чертеж_готов">✅ Чертеж готов</button>';
            } else if (item.status === 'чертеж_готов') {
                actionsHtml = '<button class="btn btn-danger btn-sm btn-status" data-unit-id="' + item.unitId + '" data-order-item-id="' + item.orderItemId + '" data-order-id="' + item.orderId + '" data-status="у_конструктора">↩️ Вернуть в работу</button>';
            }

            html += '<div class="order-card" data-id="' + item.orderId + '">' +
                '<div class="order-header">' +
                    '<span class="order-number">' + item.fullNumber + '</span>' +
                    '<span class="order-status ' + statusInfo.class + '">' + statusInfo.label + '</span>' +
                '</div>' +
                '<div class="order-client">👤 Клиент: ' + item.klient + '</div>' +
                '<div class="order-meta">' +
                    '<span>📅 Сдача: <span class="' + dateColorClass + '">' + deliveryDisplay + '</span></span>' +
                    '<span>📦 ' + item.name + '</span>' +
                '</div>' +
                '<div class="order-details">' + (details || 'Нет деталей') + '</div>' +
                fileHtml +
                '<div class="order-actions">' + actionsHtml + '</div>' +
                '<div class="order-date">' + (item.kommentarii ? '💬 ' + item.kommentarii : '') + '</div>' +
            '</div>';
        }

        html += '</div>';
        container.innerHTML = html;

        const statusBtns = container.querySelectorAll('.btn-status');
        for (let i = 0; i < statusBtns.length; i++) {
            const btn = statusBtns[i];
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const unitId = this.dataset.unitId;
                const orderItemId = this.dataset.orderItemId;
                const orderId = this.dataset.orderId;
                const newStatus = this.dataset.status;
                if (newStatus) {
                    changeItemStatus(unitId, orderItemId, orderId, newStatus);
                }
            });
        }

    } catch (err) {
        console.error('Ошибка загрузки позиций (' + tab + '):', err);
        container.innerHTML = '<p class="empty-text">Ошибка загрузки позиций</p>';
    }
}

// ═══════════════════════════════════════════════════════════════════
// 📌 СМЕНА СТАТУСА У КОНКРЕТНОЙ ЕДИНИЦЫ
// ═══════════════════════════════════════════════════════════════════

async function changeItemStatus(unitId, orderItemId, orderId, newStatus) {
    if (!newStatus || !unitId) {
        showMessage('❌ Ошибка: не указан статус', 'error');
        return;
    }

    try {
        console.log('🔄 Меняем статус единицы ' + unitId + ' на "' + newStatus + '"');
        
        // 1. Меняем статус у конкретной единицы
        await pb.collection('item_units').update(unitId, {
            status: newStatus,
        });
        
        // 2. Если статус стал "чертеж_готов" — создаём новую единицу для столярного цеха
        if (newStatus === 'чертеж_готов') {
            // Создаём новую единицу в столярном цехе со статусом "новый"
            await pb.collection('item_units').create({
                order_item_id: orderItemId,
                status: 'новый',
                number: 1,
            });
            console.log('✅ Создана новая единица для столярного цеха');
        }
        
        // 3. Проверяем, все ли единицы в этом order_item имеют статус "чертеж_готов"
        const allUnits = await pb.collection('item_units').getList(1, 100, {
            filter: 'order_item_id = "' + orderItemId + '"',
        });
        
        const allReady = allUnits.items.every(function(unit) {
            return unit.status === 'чертеж_готов';
        });
        
        // 4. Если все единицы готовы, обновляем статус заказа
        if (allReady && allUnits.items.length > 0) {
            await pb.collection('orders').update(orderId, {
                stats: 'чертеж_готов',
            });
            console.log('✅ Статус заказа ' + orderId + ' обновлён на "чертеж_готов"');
        } else {
            // Если есть единицы в работе, статус заказа "у_конструктора"
            await pb.collection('orders').update(orderId, {
                stats: 'у_конструктора',
            });
        }
        
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

console.log('🚀 Конструкторский отдел загружается...');
checkAuth();
