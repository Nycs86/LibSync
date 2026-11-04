import { useMemo, useState } from "react";
import "./library_reports.css";

const DAY_MS = 24 * 60 * 60 * 1000;

function toLocalDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromInput(value, endOfDay = false) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function firstDate(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (value) {
      const date = parseDate(value);
      if (date) return date;
    }
  }
  return null;
}

function getBorrowDate(record) {
  return firstDate(record, ["borrow_date", "borrowed_at", "issued_at", "approved_at", "requested_at", "created_at"]);
}

function getReturnDate(record) {
  return firstDate(record, ["returned_at", "return_date", "actual_return_date"]);
}

function getDueDate(record) {
  return firstDate(record, ["due_date", "expected_return_date"]);
}

function getBookTitle(record) {
  return record?.book_title || record?.title || (record?.book_id ? `Book #${record.book_id}` : "Untitled book");
}

function getBorrowerName(record) {
  return record?.student_name || record?.user_name || record?.borrower_name || (record?.user_id ? `User #${record.user_id}` : "Unknown borrower");
}

function getRecordStatus(record, today = new Date()) {
  const raw = String(record?.status || record?.record_status || record?.request_status || "").toLowerCase().replace(/[ -]+/g, "_");
  const returnedAt = getReturnDate(record);
  if (returnedAt || ["returned", "complete", "completed"].includes(raw)) return "returned";

  const dueDate = getDueDate(record);
  if (raw === "overdue" || (dueDate && dueDate < new Date(today.getFullYear(), today.getMonth(), today.getDate()))) return "overdue";
  if (["borrowed", "active", "checked_out", "issued", "approved"].includes(raw)) return "borrowed";
  return raw || "unknown";
}

function isInRange(date, start, end) {
  if (!date) return false;
  return (!start || date >= start) && (!end || date <= end);
}

function periodKey(date, granularity) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (granularity === "daily") return `${year}-${month}-${day}`;
  if (granularity === "yearly") return String(year);
  return `${year}-${month}`;
}

function periodLabel(key, granularity) {
  if (granularity === "yearly") return key;
  if (granularity === "daily") {
    const date = parseDate(`${key}T12:00:00`);
    return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : key;
  }
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function makeBuckets(startDate, endDate, granularity) {
  const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1);
  const end = endDate || new Date();
  const buckets = [];
  let cursor;

  if (granularity === "daily") {
    cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const limit = Math.min(3650, Math.max(1, Math.floor((end - cursor) / DAY_MS) + 1));
    for (let index = 0; index < limit; index += 1) {
      const date = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + index);
      const key = periodKey(date, granularity);
      buckets.push({ key, label: periodLabel(key, granularity), borrowed: 0, returned: 0, overdue: 0 });
    }
  } else if (granularity === "yearly") {
    const firstYear = start.getFullYear();
    const lastYear = end.getFullYear();
    const first = Math.max(firstYear, lastYear - 9);
    for (let year = first; year <= lastYear; year += 1) {
      buckets.push({ key: String(year), label: String(year), borrowed: 0, returned: 0, overdue: 0 });
    }
  } else {
    cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const months = Math.min(120, Math.max(1, (end.getFullYear() - cursor.getFullYear()) * 12 + end.getMonth() - cursor.getMonth() + 1));
    for (let index = 0; index < months; index += 1) {
      const date = new Date(cursor.getFullYear(), cursor.getMonth() + index, 1);
      const key = periodKey(date, granularity);
      buckets.push({ key, label: periodLabel(key, granularity), borrowed: 0, returned: 0, overdue: 0 });
    }
  }
  return buckets;
}

