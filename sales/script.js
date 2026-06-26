// ═══════════════════════════════════════════════════════════════════
// 📦 ПОДКЛЮЧЕНИЕ К POCKETBASE (Отдел продаж)
// ═══════════════════════════════════════════════════════════════════

const pb = new PocketBase('https://creatica.duckdns.org');
pb.autoCancellation(false);

// ═══════════════════════════════════════════════════════════════════
// 🧠 СОСТОЯНИЕ ПРИЛОЖЕНИЯ
// ═══════════════════════════════════════════════════════════════════

const state = {
    items: [],
    selectedFurniture: null,
    searchTimeout: null,
    catalog: [],
    currentUser: null,
    currentOrderId: null,
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
    loadCatalog();
    loadMyOrders();
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
// 📦 ЗАГРУЗКА СПРАВОЧНИКА
// ═══════════════════════════════════════════════════════════════════

async function loadCatalog() {
    try {
        const result = await pb.collection('katalog_mebeli').getFullList();
        state.catalog = result;
        console.log('✅ Загружено ' + state.catalog.length + ' позиций мебели');
    } catch (err) {
        console.error('Ошибка загрузки справочника:', err);
    }
}

// ═══════════════════════════════════════════════════════════════════
// 📦 ЗАГРУЗКА МОИХ ЗАКАЗОВ
// ═══════════════════════════════════════════════════════════════════

async function loadMyOrders() {
    const container = document.getElementById('ordersList');
    container.innerHTML = '<p class="empty-text">Загрузка...</p>';

    try {
        const orders = await pb.collection('orders').getList(1, 100, {
            filter: 'menedzer_id = "' + state.currentUser.record.id + '"',
            sort: '-created',
            expand: 'menedzer_id',
        });

        if (orders.items.length === 0) {
            container.innerHTML = '<p class="empty-text">У вас пока нет заказов</p>';
            return;
        }

        let html = '';
        for (const order of orders.items) {
            const statusColors = {
                'новый': '#4a90d9',
                'у_конструктора': '#f39c12',
                'чертеж_готов': '#f1c40f',
                'в_столярке': '#e67e22',
                'столярка_готова': '#2ecc71',
                'в_швейном': '#9b59b6',
                'швейный_готов': '#8e44ad',
                'в_малярном': '#3498db',
                'малярный_готов': '#2980b9',
                'на_обивку': '#1abc9c',
                'обивочный_готов': '#16a085',
                'на_отк': '#e74c3c',
                'отк_готов': '#27ae60',
                'завершен': '#2c3e50',
            };
            const statusColor = statusColors[order.stats] || '#666';

            html += '<div class="order-card" data-id="' + order.id + '">' +
                '<div class="order-header">' +
                    '<span class="order-number">Заказ #' + order.nomer_partii + '</span>' +
                    '<span class="order-status" style="background:' + statusColor + '20; color:' + statusColor + '; border:1px solid ' + statusColor + '40;">' +
                        (order.stats || 'новый') +
                    '</span>' +
                '</div>' +
                '<div class="order-client">👤 Клиент: ' + order.klient + '</div>' +
                '<div class="order-details">' +
                    '<span class="order-items-count" data-id="' + order.id + '">📦 Позиции: загрузка...</span>' +
                    (order.data_sdai ? ' | 📅 Сдача: ' + new Date(order.data_sdai).toLocaleDateString() : '') +
                    (order.kommentarii ? ' | 💬 ' + order.kommentarii : '') +
                '</div>' +
                '<div class="order-date">📅 Создан: ' + new Date(order.created).toLocaleString() + '</div>' +
                '<div style="display:flex; gap:8px; margin-top:8px;">' +
                    '<button class="btn btn-secondary" style="padding:4px 16px; font-size:13px;" data-id="' + order.id + '">✏️ Редактировать</button>' +
                    '<button class="btn btn-danger" style="padding:4px 12px; font-size:13px;" data-id="' + order.id + '">🗑️ Удалить</button>' +
                '</div>' +
            '</div>';
        }
        container.innerHTML = html;

        for (const order of orders.items) {
            try {
                const result = await pb.collection('order_items').getList(1, 1, {
                    filter: 'order_id = "' + order.id + '"',
                });
                const countEl = document.querySelector('.order-items-count[data-id="' + order.id + '"]');
                if (countEl) countEl.textContent = '📦 Позиций: ' + result.totalItems;
            } catch (e) {}
        }

        const editBtns = container.querySelectorAll('.btn-secondary');
        editBtns.forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const orderId = this.dataset.id;
                openOrderForEdit(orderId);
            });
        });

        const deleteBtns = container.querySelectorAll('.btn-danger');
        deleteBtns.forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const orderId = this.dataset.id;
                if (confirm('Вы уверены, что хотите удалить этот заказ?')) {
                    deleteOrder(orderId);
                }
            });
        });

        const cards = container.querySelectorAll('.order-card');
        cards.forEach(function(card) {
            card.addEventListener('click', function() {
                const orderId = this.dataset.id;
                openOrderForEdit(orderId);
            });
        });

    } catch (err) {
        console.error('Ошибка загрузки заказов:', err);
        container.innerHTML = '<p class="empty-text">Ошибка загрузки заказов</p>';
    }
}

