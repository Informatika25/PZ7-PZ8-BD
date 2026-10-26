
const csrfToken = document.querySelector(
    "[name=csrfmiddlewaretoken]"
).value;

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
            ...(options.headers || {})
        },
        credentials: "same-origin"
    });

    let data = null;

    if (response.status !== 204) {
        data = await response.json().catch(() => null);
    }

    if (!response.ok) {
        const detail = data?.detail;

        let errorMessage = detail;

        if (!errorMessage && data) {
            errorMessage = Object.entries(data)
                .map(([field, errors]) => {
                    const fieldNames = {
                        title: "Название",
                        category: "Категория",
                        status: "Статус",
                        description: "Описание"
                    };

                    const fieldName = fieldNames[field] || field;
                    const errorText = Array.isArray(errors)
                        ? errors.join(" ")
                        : String(errors);

                    return `${fieldName}: ${errorText}`;
                })
                .join(" ");
        }

        throw new Error(
            errorMessage || "Ошибка выполнения запроса"
        );
    }

    return data;
}

const categorySelect = document.getElementById("category");
const form = document.getElementById("ticket-form");
const titleInput = document.getElementById("title");
const message = document.getElementById("message");

const list = document.getElementById("tickets-list");
const loading = document.getElementById("loading");
const filter = document.getElementById("status-filter");

function showMessage(text, isError = false) {
    message.textContent = text;
    message.className =
        "alert " + (isError ? "alert-danger" : "alert-success");
}

function getStatusLabel(status) {
    const labels = {
        new: "Новая",
        progress: "В работе",
        done: "Выполнена"
    };

    return labels[status] || status;
}

function getStatusClass(status) {
    const classes = {
        new: "bg-blue-lt",
        progress: "bg-yellow-lt",
        done: "bg-green-lt"
    };

    return classes[status] || "bg-secondary-lt";
}

// Допустимые переходы статусов по заданию
function getAvailableStatuses(status) {
    const nextStatuses = {
        new: [
            { value: "progress", label: "В работе" }
        ],
        progress: [
            { value: "done", label: "Выполнена" }
        ],
        done: []
    };

    return nextStatuses[status] || [];
}

async function loadCategories() {
    const categories = await apiRequest("/api/categories/");

    categorySelect.replaceChildren();

    for (const category of categories) {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = category.name;
        categorySelect.append(option);
    }
}

// Создание заявки
form.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
        await apiRequest("/api/tickets/", {
            method: "POST",
            body: JSON.stringify({
                title: titleInput.value.trim(),
                category: Number(categorySelect.value)
            })
        });

        titleInput.value = "";

        showMessage("Заявка успешно создана");

        await loadTickets();
    } catch (error) {
        showMessage(
            "Не удалось создать заявку: " + error.message,
            true
        );
    }
});