function TrendChart({ buckets }) {
  const width = 760;
  const height = 250;
  const left = 40;
  const right = 20;
  const top = 20;
  const bottom = 42;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  const maxValue = Math.max(1, ...buckets.flatMap((bucket) => [bucket.borrowed, bucket.returned]));
  const pointX = (index) => buckets.length <= 1 ? left + innerWidth / 2 : left + (index / (buckets.length - 1)) * innerWidth;
  const pointY = (value) => top + innerHeight - (value / maxValue) * innerHeight;
  const borrowedPoints = buckets.map((bucket, index) => `${pointX(index)},${pointY(bucket.borrowed)}`).join(" ");
  const returnedPoints = buckets.map((bucket, index) => `${pointX(index)},${pointY(bucket.returned)}`).join(" ");
  const labelStep = Math.max(1, Math.ceil(buckets.length / 8));

  return (
    <div className="lr-trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Borrowed and returned book trends">
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = top + innerHeight * fraction;
          const label = Math.round(maxValue * (1 - fraction));
          return <g key={fraction}><line x1={left} y1={y} x2={width - right} y2={y} className="lr-chart-gridline" /><text x={left - 10} y={y + 4} textAnchor="end" className="lr-chart-axis-label">{label}</text></g>;
        })}
        {buckets.length > 0 && <>
          <polyline points={borrowedPoints} className="lr-line-borrowed" />
          <polyline points={returnedPoints} className="lr-line-returned" />
          {buckets.map((bucket, index) => <g key={bucket.key}>
            <circle cx={pointX(index)} cy={pointY(bucket.borrowed)} r="4" className="lr-point-borrowed" />
            <circle cx={pointX(index)} cy={pointY(bucket.returned)} r="4" className="lr-point-returned" />
            {(index % labelStep === 0 || index === buckets.length - 1) && <text x={pointX(index)} y={height - 13} textAnchor="middle" className="lr-chart-axis-label">{bucket.label}</text>}
          </g>)}
        </>}
      </svg>
      <div className="lr-chart-legend"><span><i className="lr-legend-borrowed" />Borrowed</span><span><i className="lr-legend-returned" />Returned</span></div>
    </div>
  );
}

const REPORT_COLORS = [
  "#0F8B72", // emerald teal
  "#3978D5", // blue
  "#8B5CF6", // violet
  "#F0A23B", // amber
  "#E66B5B", // coral
  "#18A3B8", // cyan
  "#D65391", // rose
  "#7D9B45", // olive
  "#64748B", // slate
  "#B7791F", // ochre
];

function colorForStatus(label, index) {
  const value = String(label || "").toLowerCase();
  if (value.includes("approved") || value.includes("returned") || value.includes("available")) return "#0F8B72";
  if (value.includes("pending") || value.includes("reserved")) return "#F0A23B";
  if (value.includes("declined") || value.includes("rejected") || value.includes("overdue") || value.includes("unavailable")) return "#E66B5B";
  if (value.includes("borrowed")) return "#3978D5";
  if (value.includes("cancel")) return "#8B5CF6";
  return REPORT_COLORS[index % REPORT_COLORS.length];
}

function DonutChart({ items, emptyText }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const colors = items.map((item, index) => colorForStatus(item.label, index));
 
  const stops = items.map((item, index) => {
    const startValue = items.slice(0, index).reduce((sum, previousItem) => sum + previousItem.value, 0);
    const endValue = startValue + item.value;
    const start = total > 0 ? (startValue / total) * 100 : 0;
    const end = total > 0 ? (endValue / total) * 100 : 0;
    return `${colors[index]} ${start}% ${end}%`;
  });
  return (
    <div className="lr-donut-layout">
      {total > 0 ? <div className="lr-donut" style={{ background: `conic-gradient(${stops.join(", ")})` }}><div className="lr-donut-hole"><strong>{total}</strong><span>Total</span></div></div> : <div className="lr-donut-empty">No data</div>}
      <div className="lr-donut-legend">
        {items.map((item, index) => <div className="lr-donut-legend-row" key={item.label}><span className="lr-donut-swatch" style={{ background: colors[index] }} /><span>{item.label}</span><strong>{item.value}</strong></div>)}
        {total === 0 && <p>{emptyText}</p>}
      </div>
    </div>
  );
}

