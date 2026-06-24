const PAGE_SIZE = 20;
const API_PAGE_LIMIT = 50;
const MAX_HOME_TRANSACTIONS = 1000;
const MAX_HISTORY_TRANSACTIONS = 1000;
const BANGKOK_TIME_ZONE = "Asia/Bangkok";

const CHART_COLORS = [
    "#FFD384",
    "#FFAEC0",
    "#E7B85C",
    "#FFCED9",
    "#C98E2A",
    "#F48CA4",
];

const TYPE_LABELS = {
    income: "รายรับ",
    expense: "รายจ่าย",
};

const state = {
    lineIdToken: null,
    categoryUi: {},
    activeTab: "home",
    period: {
        mode: "month",
        value: "",
        startDate: "",
        endDate: "",
    },
    home: {
        summary: null,
        transactions: [],
    },
    history: {
        items: [],
        offset: 0,
        hasMore: false,
        allLoaded: false,
        type: "",
        search: "",
        sort: "newest",
        loading: false,
    },
    selectedTransactionId: null,
    toastTimer: null,
    searchTimer: null,
    activeSheetId: null,
};

const elements = {};

function getElement(id) {
    const element = document.getElementById(id);

    if (!element) {
        throw new Error(`ไม่พบ element #${id}`);
    }

    return element;
}

function cacheElements() {
    [
        "loading-overlay",
        "loading-message",
        "app",
        "screen-title",
        "profile-name",
        "profile-image",
        "error-box",
        "home-tab",
        "history-tab",
        "home-period-label",
        "balance-value",
        "income-value",
        "expense-value",
        "transaction-count",
        "expense-chart",
        "chart-center-value",
        "chart-legend",
        "chart-content",
        "chart-empty",
        "chart-loading",
        "recent-skeleton",
        "recent-list",
        "home-empty-state",
        "view-all-button",
        "history-subtitle",
        "history-options-button",
        "filter-badge",
        "transaction-search",
        "active-filter-chips",
        "history-skeleton",
        "transaction-list",
        "empty-state",
        "empty-state-title",
        "empty-state-message",
        "load-more-button",
        "sheet-layer",
        "sheet-backdrop",
        "filter-sheet",
        "detail-sheet",
        "edit-sheet",
        "delete-sheet",
        "filter-form",
        "filter-date-mode",
        "filter-month",
        "filter-date",
        "filter-start-date",
        "filter-end-date",
        "filter-month-group",
        "filter-date-group",
        "filter-range-group",
        "sort-select",
        "reset-filter-button",
        "apply-filter-button",
        "detail-type-label",
        "detail-amount",
        "detail-category",
        "detail-note",
        "detail-date",
        "detail-created-at",
        "detail-edit-button",
        "detail-delete-button",
        "edit-transaction-form",
        "edit-transaction-id",
        "edit-type",
        "edit-category",
        "edit-amount",
        "edit-date",
        "edit-note",
        "save-edit-button",
        "confirm-delete-button",
        "delete-description",
        "toast",
    ].forEach((id) => {
        elements[id] = getElement(id);
    });
}

function showLoading(message) {
    elements["loading-message"].textContent = message;
    elements["loading-overlay"].classList.remove("hidden");
}

function hideLoading() {
    elements["loading-overlay"].classList.add("hidden");
    elements.app.classList.remove("hidden");
}

function clearError() {
    elements["error-box"].textContent = "";
    elements["error-box"].classList.add("hidden");
}

function toPublicError(error) {
    const message = error?.message || "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";

    if (/401|unauthorized|authorization|token/i.test(message)) {
        return "เซสชัน LINE หมดอายุหรือไม่สามารถยืนยันตัวตนได้ กรุณาเปิดหน้านี้ใหม่อีกครั้ง";
    }

    if (/failed to fetch|network|internet/i.test(message)) {
        return "เชื่อมต่อไม่ได้ในขณะนี้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง";
    }

    return message;
}

function showError(error) {
    const message = toPublicError(error);

    elements["error-box"].textContent = message;
    elements["error-box"].classList.remove("hidden");
}

function showToast(message) {
    window.clearTimeout(state.toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.remove("hidden");

    state.toastTimer = window.setTimeout(() => {
        elements.toast.classList.add("hidden");
    }, 2600);
}

function formatMoney(value, { signedType = "" } = {}) {
    const numberValue = Math.abs(Number(value || 0));
    const formatted = new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
        minimumFractionDigits: 2,
    }).format(numberValue);

    if (signedType === "income") {
        return `+${formatted}`;
    }

    if (signedType === "expense") {
        return `−${formatted}`;
    }

    return formatted;
}

