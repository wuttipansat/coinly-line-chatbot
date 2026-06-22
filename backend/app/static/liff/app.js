const PAGE_SIZE = 20;

let lineIdToken = null;
let categoryUi = {};

let currentOffset = 0;
let currentTransactionType = "";
let isLoadingTransactions = false;

const transactionsById = new Map();

function formatMoney(value) {
    const numberValue = Number(value || 0);

    return new Intl.NumberFormat(
        "th-TH",
        {
            style: "currency",
            currency: "THB",
            minimumFractionDigits: 2,
        }
    ).format(numberValue);
}

async function refreshTransactions() {
    await Promise.all([
        loadSummary(),
        loadTransactions(true),
    ]);
}

function formatTransactionDate(dateString) {
    if (!dateString) {
        return "-";
    }

    const date = new Date(
        `${dateString}T00:00:00+07:00`
    );

    return new Intl.DateTimeFormat(
        "th-TH",
        {
            day: "numeric",
            month: "short",
            year: "numeric",
        }
    ).format(date);
}


function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


async function fetchJson(url, options = {}) {
    const headers = {
        ...(options.headers || {}),
    };

    if (lineIdToken) {
        headers.Authorization =
            `Bearer ${lineIdToken}`;
    }

    const response = await fetch(
        url,
        {
            ...options,
            headers,
        }
    );

    const body = await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
        const message =
            body.detail
            || `เกิดข้อผิดพลาด HTTP ${response.status}`;

        throw new Error(message);
    }

    return body;
}


function showLoading(message) {
    document
        .getElementById("loading-message")
        .textContent = message;

    document
        .getElementById("loading-overlay")
        .classList.remove("hidden");
}


function hideLoading() {
    document
        .getElementById("loading-overlay")
        .classList.add("hidden");

    document
        .getElementById("app")
        .classList.remove("hidden");
}


function showError(error) {
    console.error(error);

    const errorBox =
        document.getElementById("error-box");

    errorBox.textContent =
        error.message
        || "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";

    errorBox.classList.remove("hidden");
}


async function initializeLiff() {
    showLoading("กำลังเตรียม Coinly...");


    const configResponse = await fetch(
        "/api/v1/liff/config"
    );

    if (!configResponse.ok) {
        throw new Error(
            "ไม่สามารถโหลดการตั้งค่า LIFF ได้"
        );
    }

    const config = await configResponse.json();

    if (!config.liff_id) {
        throw new Error("ไม่พบ LIFF ID");
    }

    categoryUi = config.category_ui || {};

    await liff.init({
        liffId: config.liff_id,
    });


    if (!liff.isLoggedIn()) {
        liff.login({
            redirectUri: window.location.href,
        });

        return;
    }

    lineIdToken = liff.getIDToken();

    if (!lineIdToken) {
        throw new Error(
            "ไม่สามารถรับ LINE ID Token ได้ "
            + "กรุณาตรวจสอบว่าเปิด scope openid แล้ว"
        );
    }

    await loadProfile();

    showLoading("กำลังโหลดรายการ...");

    await Promise.all([
        loadSummary(),
        loadTransactions(true),
    ]);

    hideLoading();
}


async function loadProfile() {
    try {
        const profile = await liff.getProfile();

        document
            .getElementById("profile-name")
            .textContent =
                profile.displayName || "ผู้ใช้";

        const profileImage =
            document.getElementById("profile-image");

        if (profile.pictureUrl) {
            profileImage.src = profile.pictureUrl;
        } else {
            profileImage.style.display = "none";
        }
    } catch (error) {
        console.warn(
            "Cannot load LINE profile:",
            error
        );
    }
}


async function loadSummary() {
    const summary = await fetchJson(
        "/api/v1/liff/summary"
    );

    document
        .getElementById("income-value")
        .textContent =
            formatMoney(summary.total_income);

    document
        .getElementById("expense-value")
        .textContent =
            formatMoney(summary.total_expense);

    document
        .getElementById("balance-value")
        .textContent =
            formatMoney(summary.balance);

    document
        .getElementById("transaction-count")
        .textContent =
            `${summary.transaction_count || 0} รายการ`;
}

function getCategoryUi(
    transactionType,
    categoryKey,
) {
    const categoryConfig = 
        categoryUi
            ?.[transactionType]
            ?.[categoryKey];

    if (categoryConfig) {
        return categoryConfig;
    }

    const fallbackConfig =
        categoryUi
            ?.[transactionType]
            ?.other;
    
    if (fallbackConfig) {
        return fallbackConfig;
    }

    return {
        label: categoryKey || "อื่น ๆ",
        icon: "🧾",
    };
}

