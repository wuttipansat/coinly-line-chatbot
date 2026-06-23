const PAGE_SIZE = 20;
const BANGKOK_TIME_ZONE = "Asia/Bangkok";

let lineIdToken = null;
let categoryUi = {};

let currentOffset = 0;
let currentTransactionType = "";
let currentStartDate = "";
let currentEndDate = "";
let currentDateFilterMode = "all";
let currentDateFilterValue = "";
let isLoadingTransactions = false;
let isRefreshingTransactions = false;


const transactionsById = new Map();

function setFilterControlsDisabled(disabled) {
    document
        .querySelectorAll(".filter-button")
        .forEach((button) => {
            button.disabled = disabled;
        });

    getElement("date-filter-mode").disabled = disabled;
    getElement("month-filter").disabled = disabled;
    getElement("specific-date-filter").disabled = disabled;
    getElement("apply-date-filter-button").disabled = disabled;
    getElement("clear-date-filter-button").disabled = disabled;
}

function getElement(id) {
    const element = document.getElementById(id);

    if (!element) {
        throw new Error(`ไม่พบ element #${id}`);
    }

    return element;
}

function formatMoney(value) {
    const numberValue = Number(value || 0);

    return new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
        minimumFractionDigits: 2,
    }).format(numberValue);
}

function parseLocalDate(dateString) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString || "");

    if (!match) {
        return null;
    }

    const [, year, month, day] = match;

    return new Date(
        `${year}-${month}-${day}T00:00:00+07:00`
    );
}

function formatTransactionDate(dateString) {
    const date = parseLocalDate(dateString);

    if (!date || Number.isNaN(date.getTime())) {
        return "-";
    }

    return new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: BANGKOK_TIME_ZONE,
    }).format(date);
}

function formatSelectedDateThai(dateString) {
    const date = parseLocalDate(dateString);

    if (!date || Number.isNaN(date.getTime())) {
        return dateString;
    }

    return new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: BANGKOK_TIME_ZONE,
    }).format(date);
}

function formatMonthThai(monthValue) {
    const match = /^(\d{4})-(\d{2})$/.exec(monthValue || "");

    if (!match) {
        return monthValue;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);

    if (month < 1 || month > 12) {
        return monthValue;
    }

    const date = new Date(Date.UTC(year, month - 1, 1));

    return new Intl.DateTimeFormat("th-TH", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    }).format(date);
}

function getBangkokTodayIso() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: BANGKOK_TIME_ZONE,
    }).formatToParts(new Date());

    const values = Object.fromEntries(
        parts
            .filter((part) => part.type !== "literal")
            .map((part) => [part.type, part.value])
    );

    return `${values.year}-${values.month}-${values.day}`;
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
        headers.Authorization = `Bearer ${lineIdToken}`;
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
        const detail = body.detail;
        const message = Array.isArray(detail)
            ? detail.map((item) => item.msg).join(", ")
            : detail || `เกิดข้อผิดพลาด HTTP ${response.status}`;

        throw new Error(message);
    }

    return body;
}

function showLoading(message) {
    getElement("loading-message").textContent = message;
    getElement("loading-overlay").classList.remove("hidden");
}

function hideLoading() {
    getElement("loading-overlay").classList.add("hidden");
    getElement("app").classList.remove("hidden");
}

function clearError() {
    const errorBox = getElement("error-box");
    errorBox.textContent = "";
    errorBox.classList.add("hidden");
}

