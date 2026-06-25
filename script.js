// ═══════════════════════════════════════════════════════════════════
// ✅ СОЗДАНИЕ / ОБНОВЛЕНИЕ ЗАКАЗА (с загрузкой файла)
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

            // Если файл загружен, добавляем его
            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                await pb.collection('orders').update(state.currentOrderId, formData);
            }
            
            // Обновляем остальные поля
            await pb.collection('orders').update(state.currentOrderId, updateData);

            const oldItems = await pb.collection('order_items').getList(1, 100, {
                filter: `order_id = "${state.currentOrderId}"`,
            });
            for (const item of oldItems.items) {
                await pb.collection('order_items').delete(item.id);
            }

            for (let i = 0; i < state.items.length; i++) {
                const item = state.items[i];
                await pb.collection('order_items').create({
                    order_id: state.currentOrderId,
                    mebel: item.name,
                    tkan: item.fabric,
                    cvet_opor: item.color,
                    otdelka: item.finish,
                    kolichestvo: item.quantity,
                    komplektnost: item.komplektnost || '',
                    kolichestvo_podushek: item.podushki || '',
                    nomer_pozicii: i + 1,
                });
            }

            showMessage(`✅ Заказ #${state.currentOrderId} обновлён!`, 'success');
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

            // Создаём заказ через FormData, чтобы прикрепить файл
            const formData = new FormData();
            formData.append('nomer_partii', nextOrderNumber);
            formData.append('menedzer', state.currentUser.record.name || state.currentUser.record.email);
            formData.append('menedzer_id', userId);
            formData.append('klient', clientName);
            formData.append('njna_razrabotka', needsDevelopment);
            formData.append('kommentarii', comment || '');
            formData.append('data_sdai', deliveryDate || null);
            formData.append('stats', 'новый');
            if (file) {
                formData.append('file', file);
            }

            const order = await pb.collection('orders').create(formData);

            for (let i = 0; i < state.items.length; i++) {
                const item = state.items[i];
                await pb.collection('order_items').create({
                    order_id: order.id,
                    mebel: item.name,
                    tkan: item.fabric,
                    cvet_opor: item.color,
                    otdelka: item.finish,
                    kolichestvo: item.quantity,
                    komplektnost: item.komplektnost || '',
                    kolichestvo_podushek: item.podushki || '',
                    nomer_pozicii: i + 1,
                });
            }

            showMessage(`✅ Заказ #${nextOrderNumber} успешно создан!`, 'success');
            clearOrderForm();
            document.querySelector('#tabNewOrder h2').textContent = '➕ Новый заказ';
            document.getElementById('createOrderBtn').textContent = '✅ Создать заказ';
            // Очищаем поле файла
            fileInput.value = '';
            loadMyOrders();
        }

    } catch (err) {
        console.error('Ошибка:', err);
        showMessage('❌ Ошибка: ' + (err.message || 'Неизвестная ошибка'), 'error');
    }
});