// ═══════════════════════════════════════════════════════════════════
// 🗑️ УДАЛЕНИЕ ЗАКАЗА
// ═══════════════════════════════════════════════════════════════════

async function deleteOrder(orderId) {
    try {
        const items = await pb.collection('order_items').getList(1, 100, {
            filter: 'order_id = "' + orderId + '"',
        });
        for (const item of items.items) {
            await pb.collection('order_items').delete(item.id);
        }
        await pb.collection('orders').delete(orderId);
        showMessage('✅ Заказ успешно удалён!', 'success');
        loadMyOrders();
    } catch (err) {
        console.error('Ошибка при удалении заказа:', err);
        showMessage('❌ Ошибка при удалении заказа: ' + (err.message || 'Неизвестная ошибка'), 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════
// ✏️ ОТКРЫТИЕ ЗАКАЗА ДЛЯ РЕДАКТИРОВАНИЯ
// ═══════════════════════════════════════════════════════════════════

async function openOrderForEdit(orderId) {
    try {
        const order = await pb.collection('orders').getOne(orderId, {
            expand: 'menedzer_id',
        });

        const items = await pb.collection('order_items').getList(1, 100, {
            filter: 'order_id = "' + orderId + '"',
            sort: 'nomer_pozicii',
        });

        document.getElementById('clientName').value = order.klient || '';
        document.getElementById('deliveryDate').value = order.data_sdai || '';
        document.getElementById('orderComment').value = order.kommentarii || '';
        document.getElementById('needsDevelopment').checked = order.njna_razrabotka || false;

        state.items = items.items.map(function(item) {
            return {
                id: item.id,
                name: item.mebel || '',
                fabric: item.tkan || 'Не указана',
                color: item.cvet_opor || '',
                finish: item.otdelka || 'Не указана',
                quantity: 1, // при редактировании мы не знаем точное количество единиц
                komplektnost: item.komplektnost || '',
                podushki: item.kolichestvo_podushek || '',
            };
        });

        state.currentOrderId = orderId;
        renderItems();

        switchTab('newOrder');
        document.querySelector('#tabNewOrder h2').textContent = '✏️ Редактирование заказа #' + order.nomer_partii;
        document.getElementById('createOrderBtn').textContent = '💾 Сохранить изменения';

        document.getElementById('furnitureSearch').value = '';
        document.getElementById('furnitureManual').value = '';
        document.getElementById('fabric').value = '';
        document.getElementById('colorOpor').value = '';
        document.getElementById('finish').value = '';
        document.getElementById('quantity').value = 1;
        document.getElementById('komplektnost').value = '';
        document.getElementById('podushki').value = '';
        state.selectedFurniture = null;

        showMessage('📝 Заказ #' + order.nomer_partii + ' открыт для редактирования. Позиций: ' + state.items.length, 'info');

    } catch (err) {
        console.error('Ошибка загрузки заказа:', err);
        showMessage('❌ Ошибка загрузки заказа: ' + (err.message || 'Неизвестная ошибка'), 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════
// 📑 ВКЛАДКИ
// ═══════════════════════════════════════════════════════════════════

document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        const tab = this.dataset.tab;
        switchTab(tab);
    });
});

function switchTab(tab) {
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(function(b) { b.classList.remove('active'); });
    document.querySelector('.tab-btn[data-tab="' + tab + '"]').classList.add('active');

    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(function(c) { c.style.display = 'none'; });

    if (tab === 'myOrders') {
        document.getElementById('tabMyOrders').style.display = 'block';
        loadMyOrders();
    } else if (tab === 'newOrder') {
        document.getElementById('tabNewOrder').style.display = 'block';
        if (!state.currentOrderId) {
            document.querySelector('#tabNewOrder h2').textContent = '➕ Новый заказ';
            document.getElementById('createOrderBtn').textContent = '✅ Создать заказ';
            clearOrderForm();
        }
    }
}

function clearOrderForm() {
    document.getElementById('clientName').value = '';
    document.getElementById('deliveryDate').value = '';
    document.getElementById('orderComment').value = '';
    document.getElementById('needsDevelopment').checked = false;
    state.items = [];
    state.currentOrderId = null;
    renderItems();
}

// ═══════════════════════════════════════════════════════════════════
// 🔄 ПЕРЕКЛЮЧЕНИЕ МЕЖДУ РЕЖИМАМИ ВЫБОРА МЕБЕЛИ
// ═══════════════════════════════════════════════════════════════════

const needsDevelopmentCheckbox = document.getElementById('needsDevelopment');
const furnitureSearch = document.getElementById('furnitureSearch');
const furnitureManual = document.getElementById('furnitureManual');
const suggestionsEl = document.getElementById('suggestions');

needsDevelopmentCheckbox.addEventListener('change', function() {
    if (this.checked) {
        furnitureSearch.style.display = 'none';
        furnitureManual.style.display = 'block';
        furnitureManual.value = '';
        suggestionsEl.classList.remove('show');
        state.selectedFurniture = null;
    } else {
        furnitureSearch.style.display = 'block';
        furnitureManual.style.display = 'none';
        furnitureSearch.value = '';
        suggestionsEl.classList.remove('show');
        state.selectedFurniture = null;
    }
});

// ═══════════════════════════════════════════════════════════════════
// 🔍 ПОИСК МЕБЕЛИ
// ═══════════════════════════════════════════════════════════════════

const searchInput = document.getElementById('furnitureSearch');

searchInput.addEventListener('input', function() {
    const query = this.value.trim();

    if (query.length < 2) {
        suggestionsEl.classList.remove('show');
        return;
    }

    clearTimeout(state.searchTimeout);
    state.searchTimeout = setTimeout(function() {
        try {
            const lowerQuery = query.toLowerCase();
            const results = state.catalog.filter(function(item) {
                const polnoe = (item.polnoe_nazvanie || '').toLowerCase();
                const nazvanie = (item.nazvanie || '').toLowerCase();
                return polnoe.includes(lowerQuery) || nazvanie.includes(lowerQuery);
            }).slice(0, 50);

            if (results.length === 0) {
                suggestionsEl.innerHTML = '<div class="suggestion-item" style="color:#999;">Ничего не найдено</div>';
            } else {
                let html = '';
                results.forEach(function(item) {
                    html += '<div class="suggestion-item" data-id="' + item.id + '">' +
                        '<div class="suggestion-title">' + (item.polnoe_nazvanie || item.nazvanie) + '</div>' +
                        '<div class="suggestion-desc">' + (item.modifikacij || '') + '</div>' +
                    '</div>';
                });
                suggestionsEl.innerHTML = html;

                const items = suggestionsEl.querySelectorAll('.suggestion-item[data-id]');
                items.forEach(function(el) {
                    el.addEventListener('click', function() {
                        const id = this.dataset.id;
                        const item = results.find(function(i) { return i.id === id; });
                        if (item) selectFurniture(item);
                    });
                });
            }
            suggestionsEl.classList.add('show');
        } catch (err) {
            console.error('Ошибка поиска:', err);
        }
    }, 200);
});

document.addEventListener('click', function(e) {
    if (!e.target.closest('.form-group')) {
        suggestionsEl.classList.remove('show');
    }
});

function selectFurniture(item) {
    state.selectedFurniture = item;
    searchInput.value = item.polnoe_nazvanie || item.nazvanie;
    suggestionsEl.classList.remove('show');
}

// ═══════════════════════════════════════════════════════════════════
// ➕ ДОБАВЛЕНИЕ ПОЗИЦИИ
// ═══════════════════════════════════════════════════════════════════

document.getElementById('addItemBtn').addEventListener('click', function() {
    const isDevelopment = document.getElementById('needsDevelopment').checked;
    let furnitureName = '';

    if (isDevelopment) {
        furnitureName = document.getElementById('furnitureManual').value.trim();
        if (!furnitureName) {
            alert('Введите название мебели вручную!');
            return;
        }
    } else {
        const selected = state.selectedFurniture;
        if (!selected) {
            alert('Сначала выберите мебель из справочника!');
            return;
        }
        furnitureName = selected.polnoe_nazvanie || selected.nazvanie;
    }

    const fabric = document.getElementById('fabric').value.trim() || 'Не указана';
    const colorOpor = document.getElementById('colorOpor').value.trim() || 'Не указан';
    const finish = document.getElementById('finish').value.trim() || 'Не указана';
    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    const komplektnost = document.getElementById('komplektnost').value.trim() || '';
    const podushki = document.getElementById('podushki').value.trim() || '';

    state.items.push({
        name: furnitureName,
        fabric: fabric,
        color: colorOpor,
        finish: finish,
        quantity: quantity,
        komplektnost: komplektnost,
        podushki: podushki,
        isDevelopment: isDevelopment,
    });

    if (isDevelopment) {
        document.getElementById('furnitureManual').value = '';
    } else {
        document.getElementById('furnitureSearch').value = '';
        state.selectedFurniture = null;
    }
    document.getElementById('fabric').value = '';
    document.getElementById('colorOpor').value = '';
    document.getElementById('finish').value = '';
    document.getElementById('quantity').value = 1;
    document.getElementById('komplektnost').value = '';
    document.getElementById('podushki').value = '';

    renderItems();
});

// ═══════════════════════════════════════════════════════════════════
// 🖥️ ОТОБРАЖЕНИЕ ПОЗИЦИЙ
// ═══════════════════════════════════════════════════════════════════

function renderItems() {
    const container = document.getElementById('itemsList');
    if (state.items.length === 0) {
        container.innerHTML = '<p class="empty-text">Нет добавленных позиций</p>';
        return;
    }

    let html = '';
    state.items.forEach(function(item, index) {
        let details = 'Ткань: ' + item.fabric + ' | Цвет опор: ' + item.color + ' | Отделка: ' + item.finish + ' | Количество: ' + item.quantity;
        if (item.komplektnost) details += ' | Комплектность: ' + item.komplektnost;
        if (item.podushki) details += ' | Подушки: ' + item.podushki;

        html += '<div class="item-row">' +
            '<div class="item-info">' +
                '<div class="item-name">' + item.name + '</div>' +
                '<div class="item-detail">' + details + '</div>' +
            '</div>' +
            '<div style="display:flex; gap:6px;">' +
                '<button class="btn btn-secondary" style="padding:4px 10px; font-size:13px;" data-index="' + index + '" data-action="edit">✏️</button>' +
                '<button class="btn btn-danger" data-index="' + index + '" data-action="delete">✕</button>' +
            '</div>' +
        '</div>';
    });
    container.innerHTML = html;

    const deleteBtns = container.querySelectorAll('.btn-danger');
    deleteBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            state.items.splice(index, 1);
            renderItems();
        });
    });

    const editBtns = container.querySelectorAll('.btn-secondary');
    editBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            editItem(index);
        });
    });
}