function populateCategoryOptions(
    transactionType,
    selectedCategory = "",
) {
    const categorySelect =
        document.getElementById(
            "edit-category"
        );

    const categories =
        categoryUi?.[transactionType] || {};

    categorySelect.innerHTML = "";

    for (const [
        categoryKey,
        categoryConfig,
    ] of Object.entries(categories)) {
        const option =
            document.createElement("option");

        option.value = categoryKey;

        const icon =
            categoryConfig.icon || "";

        const label =
            categoryConfig.label
            || categoryKey;

        option.textContent =
            `${icon} ${label}`.trim();

        option.selected =
            categoryKey === selectedCategory;

        categorySelect.appendChild(option);
    }
}

function createTransactionCard(transaction) {
    const transactionType =
        transaction.type === "income"
            ? "income"
            : "expense";

    const isIncome =
        transactionType === "income";

    const amountPrefix =
        isIncome ? "+" : "-";

    const categoryConfig = getCategoryUi(
        transactionType,
        transaction.category,
    );

    const note =
        transaction.note
        || transaction.raw_text
        || categoryConfig.label
        || "รายการ";

    const category =
        categoryConfig.label;

    const icon =
        categoryConfig.icon;

    const card =
        document.createElement("article");

    card.className = "transaction-card";
    card.dataset.transactionId =
        transaction.id;

    card.innerHTML = `
        <div class="transaction-icon ${transactionType}">
            ${escapeHtml(icon)}
        </div>

        <div class="transaction-info">
            <p class="transaction-note">
                ${escapeHtml(note)}
            </p>

            <p class="transaction-meta">
                ${escapeHtml(category)}
                ·
                ${escapeHtml(
                    formatTransactionDate(
                        transaction.transaction_date
                    )
                )}
            </p>
        </div>

        <div class="transaction-right">
            <div class="transaction-amount ${transactionType}">
                ${amountPrefix}${escapeHtml(
                    formatMoney(transaction.amount)
                )}
            </div>

            <div class="transaction-actions">
                <button
                    type="button"
                    class="transaction-action-button edit"
                    data-action="edit"
                    data-id="${escapeHtml(transaction.id)}"
                >
                    แก้ไข
                </button>

                <button
                    type="button"
                    class="transaction-action-button delete"
                    data-action="delete"
                    data-id="${escapeHtml(transaction.id)}"
                >
                    ลบ
                </button>
            </div>
        </div>
    `;

    return card;
}


async function loadTransactions(reset = false) {
    if (isLoadingTransactions) {
        return;
    }

    isLoadingTransactions = true;

    const loadMoreButton =
        document.getElementById(
            "load-more-button"
        );

    loadMoreButton.disabled = true;
    loadMoreButton.textContent = "กำลังโหลด...";

    try {
        if (reset) {
            currentOffset = 0;
            transactionsById.clear();

            document
                .getElementById("transaction-list")
                .innerHTML = "";

            document
                .getElementById("empty-state")
                .classList.add("hidden");
        }

        const params = new URLSearchParams({
            limit: String(PAGE_SIZE),
            offset: String(currentOffset),
        });

        if (currentTransactionType) {
            params.set(
                "transaction_type",
                currentTransactionType
            );
        }

        const data = await fetchJson(
            `/api/v1/liff/transactions?${params}`
        );

        const transactionList =
            document.getElementById(
                "transaction-list"
            );

        for (const transaction of data.items) {
            transactionsById.set(
                transaction.id,
                transaction,
            );

            transactionList.appendChild(
                createTransactionCard(transaction)
            );
        }

        if (
            reset
            && data.items.length === 0
        ) {
            document
                .getElementById("empty-state")
                .classList.remove("hidden");
        }

        if (data.has_more) {
            currentOffset =
                data.next_offset;

            loadMoreButton.classList.remove(
                "hidden"
            );
        } else {
            loadMoreButton.classList.add(
                "hidden"
            );
        }
    } finally {
        isLoadingTransactions = false;
        loadMoreButton.disabled = false;
        loadMoreButton.textContent = "ดูเพิ่มเติม";
    }
}

function openEditModal(transactionId) {
    const transaction =
        transactionsById.get(transactionId);

    if (!transaction) {
        showError(
            new Error("ไม่พบข้อมูลรายการ")
        );
        return;
    }

    document
        .getElementById("edit-transaction-id")
        .value = transaction.id;

    document
        .getElementById("edit-type")
        .value = transaction.type;

    document
        .getElementById("edit-amount")
        .value = transaction.amount;

    document
        .getElementById("edit-date")
        .value = transaction.transaction_date;

    document
        .getElementById("edit-note")
        .value = transaction.note || "";

    populateCategoryOptions(
        transaction.type,
        transaction.category,
    );

    document
        .getElementById("edit-modal")
        .classList.remove("hidden");

    document.body.classList.add(
        "modal-open"
    );
}