function parseLocalDate(dateString) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString || "");

    if (!match) {
        return null;
    }

    return new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00+07:00`);
}

function formatDateShort(dateString) {
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

function formatDateLong(dateString) {
    const date = parseLocalDate(dateString);

    if (!date || Number.isNaN(date.getTime())) {
        return dateString || "-";
    }

    return new Intl.DateTimeFormat("th-TH", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: BANGKOK_TIME_ZONE,
    }).format(date);
}

function formatDateTime(value) {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: BANGKOK_TIME_ZONE,
    }).format(date);
}

function formatMonthThai(monthValue) {
    const match = /^(\d{4})-(\d{2})$/.exec(monthValue || "");

    if (!match) {
        return monthValue || "ทุกช่วงเวลา";
    }

    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));

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

function getMonthRange(monthValue) {
    const match = /^(\d{4})-(\d{2})$/.exec(monthValue || "");

    if (!match) {
        throw new Error("กรุณาเลือกเดือน");
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const today = getBangkokTodayIso();

    return {
        startDate: `${year}-${String(month).padStart(2, "0")}-01`,
        endDate: endDate > today ? today : endDate,
    };
}

function getLastMonthValue(currentMonth) {
    const [year, month] = currentMonth.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 2, 1));

    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getPeriodLabel() {
    if (state.period.mode === "all") {
        return "ทุกช่วงเวลา";
    }

    if (state.period.mode === "month") {
        return formatMonthThai(state.period.value);
    }

    if (state.period.mode === "date") {
        return formatDateLong(state.period.startDate);
    }

    return `${formatDateShort(state.period.startDate)} - ${formatDateShort(state.period.endDate)}`;
}

function setInitialPeriod() {
    const today = getBangkokTodayIso();
    const currentMonth = today.slice(0, 7);
    const range = getMonthRange(currentMonth);

    state.period = {
        mode: "month",
        value: currentMonth,
        startDate: range.startDate,
        endDate: range.endDate,
    };

    elements["filter-month"].max = currentMonth;
    elements["filter-date"].max = today;
    elements["filter-start-date"].max = today;
    elements["filter-end-date"].max = today;
    elements["edit-date"].max = today;
    elements["filter-month"].value = currentMonth;
    elements["filter-date"].value = today;
}

function buildQuery(params) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            query.set(key, String(value));
        }
    });

    return query.toString();
}

async function fetchJson(url, options = {}) {
    const headers = new Headers(options.headers || {});

    if (state.lineIdToken) {
        headers.set("Authorization", `Bearer ${state.lineIdToken}`);
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    const text = await response.text();
    let body = {};

    if (text) {
        try {
            body = JSON.parse(text);
        } catch {
            body = {};
        }
    }

    if (!response.ok) {
        const detail = body.detail;
        const message = Array.isArray(detail)
            ? detail.map((item) => item.msg || item.message).filter(Boolean).join(", ")
            : detail || `เกิดข้อผิดพลาด HTTP ${response.status}`;

        throw new Error(message);
    }

    return body;
}

async function fetchSummary() {
    const query = buildQuery({
        start_date: state.period.startDate,
        end_date: state.period.endDate,
    });

    return fetchJson(query ? `/api/v1/liff/summary?${query}` : "/api/v1/liff/summary");
}

async function fetchTransactionsPage({
    limit = PAGE_SIZE,
    offset = 0,
    type = "",
    startDate = state.period.startDate,
    endDate = state.period.endDate,
} = {}) {
    const query = buildQuery({
        limit,
        offset,
        transaction_type: type,
        start_date: startDate,
        end_date: endDate,
    });

    return fetchJson(`/api/v1/liff/transactions?${query}`);
}

async function fetchAllTransactions({
    type = "",
    maxItems = MAX_HISTORY_TRANSACTIONS,
} = {}) {
    const allItems = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore && allItems.length < maxItems) {
        const data = await fetchTransactionsPage({
            limit: API_PAGE_LIMIT,
            offset,
            type,
        });
        const items = Array.isArray(data.items) ? data.items : [];

        allItems.push(...items);
        hasMore = Boolean(data.has_more) && data.next_offset !== null;
        offset = Number(data.next_offset || offset + items.length);

        if (items.length === 0) {
            break;
        }
    }

    return allItems.slice(0, maxItems);
}

function getCategoryUi(transactionType, categoryKey) {
    const categoryConfig = state.categoryUi?.[transactionType]?.[categoryKey];

    if (categoryConfig) {
        const label = categoryConfig.label || categoryKey || "ไม่ระบุหมวดหมู่";

        return {
            label,
            icon: categoryConfig.icon || label.charAt(0),
        };
    }

    const otherConfig = state.categoryUi?.[transactionType]?.other;
    const label = categoryKey || otherConfig?.label || "ไม่ระบุหมวดหมู่";

    return {
        label,
        icon: otherConfig?.icon || label.charAt(0),
    };
}

function getCategoryEntries(transactionType) {
    return Object
        .entries(state.categoryUi?.[transactionType] || {})
        .map(([key]) => [key, getCategoryUi(transactionType, key)]);
}

function isCategoryConfigured(transactionType, categoryKey) {
    return Boolean(state.categoryUi?.[transactionType]?.[categoryKey]);
}

function getTransactionDisplay(transaction) {
    const type = transaction.type === "income" ? "income" : "expense";
    const category = getCategoryUi(type, transaction.category);
    const note = transaction.note || transaction.raw_text || category.label || "รายการ";

    return {
        type,
        category,
        note,
        amountText: formatMoney(transaction.amount, { signedType: type }),
        dateText: formatDateShort(transaction.transaction_date),
    };
}

function sortTransactions(items) {
    const sorted = [...items];

    sorted.sort((left, right) => {
        if (state.history.sort === "highest") {
            return Number(right.amount || 0) - Number(left.amount || 0);
        }

        if (state.history.sort === "lowest") {
            return Number(left.amount || 0) - Number(right.amount || 0);
        }

        const leftDate = `${left.transaction_date || ""}T${left.created_at || ""}`;
        const rightDate = `${right.transaction_date || ""}T${right.created_at || ""}`;

        if (state.history.sort === "oldest") {
            return leftDate.localeCompare(rightDate);
        }

        return rightDate.localeCompare(leftDate);
    });

    return sorted;
}

function searchTransactions(items) {
    const search = state.history.search.trim().toLowerCase();

    if (!search) {
        return items;
    }

    return items.filter((transaction) => {
        const display = getTransactionDisplay(transaction);
        const fields = [
            display.note,
            display.category.label,
            TYPE_LABELS[display.type],
            transaction.category,
            transaction.raw_text,
        ];

        return fields.some((field) => String(field || "").toLowerCase().includes(search));
    });
}

function shouldLoadFullHistory() {
    return Boolean(state.history.search.trim()) || state.history.sort !== "newest";
}

function setHomeLoading(isLoading) {
    elements["recent-skeleton"].classList.toggle("hidden", !isLoading);
    elements["chart-loading"].classList.toggle("hidden", !isLoading);
    elements["chart-content"].classList.toggle("hidden", isLoading);
}

function setHistoryLoading(isLoading) {
    elements["history-skeleton"].classList.toggle("hidden", !isLoading);
}

function renderSummary(summary) {
    const totalIncome = Number(summary?.total_income || 0);
    const totalExpense = Number(summary?.total_expense || 0);
    const balance = Number(summary?.balance || 0);

    elements["balance-value"].textContent = formatMoney(balance);
    elements["income-value"].textContent = formatMoney(totalIncome, { signedType: "income" });
    elements["expense-value"].textContent = formatMoney(totalExpense, { signedType: "expense" });
    elements["transaction-count"].textContent = `${summary?.transaction_count || 0} รายการ`;
    elements["home-period-label"].textContent = getPeriodLabel();
}

function buildChartSegments(transactions) {
    const totals = new Map();

    transactions
        .filter((transaction) => transaction.type === "expense")
        .forEach((transaction) => {
            const amount = Number(transaction.amount || 0);
            const key = transaction.category || "other";
            totals.set(key, (totals.get(key) || 0) + amount);
        });

    const totalExpense = [...totals.values()].reduce((sum, amount) => sum + amount, 0);

    if (totalExpense <= 0) {
        return { totalExpense, segments: [] };
    }

    const sorted = [...totals.entries()]
        .sort((left, right) => right[1] - left[1]);

    const topSegments = sorted.slice(0, 5);
    const otherTotal = sorted
        .slice(5)
        .reduce((sum, [, amount]) => sum + amount, 0);

    if (otherTotal > 0) {
        topSegments.push(["other", otherTotal]);
    }

    return {
        totalExpense,
        segments: topSegments.map(([categoryKey, amount], index) => ({
            categoryKey,
            amount,
            percent: amount / totalExpense,
            color: CHART_COLORS[index % CHART_COLORS.length],
            label: getCategoryUi("expense", categoryKey).label,
        })),
    };
}

function renderChart(transactions) {
    const { totalExpense, segments } = buildChartSegments(transactions);

    elements["chart-empty"].classList.toggle("hidden", segments.length > 0);
    elements["expense-chart"].classList.toggle("empty", segments.length === 0);
    elements["chart-legend"].innerHTML = "";

    if (segments.length === 0) {
        elements["expense-chart"].style.background = "";
        elements["chart-center-value"].textContent = "0%";
        elements["expense-chart"].setAttribute("aria-label", "ยังไม่มีข้อมูลรายจ่าย");
        return;
    }

    let currentDegree = 0;
    const gradientStops = segments.map((segment) => {
        const start = currentDegree;
        const end = currentDegree + segment.percent * 360;
        currentDegree = end;
        return `${segment.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
    });

    elements["expense-chart"].style.background = `conic-gradient(${gradientStops.join(", ")})`;
    elements["chart-center-value"].textContent = `${Math.round(segments[0].percent * 100)}%`;
    elements["expense-chart"].setAttribute(
        "aria-label",
        `รายจ่ายรวม ${formatMoney(totalExpense)} หมวดสูงสุด ${segments[0].label}`
    );

    const fragment = document.createDocumentFragment();

    segments.forEach((segment) => {
        const item = document.createElement("div");
        item.className = "legend-item";
        item.innerHTML = `
            <span class="legend-dot" style="background:${segment.color}"></span>
            <span class="legend-label">${escapeHtml(segment.label)}</span>
            <span class="legend-value">${Math.round(segment.percent * 100)}%</span>
        `;
        fragment.appendChild(item);
    });

    elements["chart-legend"].appendChild(fragment);
}