function VerticalBarChart({ items, emptyText, valueLabel = "records" }) {
  if (!items.length) return <div className="lr-empty-chart">{emptyText}</div>;

  const width = 720;
  const height = 258;
  const left = 42;
  const right = 14;
  const top = 22;
  const bottom = 58;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  const maxValue = Math.max(1, ...items.map((item) => item.value));
  const slot = innerWidth / items.length;
  const barWidth = Math.min(48, slot * 0.58);
  const labelStep = Math.max(1, Math.ceil(items.length / 9));
  const tickValues = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="lr-column-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${valueLabel} by category or period`}>
        {tickValues.map((fraction) => {
          const y = top + innerHeight * fraction;
          return <g key={fraction}><line x1={left} y1={y} x2={width - right} y2={y} className="lr-chart-gridline"/><text x={left - 9} y={y + 4} textAnchor="end" className="lr-chart-axis-label">{Math.round(maxValue * (1 - fraction))}</text></g>;
        })}
        {items.map((item, index) => {
          const barHeight = (item.value / maxValue) * innerHeight;
          const x = left + slot * index + (slot - barWidth) / 2;
          const y = top + innerHeight - barHeight;
          const label = item.label.length > 13 ? `${item.label.slice(0, 12)}…` : item.label;
          const gradientIndex = index % REPORT_COLORS.length;
          return <g key={`${item.label}-${index}`}>
            <title>{`${item.label}: ${item.value} ${valueLabel}`}</title>
            <rect x={x} y={top} width={barWidth} height={innerHeight} rx="7" className="lr-column-track" />
            <rect x={x} y={y} width={barWidth} height={Math.max(0, barHeight)} rx="7" fill={REPORT_COLORS[gradientIndex]} className="lr-column-bar" />
            <text x={x + barWidth / 2} y={Math.max(13, y - 8)} textAnchor="middle" className="lr-column-value">{item.value}</text>
            {(index % labelStep === 0 || index === items.length - 1) && <text x={x + barWidth / 2} y={height - 22} textAnchor="middle" className="lr-chart-axis-label">{label}</text>}
          </g>;
        })}
      </svg>
      <p className="lr-column-caption">{valueLabel}</p>
    </div>
  );
}