function showError(error) {
    console.error(error);

    const errorBox = getElement("error-box");
    errorBox.textContent =
        error?.message || "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
    errorBox.classList.remove("hidden");
    errorBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function appendDateFilterParams(params) {
    if (currentStartDate) {
        params.set("start_date", currentStartDate);
    }

    if (currentEndDate) {
        params.set("end_date", currentEndDate);
    }
}

function getMonthDateRange(monthValue) {
    const match = /^(\d{4})-(\d{2})$/.exec(monthValue || "");

    if (!match) {
        throw new Error("กรุณาเลือกเดือน");
    }

    const year = Number(match[1]);
    const month = Number(match[2]);

    if (
        !Number.isInteger(year)
        || !Number.isInteger(month)
        || month < 1
        || month > 12
    ) {
        throw new Error("รูปแบบเดือนไม่ถูกต้อง");
    }

    const monthText = String(month).padStart(2, "0");
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

    return {
        startDate: `${year}-${monthText}-01`,
        endDate: `${year}-${monthText}-${String(lastDay).padStart(2, "0")}`,
    };
}

function updateDateFilterVisibility() {
    const mode = getElement("date-filter-mode").value;

    getElement("month-filter-group").classList.toggle(
        "hidden",
        mode !== "month"
    );

    getElement("specific-date-filter-group").classList.toggle(
        "hidden",
        mode !== "date"
    );
}

function updateActiveDateFilterText() {
    const label = getElement("active-date-filter");
    const panel = document.querySelector(".date-filter-panel");

    if (!currentStartDate || !currentEndDate) {
        label.textContent = "แสดงข้อมูลทุกช่วงเวลา";
        panel?.classList.remove("has-active-filter");
        return;
    }

    if (
        currentDateFilterMode === "month"
        && currentDateFilterValue
    ) {
        label.textContent =
            `กำลังแสดงเดือน ${formatMonthThai(currentDateFilterValue)}`;
    } else if (currentStartDate === currentEndDate) {
        label.textContent =
            `กำลังแสดงวันที่ ${formatSelectedDateThai(currentStartDate)}`;
    } else {
        label.textContent =
            `กำลังแสดง ${formatSelectedDateThai(currentStartDate)}`
            + ` – ${formatSelectedDateThai(currentEndDate)}`;
    }

    panel?.classList.add("has-active-filter");
}

function setFilterButtonLoading(isLoading) {
    const applyButton = getElement("apply-date-filter-button");
    const clearButton = getElement("clear-date-filter-button");

    applyButton.disabled = isLoading;
    clearButton.disabled = isLoading;
    applyButton.textContent = isLoading ? "กำลังกรอง..." : "ใช้ตัวกรอง";
}

async function applyDateFilter() {
    const mode = getElement("date-filter-mode").value;
    const today = getBangkokTodayIso();

    let nextStartDate = "";
    let nextEndDate = "";
    let nextFilterValue = "";

    if (mode === "month") {
        const monthValue = getElement("month-filter").value;

        if (!monthValue) {
            throw new Error("กรุณาเลือกเดือนที่ต้องการกรอง");
        }

        if (monthValue > today.slice(0, 7)) {
            throw new Error("ไม่สามารถเลือกเดือนในอนาคตได้");
        }

        const range = getMonthDateRange(monthValue);

        nextStartDate = range.startDate;
        nextEndDate = range.endDate > today
            ? today
            : range.endDate;

        nextFilterValue = monthValue;
    } else if (mode === "date") {
        const dateValue =
            getElement("specific-date-filter").value;

        if (!dateValue) {
            throw new Error("กรุณาเลือกวันที่ที่ต้องการกรอง");
        }

        if (dateValue > today) {
            throw new Error("ไม่สามารถเลือกวันที่ในอนาคตได้");
        }

        nextStartDate = dateValue;
        nextEndDate = dateValue;
        nextFilterValue = dateValue;
    } else if (mode !== "all") {
        throw new Error("รูปแบบตัวกรองไม่ถูกต้อง");
    }

    const previousFilter = {
        startDate: currentStartDate,
        endDate: currentEndDate,
        mode: currentDateFilterMode,
        value: currentDateFilterValue,
    };

    currentStartDate = nextStartDate;
    currentEndDate = nextEndDate;
    currentDateFilterMode = mode;
    currentDateFilterValue = nextFilterValue;

    updateActiveDateFilterText();

    try {
        await refreshTransactions();
    } catch (error) {
        currentStartDate = previousFilter.startDate;
        currentEndDate = previousFilter.endDate;
        currentDateFilterMode = previousFilter.mode;
        currentDateFilterValue = previousFilter.value;

        updateActiveDateFilterText();

        throw error;
    }
}

async function clearDateFilter() {
    const previousFilter = {
        startDate: currentStartDate,
        endDate: currentEndDate,
        mode: currentDateFilterMode,
        value: currentDateFilterValue,
    };

    const previousControls = {
        mode: getElement("date-filter-mode").value,
        month: getElement("month-filter").value,
        date: getElement("specific-date-filter").value,
    };

    currentStartDate = "";
    currentEndDate = "";
    currentDateFilterMode = "all";
    currentDateFilterValue = "";

    getElement("date-filter-mode").value = "all";
    getElement("month-filter").value = "";
    getElement("specific-date-filter").value = "";

    updateDateFilterVisibility();
    updateActiveDateFilterText();

    try {
        await refreshTransactions();
    } catch (error) {
        currentStartDate = previousFilter.startDate;
        currentEndDate = previousFilter.endDate;
        currentDateFilterMode = previousFilter.mode;
        currentDateFilterValue = previousFilter.value;

        getElement("date-filter-mode").value =
            previousControls.mode;

        getElement("month-filter").value =
            previousControls.month;

        getElement("specific-date-filter").value =
            previousControls.date;

        updateDateFilterVisibility();
        updateActiveDateFilterText();

        throw error;
    }
}

function initializeDateFilterControls() {
    const today = getBangkokTodayIso();
    const currentMonth = today.slice(0, 7);

    getElement("month-filter").max = currentMonth;
    getElement("specific-date-filter").max = today;
    getElement("edit-date").max = today;

    getElement("month-filter").value = currentMonth;
    getElement("specific-date-filter").value = today;

    updateDateFilterVisibility();
    updateActiveDateFilterText();
}

async function initializeLiff() {
    showLoading("กำลังเตรียม Coinly...");

    const configResponse = await fetch("/api/v1/liff/config");

    if (!configResponse.ok) {
        throw new Error("ไม่สามารถโหลดการตั้งค่า LIFF ได้");
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
    await refreshTransactions();

    hideLoading();
}

async function loadProfile() {
    try {
        const profile = await liff.getProfile();

        getElement("profile-name").textContent =
            profile.displayName || "ผู้ใช้";

        const profileImage = getElement("profile-image");

        if (profile.pictureUrl) {
            profileImage.src = profile.pictureUrl;
        } else {
            profileImage.style.display = "none";
        }
    } catch (error) {
        console.warn("Cannot load LINE profile:", error);
    }
}

async function loadSummary() {
    const params = new URLSearchParams();
    appendDateFilterParams(params);

    const query = params.toString();
    const url = query
        ? `/api/v1/liff/summary?${query}`
        : "/api/v1/liff/summary";

    const summary = await fetchJson(url);

    getElement("income-value").textContent =
        formatMoney(summary.total_income);

    getElement("expense-value").textContent =
        formatMoney(summary.total_expense);

    getElement("balance-value").textContent =
        formatMoney(summary.balance);

    getElement("transaction-count").textContent =
        `${summary.transaction_count || 0} รายการ`;
}

function getCategoryUi(transactionType, categoryKey) {
    const categoryConfig = categoryUi?.[transactionType]?.[categoryKey];

    if (categoryConfig) {
        return categoryConfig;
    }

    const fallbackConfig = categoryUi?.[transactionType]?.other;

    if (fallbackConfig) {
        return fallbackConfig;
    }

    return {
        label: categoryKey || "อื่น ๆ",
        icon: "🧾",
    };
}

function populateCategoryOptions(transactionType, selectedCategory = "") {
    const categorySelect = getElement("edit-category");
    const categories = categoryUi?.[transactionType] || {};

    categorySelect.innerHTML = "";

    for (const [categoryKey, categoryConfig] of Object.entries(categories)) {
        const option = document.createElement("option");

        option.value = categoryKey;

        const icon = categoryConfig.icon || "";
        const label = categoryConfig.label || categoryKey;

        option.textContent = `${icon} ${label}`.trim();
        option.selected = categoryKey === selectedCategory;

        categorySelect.appendChild(option);
    }
}

function createTransactionCard(transaction) {
    const transactionType =
        transaction.type === "income" ? "income" : "expense";

    const isIncome = transactionType === "income";
    const amountPrefix = isIncome ? "+" : "-";

    const categoryConfig = getCategoryUi(
        transactionType,
        transaction.category
    );

    const note =
        transaction.note
        || transaction.raw_text
        || categoryConfig.label
        || "รายการ";

    const card = document.createElement("article");

    card.className = "transaction-card";
    card.dataset.transactionId = transaction.id;

    card.innerHTML = `
        <div class="transaction-icon ${transactionType}">
            ${escapeHtml(categoryConfig.icon)}
        </div>

        <div class="transaction-info">
            <p class="transaction-note">
                ${escapeHtml(note)}
            </p>

            <p class="transaction-meta">
                ${escapeHtml(categoryConfig.label)}
                ·
                ${escapeHtml(
                    formatTransactionDate(transaction.transaction_date)
                )}
            </p>
        </div>

        <div class="transaction-right">
            <div class="transaction-amount ${transactionType}">
                ${amountPrefix}${escapeHtml(formatMoney(transaction.amount))}
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

function updateEmptyState(isEmpty) {
    const emptyState = getElement("empty-state");
    const emptyTitle = getElement("empty-state-title");
    const emptyMessage = getElement("empty-state-message");
    const hasFilter = Boolean(
        currentTransactionType || currentStartDate || currentEndDate
    );

    emptyState.classList.toggle("hidden", !isEmpty);

    if (!isEmpty) {
        return;
    }

    if (hasFilter) {
        emptyTitle.textContent = "ไม่พบรายการ";
        emptyMessage.textContent = "ลองเปลี่ยนหรือล้างตัวกรองเพื่อดูรายการอื่น";
    } else {
        emptyTitle.textContent = "ยังไม่มีรายการ";
        emptyMessage.textContent = "ส่งข้อความหา Coinly เพื่อบันทึกรายการแรก";
    }
}

async function loadTransactions(reset = false) {
    if (isLoadingTransactions) {
        return;
    }

    isLoadingTransactions = true;

    const loadMoreButton = getElement("load-more-button");

    loadMoreButton.disabled = true;
    loadMoreButton.textContent = "กำลังโหลด...";

    try {
        const requestedOffset = reset ? 0 : currentOffset;

        const params = new URLSearchParams({
            limit: String(PAGE_SIZE),
            offset: String(requestedOffset),
        });

        if (currentTransactionType) {
            params.set(
                "transaction_type",
                currentTransactionType
            );
        }

        appendDateFilterParams(params);

        const data = await fetchJson(
            `/api/v1/liff/transactions?${params.toString()}`
        );

        const items = Array.isArray(data.items)
            ? data.items
            : [];

        const transactionList =
            getElement("transaction-list");

        if (reset) {
            currentOffset = 0;
            transactionsById.clear();
            transactionList.innerHTML = "";
        }

        for (const transaction of items) {
            transactionsById.set(
                transaction.id,
                transaction
            );

            transactionList.appendChild(
                createTransactionCard(transaction)
            );
        }

        if (reset) {
            updateEmptyState(items.length === 0);
        }

        if (
            data.has_more
            && data.next_offset !== null
        ) {
            currentOffset = Number(data.next_offset);
            loadMoreButton.classList.remove("hidden");
        } else {
            loadMoreButton.classList.add("hidden");
        }
    } finally {
        isLoadingTransactions = false;
        loadMoreButton.disabled = false;
        loadMoreButton.textContent = "ดูเพิ่มเติม";
    }
}

async function refreshTransactions() {
    if (isRefreshingTransactions) {
        return;
    }

    isRefreshingTransactions = true;
    setFilterControlsDisabled(true);
    clearError();

    try {
        const results = await Promise.allSettled([
            loadSummary(),
            loadTransactions(true),
        ]);

        const failedResult = results.find(
            (result) => result.status === "rejected"
        );

        if (failedResult) {
            throw failedResult.reason;
        }
    } finally {
        isRefreshingTransactions = false;
        setFilterControlsDisabled(false);
    }
}

function openEditModal(transactionId) {
    const transaction = transactionsById.get(transactionId);

    if (!transaction) {
        showError(new Error("ไม่พบข้อมูลรายการ"));
        return;
    }

    getElement("edit-transaction-id").value = transaction.id;
    getElement("edit-type").value = transaction.type;
    getElement("edit-amount").value = transaction.amount;
    getElement("edit-date").value = transaction.transaction_date;
    getElement("edit-note").value = transaction.note || "";

    populateCategoryOptions(transaction.type, transaction.category);

    getElement("edit-modal").classList.remove("hidden");
    document.body.classList.add("modal-open");
}

function closeEditModal() {
    getElement("edit-modal").classList.add("hidden");
    document.body.classList.remove("modal-open");
}

async function submitTransactionEdit(event) {
    event.preventDefault();

    const transactionId =
        getElement("edit-transaction-id").value;

    const saveButton =
        getElement("save-edit-button");

    const transactionDate =
        getElement("edit-date").value;

    const today = getBangkokTodayIso();

    if (!transactionDate) {
        showError(new Error("กรุณาเลือกวันที่"));
        return;
    }

    if (transactionDate > today) {
        showError(
            new Error(
                "วันที่ทำรายการต้องไม่เป็นวันที่ในอนาคต"
            )
        );
        return;
    }

    const payload = {
        transaction_date: transactionDate,
        type: getElement("edit-type").value,
        category: getElement("edit-category").value,
        amount: Number(getElement("edit-amount").value),
        note: getElement("edit-note").value.trim() || null,
    };

    saveButton.disabled = true;
    saveButton.textContent = "กำลังบันทึก...";

    try {
        await fetchJson(
            `/api/v1/liff/transactions/${encodeURIComponent(transactionId)}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            }
        );

        closeEditModal();
        await refreshTransactions();
        window.alert("แก้ไขรายการสำเร็จ");
    } catch (error) {
        showError(error);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "บันทึก";
    }
}