function createTransactionItem(transaction, { compact = false } = {}) {
    const display = getTransactionDisplay(transaction);
    const button = document.createElement("button");

    button.type = "button";
    button.className = `transaction-item ${display.type}`;
    button.dataset.transactionId = transaction.id;
    button.setAttribute(
        "aria-label",
        `${TYPE_LABELS[display.type]} ${display.amountText} ${display.note}`
    );

    button.innerHTML = `
        <span class="category-icon" aria-hidden="true">
            ${escapeHtml(display.category.icon)}
        </span>
        <span class="transaction-main">
            <span class="transaction-note">${escapeHtml(display.note)}</span>
            <span class="transaction-meta">
                ${escapeHtml(display.category.label)}
                ${compact ? "" : ` · ${escapeHtml(display.dateText)}`}
            </span>
        </span>
        <span class="transaction-amount ${display.type}">
            ${escapeHtml(display.amountText)}
        </span>
    `;

    button.addEventListener("click", () => openTransactionDetail(transaction.id));

    return button;
}

function renderRecentTransactions() {
    elements["recent-list"].innerHTML = "";
    const transactions = state.home.transactions.slice(0, 5);

    elements["home-empty-state"].classList.toggle("hidden", transactions.length > 0);

    const fragment = document.createDocumentFragment();
    transactions.forEach((transaction) => {
        fragment.appendChild(createTransactionItem(transaction, { compact: false }));
    });

    elements["recent-list"].appendChild(fragment);
}