function HorizontalBars({ items, emptyText, valueLabel = "records" }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  if (!items.length) return <div className="lr-empty-chart">{emptyText}</div>;
  return <div className="lr-horizontal-bars">{items.map((item, index) => {
    const color = REPORT_COLORS[index % REPORT_COLORS.length];
    return <div className="lr-bar-row" key={`${item.label}-${index}`}>
      <span className="lr-bar-rank" style={{ color, background: `${color}18` }}>{index + 1}</span>
      <div className="lr-bar-content"><div className="lr-bar-label"><span title={item.label}>{item.label}</span><strong style={{ color }}>{item.value}</strong></div><div className="lr-bar-track"><span style={{ width: `${(item.value / max) * 100}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }} /></div></div>
      <span className="lr-bar-value-label">{valueLabel}</span>
    </div>;
  })}</div>;
}

function formatDisplayDate(value) {
  const date = parseDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" });
}

export default function LibraryReports({ books = [], borrowings = [], requests = [], loading = false, error = "", onRefresh }) {
  const currentDate = new Date();
  const initialStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 5, 1);
  const [granularity, setGranularity] = useState("monthly");
  const [startInput, setStartInput] = useState(toLocalDateInput(initialStart));
  const [endInput, setEndInput] = useState(toLocalDateInput(currentDate));
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");

  const startDate = useMemo(() => dateFromInput(startInput), [startInput]);
  const endDate = useMemo(() => dateFromInput(endInput, true), [endInput]);

  const bookMap = useMemo(() => {
    const map = new Map();
    books.forEach((book) => map.set(String(book.id ?? book.book_id ?? ""), book));
    return map;
  }, [books]);

  const qrRequestIds = useMemo(() => new Set(
    requests.filter((request) => request.qr_token).map((request) => String(request.id ?? request.request_id ?? ""))
  ), [requests]);
  const qrMetadataAvailableFromRequests = useMemo(() => requests.some((request) => Object.prototype.hasOwnProperty.call(request, "qr_token")), [requests]);

  const normalizedRecords = useMemo(() => borrowings.map((record, index) => {
    const book = bookMap.get(String(record.book_id ?? ""));
    const borrowDate = getBorrowDate(record);
    const returnDate = getReturnDate(record);
    const dueDate = getDueDate(record);
    const category = record.category || record.book_category || book?.category || "Uncategorized";
    const sourceValue = [record.source, record.method, record.borrow_method, record.transaction_source, record.qr_source].filter(Boolean).join(" ").toLowerCase();
    const requestId = record.request_id ?? record.id;
    const qrTracked = Boolean(record.qr_token || record.qr_code || /qr/.test(sourceValue) || qrRequestIds.has(String(requestId ?? "")));
    const hasQrMetadata = Boolean(record.qr_token || record.qr_code || qrMetadataAvailableFromRequests || [record.source, record.method, record.borrow_method, record.transaction_source, record.qr_source].some((value) => typeof value === "string" && value.trim()));
    return {
      id: record.id ?? record.borrowing_id ?? record.request_id ?? `${record.user_id ?? "u"}-${record.book_id ?? "b"}-${index}`,
      borrower: getBorrowerName(record),
      borrowerId: record.student_id ?? record.user_id ?? "",
      borrowerEmail: record.student_email ?? record.user_email ?? "",
      title: getBookTitle(record),
      bookId: record.book_id ?? "",
      author: record.book_author || record.author || book?.author || "",
      category,
      borrowDate,
      dueDate,
      returnDate,
      status: getRecordStatus(record),
      raw: record,
      qrTracked,
      hasQrMetadata,
    };
  }), [borrowings, bookMap, qrRequestIds, qrMetadataAvailableFromRequests]);

  const categories = useMemo(() => [...new Set(normalizedRecords.map((record) => record.category).filter((category) => category && category !== "Uncategorized"))].sort((a, b) => a.localeCompare(b)), [normalizedRecords]);

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    return normalizedRecords.filter((record) => {
      const dateMatches = (!startDate && !endDate) || isInRange(record.borrowDate, startDate, endDate);
      const statusMatches = statusFilter === "all" || record.status === statusFilter;
      const categoryMatches = categoryFilter === "all" || record.category === categoryFilter;
      const textMatches = !term || [record.borrower, record.borrowerId, record.borrowerEmail, record.title, record.author, record.category].some((value) => String(value ?? "").toLowerCase().includes(term));
      return dateMatches && statusMatches && categoryMatches && textMatches;
    }).sort((a, b) => (b.borrowDate?.getTime() || 0) - (a.borrowDate?.getTime() || 0));
  }, [normalizedRecords, startDate, endDate, statusFilter, categoryFilter, search]);

  const report = useMemo(() => {
    const filteredRequests = requests.filter((request) => {
      const date = firstDate(request, ["requested_at", "created_at", "approved_at"]);
      return !date || isInRange(date, startDate, endDate);
    });
    const borrowed = filteredRecords.filter((record) => record.status === "borrowed").length;
    const returned = filteredRecords.filter((record) => record.status === "returned").length;
    const overdue = filteredRecords.filter((record) => record.status === "overdue").length;
    const pending = filteredRequests.filter((request) => String(request.status || "").toLowerCase() === "pending").length;

    const trendBuckets = makeBuckets(startDate, endDate, granularity);
    const bucketMap = new Map(trendBuckets.map((bucket) => [bucket.key, bucket]));
    normalizedRecords.forEach((record) => {
      if (record.borrowDate && isInRange(record.borrowDate, startDate, endDate)) {
        const bucket = bucketMap.get(periodKey(record.borrowDate, granularity));
        if (bucket) bucket.borrowed += 1;
      }
      if (record.returnDate && isInRange(record.returnDate, startDate, endDate)) {
        const bucket = bucketMap.get(periodKey(record.returnDate, granularity));
        if (bucket) bucket.returned += 1;
      }
      if (record.status === "overdue" && record.dueDate && isInRange(record.dueDate, startDate, endDate)) {
        const bucket = bucketMap.get(periodKey(record.dueDate, granularity));
        if (bucket) bucket.overdue += 1;
      }
    });

    const bookCounts = new Map();
    const borrowerCounts = new Map();
    const categoryCounts = new Map();
    filteredRecords.forEach((record) => {
      bookCounts.set(record.title, (bookCounts.get(record.title) || 0) + 1);
      borrowerCounts.set(record.borrower, (borrowerCounts.get(record.borrower) || 0) + 1);
      if (record.category !== "Uncategorized") categoryCounts.set(record.category, (categoryCounts.get(record.category) || 0) + 1);
    });

    const topBooks = Array.from(bookCounts, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)).slice(0, 10);
    const activeBorrowers = Array.from(borrowerCounts, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)).slice(0, 10);
    const topCategories = Array.from(categoryCounts, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)).slice(0, 8);

    const inventoryTotals = books.reduce((totals, book) => {
      const quantity = Math.max(0, Number(book.quantity ?? 0));
      const hasAvailable = book.available_quantity !== undefined && book.available_quantity !== null;
      const available = Math.max(0, Number(hasAvailable ? book.available_quantity : quantity));
      const reserved = Math.max(0, Number(book.reserved_quantity ?? book.reserved_copies ?? 0));
      const unavailable = Math.max(0, Number(book.unavailable_quantity ?? book.damaged_quantity ?? book.unavailable_copies ?? 0));
      const borrowedCopies = Math.max(0, quantity - available - reserved - unavailable);
      totals.available += available;
      totals.borrowed += borrowedCopies;
      totals.reserved += reserved;
      totals.unavailable += unavailable;
      totals.total += quantity;
      return totals;
    }, { available: 0, borrowed: 0, reserved: 0, unavailable: 0, total: 0 });
    const inventoryItems = [
      { label: "Available", value: inventoryTotals.available },
      { label: "Borrowed", value: inventoryTotals.borrowed },
      ...(inventoryTotals.reserved > 0 ? [{ label: "Reserved", value: inventoryTotals.reserved }] : []),
      ...(inventoryTotals.unavailable > 0 ? [{ label: "Unavailable", value: inventoryTotals.unavailable }] : []),
    ];

    const requestStatusMap = new Map();
    filteredRequests.forEach((request) => {
      const label = String(request.status || "unknown").replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
      requestStatusMap.set(label, (requestStatusMap.get(label) || 0) + 1);
    });
    const requestStatuses = Array.from(requestStatusMap, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

    const qrMetadataAvailable = normalizedRecords.some((record) => record.hasQrMetadata);
    const qrCount = filteredRecords.filter((record) => record.qrTracked).length;

    return {
      totalRecords: filteredRecords.length,
      borrowed,
      returned,
      overdue,
      pending,
      trendBuckets,
      topBooks,
      activeBorrowers,
      topCategories,
      inventoryTotals,
      inventoryItems,
      requestStatuses,
      qrMetadataAvailable,
      qrCount,
    };
  }, [books, filteredRecords, normalizedRecords, requests, startDate, endDate, granularity]);

  const overdueByPeriod = useMemo(() => report.trendBuckets.map((bucket) => ({ label: bucket.label, value: bucket.overdue })), [report.trendBuckets]);

  const resetFilters = () => {
    const now = new Date();
    setGranularity("monthly");
    setStartInput(toLocalDateInput(new Date(now.getFullYear(), now.getMonth() - 5, 1)));
    setEndInput(toLocalDateInput(now));
    setStatusFilter("all");
    setCategoryFilter("all");
    setSearch("");
  };

  const changeGranularity = (value) => {
    const now = new Date();
    setGranularity(value);
    if (value === "daily") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      setStartInput(toLocalDateInput(start));
    } else if (value === "yearly") {
      setStartInput(toLocalDateInput(new Date(now.getFullYear() - 4, 0, 1)));
    } else {
      setStartInput(toLocalDateInput(new Date(now.getFullYear(), now.getMonth() - 11, 1)));
    }
    setEndInput(toLocalDateInput(now));
  };

  const exportCsv = () => {
    const headers = ["Borrower", "Student ID", "Email", "Book Title", "Author", "Category", "Borrow Date", "Due Date", "Return Date", "Status", "QR Tracked"];
    const rows = filteredRecords.map((record) => [record.borrower, record.borrowerId, record.borrowerEmail, record.title, record.author, record.category, record.borrowDate ? toLocalDateInput(record.borrowDate) : "", record.dueDate ? toLocalDateInput(record.dueDate) : "", record.returnDate ? toLocalDateInput(record.returnDate) : "", record.status, record.qrTracked ? "Yes" : "No"]);
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `libsync-borrowing-report-${toLocalDateInput(new Date())}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const totalInventory = report.inventoryTotals.total;

  return (
    <section className="lr-reports-page" aria-label="Library Reports and Analytics">
      <div className="lr-report-toolbar-card">
        <div>
          <h2>Library Reports</h2>
          <p>Centralized library performance, inventory, borrowing, returns, and student usage.</p>
        </div>
        <div className="lr-toolbar-actions">
          <button type="button" className="lr-outline-button" onClick={resetFilters}><i className="bi bi-arrow-counterclockwise" />Reset filters</button>
          <button type="button" className="lr-refresh-button" onClick={onRefresh} disabled={!onRefresh || loading}><i className={`bi bi-arrow-clockwise ${loading ? "lr-spin" : ""}`} />Refresh data</button>
        </div>
      </div>

      {error && <div className="lr-feedback lr-feedback-error" role="alert">{error}</div>}

      <div className="lr-filter-panel">
        <div className="lr-filter-title"><strong>Report filters</strong><span>Choose a time scale and refine the report data.</span></div>
        <div className="lr-filter-controls">
          <label><span>Report interval</span><select value={granularity} onChange={(event) => changeGranularity(event.target.value)}><option value="daily">Daily</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
          <label><span>From date</span><input type="date" value={startInput} max={endInput || undefined} onChange={(event) => setStartInput(event.target.value)} /></label>
          <label><span>To date</span><input type="date" value={endInput} min={startInput || undefined} onChange={(event) => setEndInput(event.target.value)} /></label>
          <label><span>Borrowing status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="borrowed">Borrowed</option><option value="returned">Returned</option><option value="overdue">Overdue</option></select></label>
          <label><span>Book category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label className="lr-search-filter"><span>Search records</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Student, book, author, ID..." /></label>
        </div>
      </div>

      <div className="lr-stat-grid">
        <ReportStat icon="bi-book" label="Book Titles" value={books.length} />
        <ReportStat icon="bi-collection" label="Total Copies" value={totalInventory.toLocaleString()} />
        <ReportStat icon="bi-journal-check" label="Borrowing Records" value={report.totalRecords} />
        <ReportStat icon="bi-arrow-left-right" label="Currently Borrowed" value={report.borrowed} />
        <ReportStat icon="bi-check-circle" label="Returned Books" value={report.returned} />
        <ReportStat icon="bi-exclamation-triangle" label="Overdue Books" value={report.overdue} tone="warning" />
        <ReportStat icon="bi-clock" label="Pending Requests" value={report.pending} />
        <ReportStat icon="bi-qr-code-scan" label="QR-Tracked Borrowings" value={report.qrMetadataAvailable ? report.qrCount : "—"} note={report.qrMetadataAvailable ? "Transactions explicitly marked as QR" : "QR source is not included in the current API data"} />
      </div>

      {loading && borrowings.length === 0 && books.length === 0 ? <div className="lr-loading">Loading library report data...</div> : null}

      <div className="lr-report-grid lr-report-grid-trends">
        <article className="lr-report-card">
          <ReportHeading title="Borrowing and Return Trends" subtitle="Compare borrowing and return activity over the selected period." />
          <TrendChart buckets={report.trendBuckets} />
          <p className="lr-chart-footnote">Borrowing is grouped by borrow date; returns are grouped by actual return date. The selected interval controls the chart scale.</p>
        </article>
        <article className="lr-report-card">
          <ReportHeading title="Book Inventory Distribution" subtitle="Current copy availability from the book catalog." />
          <DonutChart items={report.inventoryItems} emptyText="No inventory quantities were returned by the books API." />
          <p className="lr-chart-footnote">Borrowed copies are estimated from total quantity minus available, reserved, and unavailable copies where those fields exist.</p>
        </article>
      </div>

      <div className="lr-report-grid lr-report-grid-secondary">
        <article className="lr-report-card">
          <ReportHeading title="Most Borrowed Book Categories" subtitle="Categories ranked by borrowing records in the selected date range." />
          <VerticalBarChart items={report.topCategories} emptyText="Category data is not available in the current borrowing and book records." valueLabel="borrows" />
        </article>
        <article className="lr-report-card">
          <ReportHeading title="Borrowing Request Status" subtitle="Request statuses recorded within the selected date range." />
          <DonutChart items={report.requestStatuses} emptyText="No request status data is available for this period." />
        </article>
      </div>

      <div className="lr-report-grid lr-report-grid-secondary">
        <article className="lr-report-card">
          <ReportHeading title="Top 10 Most Borrowed Books" subtitle="Book titles with the highest number of borrowing records." />
          <HorizontalBars items={report.topBooks} emptyText="No borrowing records are available for this period." valueLabel="borrows" />
        </article>
        <article className="lr-report-card">
          <ReportHeading title="Overdue Books Analysis" subtitle="Overdue transactions grouped by the selected due-date interval." />
          <VerticalBarChart items={overdueByPeriod.filter((item) => item.value > 0)} emptyText="No overdue records in the selected period." valueLabel="overdue" />
        </article>
      </div>

      <article className="lr-report-card lr-report-full-card">
        <ReportHeading title="Most Active Borrowers" subtitle="Borrowers ranked by borrowing records in the selected date range." />
        <HorizontalBars items={report.activeBorrowers} emptyText="No borrower activity is available for this period." valueLabel="records" />
      </article>

      <article className="lr-report-card lr-detail-report-card">
        <div className="lr-detail-heading">
          <ReportHeading title="Detailed Borrowing Report" subtitle={`${filteredRecords.length} records match the current filters.`} />
          <button type="button" className="lr-export-button" onClick={exportCsv} disabled={!filteredRecords.length}><i className="bi bi-file-earmark-spreadsheet" />Export CSV</button>
        </div>
        <div className="lr-table-wrap">
          <table className="lr-report-table">
            <thead><tr><th>Borrower</th><th>Book Title</th><th>Category</th><th>Borrow Date</th><th>Due Date</th><th>Return Date</th><th>Status</th></tr></thead>
            <tbody>
              {filteredRecords.map((record) => <tr key={record.id}><td><strong>{record.borrower}</strong><small>{record.borrowerId ? `ID: ${record.borrowerId}` : record.borrowerEmail || ""}</small></td><td>{record.title}</td><td>{record.category}</td><td>{formatDisplayDate(record.borrowDate)}</td><td>{formatDisplayDate(record.dueDate)}</td><td>{formatDisplayDate(record.returnDate)}</td><td><span className={`lr-status-pill lr-status-pill-${record.status}`}>{record.status.replace(/_/g, " ")}</span></td></tr>)}
              {!filteredRecords.length && <tr><td colSpan="7" className="lr-empty-cell">No borrowing records match the selected filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="lr-table-footer"><span>Data is based on records returned by the current LibSync APIs.</span><span>Inventory total: {totalInventory.toLocaleString()}</span></div>
      </article>
    </section>
  );
}

function ReportStat({ icon, label, value, note, tone }) {
  return <article className={`lr-report-stat ${tone === "warning" ? "lr-report-stat-warning" : ""}`}><span className="lr-report-stat-icon"><i className={`bi ${icon}`} aria-hidden="true" /></span><div><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div></article>;
}

function ReportHeading({ title, subtitle }) {
  return <header className="lr-report-heading"><div><h3>{title}</h3><p>{subtitle}</p></div></header>;
}
