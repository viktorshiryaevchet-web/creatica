// ═══════════════════════════════════════════════════════════════════
// 📦 ПОДКЛЮЧЕНИЕ К POCKETBASE (Столярный цех)
// ═══════════════════════════════════════════════════════════════════

const pb = new PocketBase('https://creatica.duckdns.org');
pb.autoCancellation(false);

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
// 🖥️ ЗАГРУЗКА ВСЕХ ПОЗИЦИЙ
// ═══════════════════════════════════════════════════════════════════

const loadAllItemsBtn = document.getElementById('loadAllItemsBtn');
const itemsList = document.getElementById('itemsList');

loadAllItemsBtn.addEventListener('click', async function() {
    itemsList.innerHTML = '<p class="empty-text">Загрузка...</p>';
    
    try {
        // 1. Получаем все заказы
        const orders = await pb.collection('orders').getList(1, 200, {
            sort: '+nomer_partii',
            expand: 'menedzer_id',
        });

        if (orders.items.length === 0) {
            itemsList.innerHTML = '<p class="empty-text">Нет заказов</p>';
            return;
        }

        // 2. Собираем все позиции из всех заказов
        let allItems = [];
        let orderCounter = 0;

        for (const order of orders.items) {
            orderCounter++;
            
            // Получаем позиции заказа
            const items = await pb.collection('order_items').getList(1, 100, {
                filter: `order_id = "${order.id}"`,
                sort: 'nomer_pozicii',
            });

            // Фильтруем подушки
            const filteredItems = items.items.filter(item => {
                const name = (item.mebel || '').toLowerCase();
                return !name.includes('подушк');
            });

            // Разворачиваем количество
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
                        quantity: 1,
                        deliveryDate: order.data_sdai ? new Date(order.data_sdai).toLocaleDateString() : 'не указана',
                        status: order.stats || 'новый',
                        orderId: order.id,
                        itemId: item.id,
                    });
                }
            });
        }

        if (allItems.length === 0) {
            itemsList.innerHTML = '<p class="empty-text">Нет позиций (все подушки)</p>';
            return;
        }

        // 3. Выводим список
        const statusMap = {
            'новый': { label: '🆕 Новый', class: 'new' },
            'в_столярке': { label: '🛠 В работе', class: 'active' },
            'чертеж_готов': { label: '📐 Чертёж готов', class: 'waiting' },
            'столярка_готова': { label: '✅ Готово', class: 'done' },
            'у_конструктора': { label: '↩️ У конструктора', class: 'constructor' },
        };

        let html = `
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

        itemsList.innerHTML = html;
        itemsList.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (err) {
        console.error('Ошибка загрузки позиций:', err);
        itemsList.innerHTML = `<p class="empty-text">❌ Ошибка загрузки: ${err.message || 'Неизвестная ошибка'}</p>`;
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