function groupTransactionsByDate(items) {
    return items.reduce((groups, transaction) => {
        const dateKey = transaction.transaction_date || "";
        if (!groups.has(dateKey)) {
            groups.set(dateKey, []);
        }
        groups.get(dateKey).push(transaction);
        return groups;
    }, new Map());
}

function renderHistory() {
    const searched = searchTransactions(state.history.items);
    const visibleItems = sortTransactions(searched);
    const hasFilters = Boolean(
        state.history.type
        || state.period.mode !== "all"
        || state.history.search.trim()
    );

    elements["transaction-list"].innerHTML = "";
    elements["empty-state"].classList.toggle("hidden", visibleItems.length > 0);

    if (visibleItems.length === 0) {
        elements["empty-state-title"].textContent = hasFilters
            ? "ไม่พบรายการ"
            : "ยังไม่มีรายการ";
        elements["empty-state-message"].textContent = hasFilters
            ? "ลองเปลี่ยนช่วงเวลาหรือตัวกรอง"
            : "เริ่มบันทึกรายรับรายจ่ายผ่านแชต LINE ได้เลย";
    }

    const fragment = document.createDocumentFragment();
    const groups = groupTransactionsByDate(visibleItems);

    groups.forEach((transactions, dateKey) => {
        const group = document.createElement("section");
        group.className = "transaction-group";
        group.innerHTML = `
            <h3 class="transaction-date-heading">${escapeHtml(formatDateLong(dateKey))}</h3>
            <div class="transaction-group-list"></div>
        `;

        const list = group.querySelector(".transaction-group-list");
        transactions.forEach((transaction) => {
            list.appendChild(createTransactionItem(transaction));
        });

        fragment.appendChild(group);
    });

    elements["transaction-list"].appendChild(fragment);

    const countLabel = visibleItems.length === state.history.items.length
        ? `${visibleItems.length} รายการ`
        : `${visibleItems.length} จาก ${state.history.items.length} รายการ`;

    elements["history-subtitle"].textContent = `${getPeriodLabel()} · ${countLabel}`;
    updateLoadMoreButton();
}

function updateLoadMoreButton() {
    const shouldHide = shouldLoadFullHistory() || !state.history.hasMore;
    elements["load-more-button"].classList.toggle("hidden", shouldHide);
}

function updatePeriodButtons() {
    const currentMonth = getBangkokTodayIso().slice(0, 7);
    const lastMonth = getLastMonthValue(currentMonth);

    document.querySelectorAll("[data-period-shortcut]").forEach((button) => {
        const shortcut = button.dataset.periodShortcut;
        const isActive =
            (shortcut === "this-month" && state.period.mode === "month" && state.period.value === currentMonth)
            || (shortcut === "last-month" && state.period.mode === "month" && state.period.value === lastMonth)
            || (shortcut === "all" && state.period.mode === "all");

        button.classList.toggle("active", isActive);
    });
}

function renderFilterChips() {
    const chips = [];
    const currentMonth = getBangkokTodayIso().slice(0, 7);
    const isDefaultPeriod = state.period.mode === "month" && state.period.value === currentMonth;

    chips.push({
        label: getPeriodLabel(),
        clearLabel: "ล้างช่วงเวลา",
        action: "period",
        removable: !isDefaultPeriod,
    });

    if (state.history.type) {
        chips.push({
            label: TYPE_LABELS[state.history.type],
            clearLabel: "ล้างประเภทรายการ",
            action: "type",
            removable: true,
        });
    }

    if (state.history.search.trim()) {
        chips.push({
            label: `ค้นหา: ${state.history.search.trim()}`,
            clearLabel: "ล้างคำค้นหา",
            action: "search",
            removable: true,
        });
    }

    if (state.history.sort !== "newest") {
        const sortLabels = {
            oldest: "เก่าที่สุด",
            highest: "จำนวนเงินมากที่สุด",
            lowest: "จำนวนเงินน้อยที่สุด",
        };
        chips.push({
            label: sortLabels[state.history.sort],
            clearLabel: "ล้างการเรียงลำดับ",
            action: "sort",
            removable: true,
        });
    }

    elements["active-filter-chips"].innerHTML = chips.map((chip) => `
        <span class="filter-chip">
            ${escapeHtml(chip.label)}
            ${chip.removable ? `
                <button type="button" data-clear-chip="${escapeHtml(chip.action)}" aria-label="${escapeHtml(chip.clearLabel)}">
                    ×
                </button>
            ` : ""}
        </span>
    `).join("");

    const hasActiveHistoryFilter =
        state.history.type
        || state.history.search.trim()
        || state.history.sort !== "newest"
        || !isDefaultPeriod;

    elements["filter-badge"].classList.toggle("hidden", !hasActiveHistoryFilter);
}

