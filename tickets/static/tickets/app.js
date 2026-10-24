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

        throw new Error(
            detail ||
            (data ? JSON.stringify(data) : "Ошибка выполнения запроса")
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
            const row = document.createElement("div");
            row.className =
                "d-flex justify-content-between align-items-center " +
                "border-bottom py-3 gap-3";

            const info = document.createElement("div");
            info.className = "flex-fill";

            const title = document.createElement("div");
            title.className = "fw-bold";
            title.textContent = ticket.title;

            const category = document.createElement("div");
            category.className = "text-secondary small";
            category.textContent = "Категория: " + (ticket.category_name || "Не указана");

            info.append(title, category);

            const actions = document.createElement("div");
            actions.className =
                "d-flex align-items-center justify-content-end " +
                "gap-2 flex-wrap";

            const status = document.createElement("span");
            status.className =
                "badge " + getStatusClass(ticket.status);
            status.textContent = getStatusLabel(ticket.status);

            const statusButton = document.createElement("button");
            statusButton.type = "button";
            statusButton.className =
                "btn btn-outline-primary btn-sm";
            statusButton.textContent = "Изменить статус";

            statusButton.addEventListener("click", async () => {
                const availableStatuses = [
                    { value: "new", label: "Новая" },
                    { value: "progress", label: "В работе" },
                    { value: "done", label: "Выполнена" }
                ].filter(item => item.value !== ticket.status);

                if (availableStatuses.length === 0) {
                    showMessage("У заявки уже установлен этот статус");
                    return;
                }

                const choice = prompt(
                    "Выберите новый статус:\n" +
                    availableStatuses.map(
                        (item, index) =>
                            `${index + 1} — ${item.label}`
                    ).join("\n")
                );

                if (choice === null || choice.trim() === "") {
                    return;
                }

                const selected = availableStatuses[
                    Number(choice) - 1
                ];

                if (!selected) {
                    showMessage(
                        "Введите номер из предложенного списка",
                        true
                    );
                    return;
                }

                try {
                    await changeStatus(ticket.id, selected.value);
                    showMessage("Статус заявки успешно изменён");
                } catch (error) {
                    showMessage(
                        "Не удалось изменить статус: " + error.message,
                        true
                    );
                }
            });

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className =
                "btn btn-outline-danger btn-sm";
            deleteButton.textContent = "Удалить";

            deleteButton.addEventListener("click", async () => {
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
                        "Не удалось удалить заявку: " + error.message,
                        true
                    );
                }
            });

            actions.append(status, statusButton, deleteButton);
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

filter.addEventListener("change", loadTickets);

async function changeStatus(ticketId, newStatus) {
    await apiRequest(`/api/tickets/${ticketId}/`, {
        method: "PATCH",
        body: JSON.stringify({
            status: newStatus

})
    });

    await loadTickets();
}

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