async function refreshTransactions() {
    await Promise.all([
        loadSummary(),
        loadTransactions(true),
    ]);
}

async function submitTransactionEdit(event) {
    event.preventDefault();

    const transactionId =
        document
            .getElementById(
                "edit-transaction-id"
            )
            .value;

    const saveButton =
        document.getElementById(
            "save-edit-button"
        );

    const payload = {
        transaction_date:
            document
                .getElementById("edit-date")
                .value,

        type:
            document
                .getElementById("edit-type")
                .value,

        category:
            document
                .getElementById(
                    "edit-category"
                )
                .value,

        amount: Number(
            document
                .getElementById(
                    "edit-amount"
                )
                .value
        ),

        note:
            document
                .getElementById("edit-note")
                .value
                .trim()
            || null,
    };

    saveButton.disabled = true;
    saveButton.textContent =
        "กำลังบันทึก...";

    try {
        await fetchJson(
            `/api/v1/liff/transactions/${
                encodeURIComponent(
                    transactionId
                )
            }`,
            {
                method: "PUT",
                headers: {
                    "Content-Type":
                        "application/json",
                },
                body: JSON.stringify(payload),
            }
        );

        closeEditModal();

        await refreshTransactions();

        window.alert(
            "แก้ไขรายการสำเร็จ"
        );
    } catch (error) {
        showError(error);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "บันทึก";
    }
}

async function deleteTransaction(
    transactionId,
    button,
) {
    const transaction =
        transactionsById.get(transactionId);

    if (!transaction) {
        showError(
            new Error("ไม่พบข้อมูลรายการ")
        );
        return;
    }

    const name =
        transaction.note
        || transaction.raw_text
        || "รายการนี้";

    const confirmed = window.confirm(
        `ต้องการลบ "${name}" หรือไม่?\n`
        + "เมื่อลบแล้วจะไม่สามารถย้อนกลับได้"
    );

    if (!confirmed) {
        return;
    }

    button.disabled = true;
    button.textContent = "กำลังลบ...";

    try {
        await fetchJson(
            `/api/v1/liff/transactions/${
                encodeURIComponent(
                    transactionId
                )
            }`,
            {
                method: "DELETE",
            }
        );

        await refreshTransactions();

        window.alert("ลบรายการสำเร็จ");
    } catch (error) {
        button.disabled = false;
        button.textContent = "ลบ";
        showError(error);
    }
}


function closeEditModal() {
    document
        .getElementById("edit-modal")
        .classList.add("hidden");

    document.body.classList.remove(
        "modal-open"
    );
}

function setupEvents() {
    const filterButtons =
        document.querySelectorAll(
            ".filter-button"
        );

    for (const button of filterButtons) {
        button.addEventListener(
            "click",
            async () => {
                filterButtons.forEach(
                    (item) => {
                        item.classList.remove(
                            "active"
                        );
                    }
                );

                button.classList.add("active");

                currentTransactionType =
                    button.dataset.type || "";

                try {
                    await loadTransactions(true);
                } catch (error) {
                    showError(error);
                }
            }
        );
    }

    document
        .getElementById("load-more-button")
        .addEventListener(
            "click",
            async () => {
                try {
                    await loadTransactions(false);
                } catch (error) {
                    showError(error);
                }
            }
        );
}


document.addEventListener(
    "DOMContentLoaded",
    async () => {
        setupEvents();

        try {
            await initializeLiff();
        } catch (error) {
            hideLoading();
            showError(error);
        }
    }
);

const transactionList =
    document.getElementById(
        "transaction-list"
    );

transactionList.addEventListener(
    "click",
    async (event) => {
        const actionButton =
            event.target.closest(
                "[data-action]"
            );

        if (!actionButton) {
            return;
        }

        const transactionId =
            actionButton.dataset.id;

        const action =
            actionButton.dataset.action;

        if (action === "edit") {
            openEditModal(transactionId);
            return;
        }

        if (action === "delete") {
            await deleteTransaction(
                transactionId,
                actionButton,
            );
        }
    }
);


document
    .getElementById(
        "edit-transaction-form"
    )
    .addEventListener(
        "submit",
        submitTransactionEdit,
    );


document
    .getElementById("edit-type")
    .addEventListener(
        "change",
        (event) => {
            populateCategoryOptions(
                event.target.value
            );
        }
    );


document
    .querySelectorAll(
        "[data-close-modal]"
    )
    .forEach((element) => {
        element.addEventListener(
            "click",
            closeEditModal,
        );
    });