async function loadHome() {
    setHomeLoading(true);

    try {
        const [summary, transactions] = await Promise.all([
            fetchSummary(),
            fetchAllTransactions({ maxItems: MAX_HOME_TRANSACTIONS }),
        ]);

        state.home.summary = summary;
        state.home.transactions = transactions;
        renderSummary(summary);
        renderChart(transactions);
        renderRecentTransactions();
    } finally {
        setHomeLoading(false);
    }
}

async function loadHistory(reset = false, { forceAll = false } = {}) {
    if (state.history.loading) {
        return;
    }

    state.history.loading = true;
    setHistoryLoading(true);
    elements["load-more-button"].disabled = true;
    elements["load-more-button"].textContent = "กำลังโหลด...";

    try {
        if (reset) {
            state.history.offset = 0;
            state.history.items = [];
            state.history.hasMore = false;
            state.history.allLoaded = false;
            elements["transaction-list"].innerHTML = "";
        }

        if (forceAll) {
            state.history.items = await fetchAllTransactions({
                type: state.history.type,
                maxItems: MAX_HISTORY_TRANSACTIONS,
            });
            state.history.hasMore = false;
            state.history.allLoaded = true;
        } else {
            const data = await fetchTransactionsPage({
                limit: PAGE_SIZE,
                offset: state.history.offset,
                type: state.history.type,
            });
            const items = Array.isArray(data.items) ? data.items : [];

            state.history.items.push(...items);
            state.history.hasMore = Boolean(data.has_more) && data.next_offset !== null;
            state.history.offset = Number(data.next_offset || state.history.offset + items.length);
            state.history.allLoaded = !state.history.hasMore;
        }

        renderHistory();
    } finally {
        state.history.loading = false;
        setHistoryLoading(false);
        elements["load-more-button"].disabled = false;
        elements["load-more-button"].textContent = "ดูเพิ่มเติม";
    }
}

async function refreshAllData({ forceHistoryAll = false } = {}) {
    clearError();
    updatePeriodButtons();
    renderFilterChips();

    const results = await Promise.allSettled([
        loadHome(),
        loadHistory(true, {
            forceAll: forceHistoryAll || shouldLoadFullHistory(),
        }),
    ]);

    const failed = results.find((result) => result.status === "rejected");
    if (failed) {
        throw failed.reason;
    }
}