// ═══════════════════════════════════════════════════════════════════
// ✏️ РЕДАКТИРОВАНИЕ ПОЗИЦИИ
// ═══════════════════════════════════════════════════════════════════

function editItem(index) {
    const item = state.items[index];
    if (!item) return;

    document.getElementById('furnitureSearch').value = item.name;
    document.getElementById('fabric').value = item.fabric !== 'Не указана' ? item.fabric : '';
    document.getElementById('colorOpor').value = item.color !== 'Не указан' ? item.color : '';
    document.getElementById('finish').value = item.finish !== 'Не указана' ? item.finish : '';
    document.getElementById('quantity').value = item.quantity;
    document.getElementById('komplektnost').value = item.komplektnost || '';
    document.getElementById('podushki').value = item.podushki || '';

    const found = state.catalog.find(function(c) {
        return c.polnoe_nazvanie === item.name || c.nazvanie === item.name;
    });
    if (found) {
        state.selectedFurniture = found;
    }

    state.items.splice(index, 1);
    renderItems();

    showMessage('✏️ Редактируйте позицию и нажмите "Добавить позицию" для сохранения', 'info');
}

// ═══════════════════════════════════════════════════════════════════
// ✅ СОЗДАНИЕ / ОБНОВЛЕНИЕ ЗАКАЗА
// ═══════════════════════════════════════════════════════════════════