// Загрузка заявок
async function loadTickets() {
    loading.hidden = false;

    const params = new URLSearchParams();

    if (filter.value) {
        params.set("status", filter.value);
    }

    const query = params.toString();
    const url = "/api/tickets/" + (query ? "?" + query : "");

    try {
        const tickets = await apiRequest(url);

        list.replaceChildren();

        if (!Array.isArray(tickets) || tickets.length === 0) {
            const empty = document.createElement("p");
            empty.className = "text-secondary py-3";
            empty.textContent = "Заявки не найдены";
            list.append(empty);
            return;
        }

        for (const ticket of tickets) {
            // Строка заявки
            const row = document.createElement("div");
            row.className =
                "d-flex justify-content-between align-items-center " +
                "border-bottom py-3 gap-3";

            // Название и категория
            const info = document.createElement("div");
            info.className = "flex-fill";

            const title = document.createElement("div");
            title.className = "fw-bold";
            title.textContent = ticket.title;

            const category = document.createElement("div");
            category.className = "text-secondary small";
            category.textContent =
                "Категория: " +
                (ticket.category_name || "Не указана");

            info.append(title, category);

            // Правая часть строки
            const actions = document.createElement("div");
            actions.className =
                "d-flex align-items-center justify-content-end " +
                "gap-2 flex-wrap";

            // Текущий статус
            const status = document.createElement("span");
            status.className =
                "badge " + getStatusClass(ticket.status);
            status.textContent = getStatusLabel(ticket.status);

            // Выпадающий список допустимых статусов
            const availableStatuses =
                getAvailableStatuses(ticket.status);

            if (availableStatuses.length > 0) {
                const statusGroup = document.createElement("div");
                statusGroup.className = "d-flex gap-1";

                const statusSelect = document.createElement("select");
                statusSelect.className = "form-select form-select-sm";
                statusSelect.setAttribute(
                    "aria-label",
                    "Новый статус заявки"
                );

                const placeholder = document.createElement("option");
                placeholder.value = "";
                placeholder.textContent = "Выберите статус";
                placeholder.selected = true;
                statusSelect.append(placeholder);

                for (const item of availableStatuses) {
                    const option = document.createElement("option");
                    option.value = item.value;
                    option.textContent = item.label;
                    statusSelect.append(option);
                }

                const saveStatusButton =
                    document.createElement("button");

                saveStatusButton.type = "button";
                saveStatusButton.className =
                    "btn btn-outline-primary btn-sm";
                saveStatusButton.textContent = "Сохранить";

                saveStatusButton.addEventListener(
                    "click",
                    async () => {
                        const newStatus = statusSelect.value;

                        if (!newStatus) {
                            showMessage(
                                "Сначала выберите новый статус",
                                true
                            );
                            return;
                        }

                        saveStatusButton.disabled = true;

                        try {
                            await changeStatus(
                                ticket.id,
                                newStatus
                            );

                            showMessage(
                                "Статус заявки успешно изменён"
                            );
                        } catch (error) {
                            showMessage(
                                "Не удалось изменить статус: " +
                                error.message,
                                true
                            );
                        } finally {
                            saveStatusButton.disabled = false;
                        }
                    }
                );

                statusGroup.append(
                    statusSelect,
                    saveStatusButton
                );

                actions.append(status, statusGroup);
            } else {
                actions.append(status);
            }

            // Кнопка удаления
            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className =
                "btn btn-outline-danger btn-sm";
            deleteButton.textContent = "Удалить";

            deleteButton.addEventListener("click", async () => {
                deleteButton.disabled = true;

                try {
                    const deleted = await deleteTicket(
                        ticket.id,
                        ticket.title
                    );

                    if (deleted) {
                        showMessage("Заявка успешно удалена");
                    }
                } catch (error) {
                    showMessage(
                        "Не удалось удалить заявку: " +
                        error.message,
                        true
                    );
                } finally {
                    deleteButton.disabled = false;
                }
            });

            actions.append(deleteButton);

            row.append(info, actions);
            list.append(row);
        }
    } catch (error) {
        showMessage(
            "Не удалось загрузить заявки: " + error.message,
            true
        );
    } finally {
        loading.hidden = true;
    }
}

// Фильтрация по статусу
filter.addEventListener("change", loadTickets);

// Изменение статуса
async function changeStatus(ticketId, newStatus) {
    await apiRequest(`/api/tickets/${ticketId}/`, {
        method: "PATCH",
        body: JSON.stringify({
            status: newStatus
        })
    });

    await loadTickets();
}

// Удаление заявки с подтверждением
async function deleteTicket(ticketId, ticketTitle) {
    const confirmed = confirm(
        `Вы точно хотите удалить заявку «${ticketTitle}»?`
    );

    if (!confirmed) {
        return false;
    }

    await apiRequest(`/api/tickets/${ticketId}/`, {
        method: "DELETE"
    });

    await loadTickets();

    return true;
}

// Инициализация страницы
async function initialize() {
    try {
        await loadCategories();
        await loadTickets();
    } catch (error) {
        showMessage(
            "Ошибка загрузки страницы: " + error.message,
            true
        );
    }
}

initialize();