function setActiveTab(tab) {
    state.activeTab = tab;
    const isHome = tab === "home";

    elements["home-tab"].classList.toggle("hidden", !isHome);
    elements["history-tab"].classList.toggle("hidden", isHome);
    elements["screen-title"].textContent = isHome ? "ภาพรวม" : "ประวัติ";

    document.querySelectorAll(".nav-button").forEach((button) => {
        const active = button.dataset.tab === tab;
        button.classList.toggle("active", active);
        if (active) {
            button.setAttribute("aria-current", "page");
        } else {
            button.removeAttribute("aria-current");
        }
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function openSheet(sheetId) {
    state.activeSheetId = sheetId;
    elements["sheet-layer"].classList.remove("hidden");
    elements["sheet-layer"].setAttribute("aria-hidden", "false");
    document.body.classList.add("sheet-open");

    ["filter-sheet", "detail-sheet", "edit-sheet", "delete-sheet"].forEach((id) => {
        elements[id].classList.toggle("hidden", id !== sheetId);
    });

    window.setTimeout(() => {
        const focusTarget = elements[sheetId].querySelector("button, input, select, textarea");
        focusTarget?.focus({ preventScroll: true });
    }, 0);
}

function closeSheet() {
    state.activeSheetId = null;
    elements["sheet-layer"].classList.add("hidden");
    elements["sheet-layer"].setAttribute("aria-hidden", "true");
    document.body.classList.remove("sheet-open");

    ["filter-sheet", "detail-sheet", "edit-sheet", "delete-sheet"].forEach((id) => {
        elements[id].classList.add("hidden");
    });
}

function findTransactionById(transactionId) {
    return (
        state.history.items.find((item) => String(item.id) === String(transactionId))
        || state.home.transactions.find((item) => String(item.id) === String(transactionId))
        || null
    );
}

function openTransactionDetail(transactionId) {
    const transaction = findTransactionById(transactionId);

    if (!transaction) {
        showError(new Error("ไม่พบข้อมูลรายการ"));
        return;
    }

    state.selectedTransactionId = transaction.id;
    const display = getTransactionDisplay(transaction);

    elements["detail-type-label"].textContent = TYPE_LABELS[display.type];
    elements["detail-amount"].textContent = display.amountText;
    elements["detail-amount"].className = `detail-amount ${display.type === "income" ? "amount-positive" : "amount-negative"}`;
    elements["detail-category"].textContent = display.category.label;
    elements["detail-note"].textContent = display.note;
    elements["detail-date"].textContent = formatDateLong(transaction.transaction_date);
    elements["detail-created-at"].textContent = formatDateTime(transaction.created_at);

    openSheet("detail-sheet");
}

function clearFieldErrors() {
    [
        "edit-type-error",
        "edit-category-error",
        "edit-amount-error",
        "edit-date-error",
        "edit-note-error",
    ].forEach((id) => {
        const element = getElement(id);
        element.textContent = "";
    });
}

function setFieldError(fieldId, message) {
    getElement(`${fieldId}-error`).textContent = message;
}

function populateCategoryOptions(transactionType, selectedCategory = "") {
    const entries = getCategoryEntries(transactionType);
    elements["edit-category"].innerHTML = "";
    let hasSelectedCategory = false;

    if (entries.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "ไม่พบหมวดหมู่จากการตั้งค่า";
        option.disabled = true;
        option.selected = true;
        elements["edit-category"].appendChild(option);
        return;
    }

    entries.forEach(([categoryKey, config]) => {
        const option = document.createElement("option");
        option.value = categoryKey;
        option.textContent = `${config.icon ? `${config.icon} ` : ""}${config.label}`.trim();
        option.selected = categoryKey === selectedCategory;
        hasSelectedCategory = hasSelectedCategory || option.selected;
        elements["edit-category"].appendChild(option);
    });

    if (selectedCategory && !hasSelectedCategory) {
        const selectedConfig = getCategoryUi(transactionType, selectedCategory);
        const option = document.createElement("option");
        option.value = selectedCategory;
        option.textContent = `${selectedConfig.icon ? `${selectedConfig.icon} ` : ""}${selectedConfig.label} (ไม่ได้อยู่ในการตั้งค่า)`.trim();
        option.disabled = true;
        option.selected = true;
        elements["edit-category"].prepend(option);
    }
}

function openEditSheet(transactionId = state.selectedTransactionId) {
    const transaction = findTransactionById(transactionId);

    if (!transaction) {
        showError(new Error("ไม่พบข้อมูลรายการ"));
        return;
    }

    state.selectedTransactionId = transaction.id;
    clearFieldErrors();
    elements["edit-transaction-id"].value = transaction.id;
    elements["edit-type"].value = transaction.type;
    elements["edit-amount"].value = transaction.amount;
    elements["edit-date"].value = transaction.transaction_date;
    elements["edit-note"].value = transaction.note || "";
    populateCategoryOptions(transaction.type, transaction.category);
    openSheet("edit-sheet");
}

function validateEditForm() {
    clearFieldErrors();

    const type = elements["edit-type"].value;
    const category = elements["edit-category"].value;
    const amount = Number(elements["edit-amount"].value);
    const transactionDate = elements["edit-date"].value;
    const today = getBangkokTodayIso();
    let valid = true;

    if (!["income", "expense"].includes(type)) {
        setFieldError("edit-type", "กรุณาเลือกประเภทรายการ");
        valid = false;
    }

    if (!category) {
        setFieldError("edit-category", "กรุณาเลือกหมวดหมู่");
        valid = false;
    } else if (!isCategoryConfigured(type, category)) {
        setFieldError("edit-category", "กรุณาเลือกหมวดหมู่จากการตั้งค่า");
        valid = false;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        setFieldError("edit-amount", "จำนวนเงินต้องมากกว่า 0");
        valid = false;
    }

    if (!transactionDate) {
        setFieldError("edit-date", "กรุณาเลือกวันที่");
        valid = false;
    } else if (transactionDate > today) {
        setFieldError("edit-date", "ไม่สามารถเลือกวันที่ในอนาคตได้");
        valid = false;
    }

    return valid;
}

async function submitEdit(event) {
    event.preventDefault();

    if (!validateEditForm()) {
        return;
    }

    const transactionId = elements["edit-transaction-id"].value;
    const payload = {
        transaction_date: elements["edit-date"].value,
        type: elements["edit-type"].value,
        category: elements["edit-category"].value,
        amount: Number(elements["edit-amount"].value),
        note: elements["edit-note"].value.trim() || null,
    };

    elements["save-edit-button"].disabled = true;
    elements["save-edit-button"].textContent = "กำลังบันทึก...";

    try {
        await fetchJson(`/api/v1/liff/transactions/${encodeURIComponent(transactionId)}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        closeSheet();
        await refreshAllData({ forceHistoryAll: shouldLoadFullHistory() });
        showToast("แก้ไขรายการสำเร็จ");
    } catch (error) {
        showError(error);
    } finally {
        elements["save-edit-button"].disabled = false;
        elements["save-edit-button"].textContent = "บันทึกการเปลี่ยนแปลง";
    }
}

function openDeleteSheet(transactionId = state.selectedTransactionId) {
    const transaction = findTransactionById(transactionId);

    if (!transaction) {
        showError(new Error("ไม่พบข้อมูลรายการ"));
        return;
    }

    state.selectedTransactionId = transaction.id;
    const display = getTransactionDisplay(transaction);
    elements["delete-description"].textContent =
        `ต้องการลบ "${display.note}" (${display.amountText}) หรือไม่? รายการนี้จะถูกลบถาวรและไม่สามารถย้อนกลับได้`;
    openSheet("delete-sheet");
}

async function confirmDelete() {
    const transactionId = state.selectedTransactionId;

    if (!transactionId) {
        showError(new Error("ไม่พบข้อมูลรายการ"));
        return;
    }

    elements["confirm-delete-button"].disabled = true;
    elements["confirm-delete-button"].textContent = "กำลังลบ...";

    try {
        await fetchJson(`/api/v1/liff/transactions/${encodeURIComponent(transactionId)}`, {
            method: "DELETE",
        });

        closeSheet();
        state.selectedTransactionId = null;
        await refreshAllData({ forceHistoryAll: shouldLoadFullHistory() });
        showToast("ลบรายการสำเร็จ");
    } catch (error) {
        showError(error);
    } finally {
        elements["confirm-delete-button"].disabled = false;
        elements["confirm-delete-button"].textContent = "ลบรายการ";
    }
}

function updateFilterVisibility() {
    const mode = elements["filter-date-mode"].value;

    elements["filter-month-group"].classList.toggle("hidden", mode !== "month");
    elements["filter-date-group"].classList.toggle("hidden", mode !== "date");
    elements["filter-range-group"].classList.toggle("hidden", mode !== "range");
}

function syncFilterControlsFromState() {
    const typeInput = document.querySelector(`input[name="filter-type"][value="${state.history.type}"]`);
    if (typeInput) {
        typeInput.checked = true;
    }

    elements["filter-date-mode"].value = state.period.mode;
    elements["filter-month"].value = state.period.mode === "month"
        ? state.period.value
        : getBangkokTodayIso().slice(0, 7);
    elements["filter-date"].value = state.period.mode === "date"
        ? state.period.startDate
        : getBangkokTodayIso();
    elements["filter-start-date"].value = state.period.startDate || "";
    elements["filter-end-date"].value = state.period.endDate || "";
    elements["sort-select"].value = state.history.sort;
    updateFilterVisibility();
}

function readDateFilterFromForm() {
    const mode = elements["filter-date-mode"].value;
    const today = getBangkokTodayIso();

    if (mode === "all") {
        return {
            mode: "all",
            value: "",
            startDate: "",
            endDate: "",
        };
    }

    if (mode === "month") {
        const monthValue = elements["filter-month"].value;

        if (!monthValue) {
            throw new Error("กรุณาเลือกเดือน");
        }

        if (monthValue > today.slice(0, 7)) {
            throw new Error("ไม่สามารถเลือกเดือนในอนาคตได้");
        }

        return {
            mode,
            value: monthValue,
            ...getMonthRange(monthValue),
        };
    }

    if (mode === "date") {
        const dateValue = elements["filter-date"].value;

        if (!dateValue) {
            throw new Error("กรุณาเลือกวันที่");
        }

        if (dateValue > today) {
            throw new Error("ไม่สามารถเลือกวันที่ในอนาคตได้");
        }

        return {
            mode,
            value: dateValue,
            startDate: dateValue,
            endDate: dateValue,
        };
    }

    if (mode === "range") {
        const startDate = elements["filter-start-date"].value;
        const endDate = elements["filter-end-date"].value;

        if (!startDate || !endDate) {
            throw new Error("กรุณาเลือกช่วงวันที่ให้ครบ");
        }

        if (startDate > endDate) {
            throw new Error("วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด");
        }

        if (startDate > today || endDate > today) {
            throw new Error("ไม่สามารถเลือกวันที่ในอนาคตได้");
        }

        return {
            mode,
            value: "",
            startDate,
            endDate,
        };
    }

    throw new Error("รูปแบบตัวกรองไม่ถูกต้อง");
}

async function applyFilterForm(event) {
    event.preventDefault();

    const previousPeriod = { ...state.period };
    const previousType = state.history.type;
    const previousSort = state.history.sort;

    elements["apply-filter-button"].disabled = true;
    elements["apply-filter-button"].textContent = "กำลังกรอง...";

    try {
        const period = readDateFilterFromForm();
        const selectedType = document.querySelector("input[name='filter-type']:checked")?.value || "";

        state.period = period;
        state.history.type = selectedType;
        state.history.sort = elements["sort-select"].value || "newest";

        closeSheet();
        await refreshAllData({ forceHistoryAll: shouldLoadFullHistory() });
        showToast("ใช้ตัวกรองแล้ว");
    } catch (error) {
        state.period = previousPeriod;
        state.history.type = previousType;
        state.history.sort = previousSort;
        showError(error);
    } finally {
        elements["apply-filter-button"].disabled = false;
        elements["apply-filter-button"].textContent = "ใช้ตัวกรอง";
    }
}

async function resetFilters() {
    elements["reset-filter-button"].disabled = true;
    elements["reset-filter-button"].textContent = "กำลังล้าง...";

    try {
        state.period = {
            mode: "all",
            value: "",
            startDate: "",
            endDate: "",
        };
        state.history.type = "";
        state.history.sort = "newest";
        state.history.search = "";
        elements["transaction-search"].value = "";
        syncFilterControlsFromState();
        closeSheet();
        await refreshAllData();
        showToast("ล้างตัวกรองแล้ว");
    } catch (error) {
        showError(error);
    } finally {
        elements["reset-filter-button"].disabled = false;
        elements["reset-filter-button"].textContent = "ล้างตัวกรอง";
    }
}

async function setPeriodShortcut(shortcut) {
    const today = getBangkokTodayIso();
    const currentMonth = today.slice(0, 7);
    let nextPeriod;

    if (shortcut === "all") {
        nextPeriod = {
            mode: "all",
            value: "",
            startDate: "",
            endDate: "",
        };
    } else {
        const monthValue = shortcut === "last-month"
            ? getLastMonthValue(currentMonth)
            : currentMonth;
        nextPeriod = {
            mode: "month",
            value: monthValue,
            ...getMonthRange(monthValue),
        };
    }

    const previousPeriod = { ...state.period };
    state.period = nextPeriod;

    try {
        await refreshAllData({ forceHistoryAll: shouldLoadFullHistory() });
        showToast("เปลี่ยนช่วงเวลาแล้ว");
    } catch (error) {
        state.period = previousPeriod;
        updatePeriodButtons();
        showError(error);
    }
}

async function clearChip(action) {
    if (action === "period") {
        await setPeriodShortcut("this-month");
        return;
    }

    if (action === "type") {
        state.history.type = "";
    }

    if (action === "search") {
        state.history.search = "";
        elements["transaction-search"].value = "";
    }

    if (action === "sort") {
        state.history.sort = "newest";
    }

    try {
        await refreshAllData({ forceHistoryAll: shouldLoadFullHistory() });
        showToast("ปรับตัวกรองแล้ว");
    } catch (error) {
        showError(error);
    }
}

async function handleSearchInput() {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(async () => {
        state.history.search = elements["transaction-search"].value.trim();
        renderFilterChips();

        try {
            if (shouldLoadFullHistory()) {
                await loadHistory(true, { forceAll: true });
            } else {
                await loadHistory(true);
            }
        } catch (error) {
            showError(error);
        }
    }, 220);
}

async function loadProfile() {
    try {
        const profile = await window.liff.getProfile();
        elements["profile-name"].textContent = profile.displayName || "ผู้ใช้";

        if (profile.pictureUrl) {
            elements["profile-image"].src = profile.pictureUrl;
            elements["profile-image"].classList.remove("hidden");
        }
    } catch {
        elements["profile-name"].textContent = "ผู้ใช้";
    }
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

    state.categoryUi = config.category_ui || {};

    if (!window.liff) {
        throw new Error("ไม่สามารถโหลด LINE LIFF SDK ได้");
    }

    await window.liff.init({
        liffId: config.liff_id,
    });

    if (!window.liff.isLoggedIn()) {
        window.liff.login({
            redirectUri: window.location.href,
        });
        return;
    }

    state.lineIdToken = window.liff.getIDToken();

    if (!state.lineIdToken) {
        throw new Error("ไม่สามารถรับ LINE ID Token ได้ กรุณาเปิดหน้านี้ผ่าน LINE อีกครั้ง");
    }

    await loadProfile();
    showLoading("กำลังโหลดข้อมูล...");
    await refreshAllData();
    hideLoading();
}

function setupEvents() {
    document.querySelectorAll(".nav-button").forEach((button) => {
        button.addEventListener("click", () => setActiveTab(button.dataset.tab));
    });

    document.querySelectorAll("[data-period-shortcut]").forEach((button) => {
        button.addEventListener("click", async () => {
            if (button.classList.contains("active")) {
                return;
            }

            await setPeriodShortcut(button.dataset.periodShortcut);
        });
    });

    elements["view-all-button"].addEventListener("click", () => {
        setActiveTab("history");
    });

    elements["history-options-button"].addEventListener("click", () => {
        syncFilterControlsFromState();
        openSheet("filter-sheet");
    });

    elements["filter-date-mode"].addEventListener("change", updateFilterVisibility);
    elements["filter-form"].addEventListener("submit", applyFilterForm);
    elements["reset-filter-button"].addEventListener("click", resetFilters);
    elements["transaction-search"].addEventListener("input", handleSearchInput);

    elements["active-filter-chips"].addEventListener("click", async (event) => {
        const clearButton = event.target.closest("[data-clear-chip]");
        if (clearButton) {
            await clearChip(clearButton.dataset.clearChip);
        }
    });

    elements["load-more-button"].addEventListener("click", async () => {
        try {
            await loadHistory(false);
        } catch (error) {
            showError(error);
        }
    });

    elements["sheet-backdrop"].addEventListener("click", closeSheet);
    document.querySelectorAll("[data-close-sheet]").forEach((button) => {
        button.addEventListener("click", closeSheet);
    });

    elements["detail-edit-button"].addEventListener("click", () => {
        openEditSheet();
    });

    elements["detail-delete-button"].addEventListener("click", () => {
        openDeleteSheet();
    });

    elements["edit-type"].addEventListener("change", () => {
        populateCategoryOptions(elements["edit-type"].value);
    });

    elements["edit-transaction-form"].addEventListener("submit", submitEdit);
    elements["confirm-delete-button"].addEventListener("click", confirmDelete);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && state.activeSheetId) {
            closeSheet();
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    cacheElements();
    setInitialPeriod();
    setupEvents();
    updatePeriodButtons();
    renderFilterChips();

    try {
        await initializeLiff();
    } catch (error) {
        hideLoading();
        showError(error);
    }
});