document.getElementById('createOrderBtn').addEventListener('click', async function() {
    const clientName = document.getElementById('clientName').value.trim();
    const deliveryDate = document.getElementById('deliveryDate').value;
    const comment = document.getElementById('orderComment').value.trim();
    const needsDevelopment = document.getElementById('needsDevelopment').checked;
    const fileInput = document.getElementById('orderFile');
    const file = fileInput.files[0];

    if (!clientName) {
        showMessage('Введите ФИО клиента!', 'error');
        return;
    }

    if (state.items.length === 0) {
        showMessage('Добавьте хотя бы одну позицию в заказ!', 'error');
        return;
    }

    try {
        const userId = state.currentUser.record.id;

        if (state.currentOrderId) {
            // ✏️ РЕДАКТИРОВАНИЕ
            const updateData = {
                klient: clientName,
                data_sdai: deliveryDate || null,
                kommentarii: comment || '',
                njna_razrabotka: needsDevelopment,
                stats: 'новый',
            };

            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                await pb.collection('orders').update(state.currentOrderId, formData);
            }

            await pb.collection('orders').update(state.currentOrderId, updateData);

            const oldItems = await pb.collection('order_items').getList(1, 100, {
                filter: 'order_id = "' + state.currentOrderId + '"',
            });
            for (const item of oldItems.items) {
                await pb.collection('order_items').delete(item.id);
            }

            for (let i = 0; i < state.items.length; i++) {
                const item = state.items[i];
                const orderItem = await pb.collection('order_items').create({
                    order_id: state.currentOrderId,
                    mebel: item.name,
                    tkan: item.fabric,
                    cvet_opor: item.color,
                    otdelka: item.finish,
                    komplektnost: item.komplektnost || '',
                    kolichestvo_podushek: item.podushki || '',
                    nomer_pozicii: i + 1,
                });

                for (let j = 0; j < item.quantity; j++) {
                    await pb.collection('item_units').create({
                        order_item_id: orderItem.id,
                        status: 'новый',
                        number: j + 1,
                    });
                }
            }

            showMessage('✅ Заказ #' + state.currentOrderId + ' обновлён!', 'success');
            state.currentOrderId = null;
            switchTab('myOrders');

        } else {
            // ✅ СОЗДАНИЕ НОВОГО ЗАКАЗА
            const allOrders = await pb.collection('orders').getList(1, 1, {
                sort: '-created',
            });

            let nextOrderNumber = 1;
            if (allOrders.items.length > 0) {
                const lastOrder = allOrders.items[0];
                const lastNumber = parseInt(lastOrder.nomer_partii);
                if (!isNaN(lastNumber)) {
                    nextOrderNumber = lastNumber + 1;
                }
            }

            const formData = new FormData();
            formData.append('nomer_partii', nextOrderNumber);
            formData.append('menedzer', state.currentUser.record.name || state.currentUser.record.email);
            formData.append('menedzer_id', userId);
            formData.append('klient', clientName);
            formData.append('njna_razrabotka', needsDevelopment);
            formData.append('kommentarii', comment || '');
            formData.append('data_sdai', deliveryDate || null);
            formData.append('stats', needsDevelopment ? 'у_конструктора' : 'новый');
            if (file) {
                formData.append('file', file);
            }

            const order = await pb.collection('orders').create(formData);

            for (let i = 0; i < state.items.length; i++) {
                const item = state.items[i];
                const orderItem = await pb.collection('order_items').create({
                    order_id: order.id,
                    mebel: item.name,
                    tkan: item.fabric,
                    cvet_opor: item.color,
                    otdelka: item.finish,
                    komplektnost: item.komplektnost || '',
                    kolichestvo_podushek: item.podushki || '',
                    nomer_pozicii: i + 1,
                });

                for (let j = 0; j < item.quantity; j++) {
                    await pb.collection('item_units').create({
                        order_item_id: orderItem.id,
                        status: 'новый',
                        number: j + 1,
                    });
                }
            }

            showMessage('✅ Заказ #' + nextOrderNumber + ' успешно создан!', 'success');
            clearOrderForm();
            document.querySelector('#tabNewOrder h2').textContent = '➕ Новый заказ';
            document.getElementById('createOrderBtn').textContent = '✅ Создать заказ';
            fileInput.value = '';
            loadMyOrders();
        }

    } catch (err) {
        console.error('Ошибка:', err);
        showMessage('❌ Ошибка: ' + (err.message || 'Неизвестная ошибка'), 'error');
    }
});

// ═══════════════════════════════════════════════════════════════════
// 💬 СООБЩЕНИЯ
// ═══════════════════════════════════════════════════════════════════

function showMessage(text, type) {
    const el = document.getElementById('resultMessage');
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

console.log('🚀 Интерфейс отдела продаж загружен...');
checkAuth();