async function deleteTransaction(transactionId, button) {
    const transaction = transactionsById.get(transactionId);

    if (!transaction) {
        showError(new Error("ไม่พบข้อมูลรายการ"));
        return;
    }

    const name = transaction.note || transaction.raw_text || "รายการนี้";
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
            `/api/v1/liff/transactions/${encodeURIComponent(transactionId)}`,
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

function setupEvents() {
    const filterButtons = document.querySelectorAll(".filter-button");

    for (const button of filterButtons) {
        button.addEventListener("click", async () => {
            if (isRefreshingTransactions) {
                return;
            }

            const previousType = currentTransactionType;
            const previousActiveButton =
                document.querySelector(".filter-button.active");

            filterButtons.forEach((item) => {
                item.classList.remove("active");
            });

            button.classList.add("active");
            currentTransactionType = button.dataset.type || "";

            isRefreshingTransactions = true;
            setFilterControlsDisabled(true);

            try {
                clearError();
                await loadTransactions(true);
            } catch (error) {
                currentTransactionType = previousType;

                filterButtons.forEach((item) => {
                    item.classList.remove("active");
                });

                previousActiveButton?.classList.add("active");
                showError(error);
            } finally {
                isRefreshingTransactions = false;
                setFilterControlsDisabled(false);
            }
        });
    }

    getElement("date-filter-mode").addEventListener(
        "change",
        updateDateFilterVisibility
    );

    getElement("apply-date-filter-button").addEventListener(
        "click",
        async () => {
            setFilterButtonLoading(true);

            try {
                clearError();
                await applyDateFilter();
            } catch (error) {
                showError(error);
            } finally {
                setFilterButtonLoading(false);
            }
        }
    );

    getElement("clear-date-filter-button").addEventListener(
        "click",
        async () => {
            setFilterButtonLoading(true);

            try {
                clearError();
                await clearDateFilter();
            } catch (error) {
                showError(error);
            } finally {
                setFilterButtonLoading(false);
            }
        }
    );

    getElement("load-more-button").addEventListener(
        "click",
        async () => {
            if (isRefreshingTransactions) {
                return;
            }

            isRefreshingTransactions = true;
            setFilterControlsDisabled(true);

            try {
                clearError();
                await loadTransactions(false);
            } catch (error) {
                showError(error);
            } finally {
                isRefreshingTransactions = false;
                setFilterControlsDisabled(false);
            }
        }
    );

    getElement("transaction-list").addEventListener(
        "click",
        async (event) => {
            const actionButton = event.target.closest("[data-action]");

            if (!actionButton) {
                return;
            }

            const transactionId = actionButton.dataset.id;
            const action = actionButton.dataset.action;

            if (action === "edit") {
                openEditModal(transactionId);
                return;
            }

            if (action === "delete") {
                await deleteTransaction(transactionId, actionButton);
            }
        }
    );

    getElement("edit-transaction-form").addEventListener(
        "submit",
        submitTransactionEdit
    );

    getElement("edit-type").addEventListener("change", (event) => {
        populateCategoryOptions(event.target.value);
    });

    document.querySelectorAll("[data-close-modal]").forEach((element) => {
        element.addEventListener("click", closeEditModal);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeEditModal();
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    initializeDateFilterControls();
    setupEvents();

    try {
        await initializeLiff();
    } catch (error) {
        hideLoading();
        showError(error);
    }
});
