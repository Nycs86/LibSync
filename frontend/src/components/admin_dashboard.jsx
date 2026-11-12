import { useCallback, useEffect, useMemo, useState } from "react";
import LibraryReports from "./library_reports";
import { api, getStoredUser } from "../services/api";
import "./admin_dashboard.css";

function AdminDashboard({ onLogout }) {
  const user = getStoredUser();

  const [activeSection, setActiveSection] = useState("dashboard");
  const [users, setUsers] = useState([]);
  const [books, setBooks] = useState([]);
  const [borrowings, setBorrowings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [performanceStudents, setPerformanceStudents] = useState([]);
  const [performanceSummary, setPerformanceSummary] = useState({
    total_students: 0,
    high_performance: 0,
    medium_performance: 0,
    low_performance: 0,
  });
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const [performanceError, setPerformanceError] = useState("");

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentEditorOpen, setStudentEditorOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentForm, setStudentForm] = useState({
    name: "",
    email: "",
    student_number: "",
    program: "",
    college: "",
    year_level: "",
    gender: "",
  });
  const [studentSaving, setStudentSaving] = useState(false);
  const [studentDeletingId, setStudentDeletingId] = useState(null);
  const [librarianEditorOpen, setLibrarianEditorOpen] = useState(false);
  const [editingLibrarian, setEditingLibrarian] = useState(null);
  const [librarianForm, setLibrarianForm] = useState({ name: "", email: "" });
  const [librarianSaving, setLibrarianSaving] = useState(false);
  const [librarianDeletingId, setLibrarianDeletingId] = useState(null);


  // All dashboard requests use the shared API client.
  // It automatically attaches the current Admin JWT from sessionStorage.
  const fetchUsers = useCallback(async () => {
    const data = await api.get("/api/users");
    return Array.isArray(data) ? data : data.users || [];
  }, []);

  const fetchBooks = useCallback(async () => {
    const data = await api.get("/api/books");
    return Array.isArray(data) ? data : data.books || [];
  }, []);

  const fetchBorrowings = useCallback(async () => {
    const data = await api.get("/api/borrowings");
    return Array.isArray(data) ? data : data.borrowings || [];
  }, []);

  const fetchBorrowRequests = useCallback(async () => {
    const data = await api.get("/api/borrow-requests");
    return Array.isArray(data) ? data : data.requests || [];
  }, []);

  const fetchReturnPerformance = useCallback(async () => {
    const data = await api.get("/api/admin/return-performance");
    return {
      students: Array.isArray(data?.students) ? data.students : [],
      summary: data?.summary || {
        total_students: 0,
        high_performance: 0,
        medium_performance: 0,
        low_performance: 0,
      },
    };
  }, []);

  const loadReturnPerformance = useCallback(async () => {
    try {
      setPerformanceLoading(true);
      setPerformanceError("");
      const data = await fetchReturnPerformance();
      setPerformanceStudents(data.students);
      setPerformanceSummary(data.summary);
    } catch (error) {
      console.error("Load return performance error:", error);
      setPerformanceStudents([]);
      setPerformanceSummary({
        total_students: 0,
        high_performance: 0,
        medium_performance: 0,
        low_performance: 0,
      });
      setPerformanceError(error.message || "Unable to load return performance data.");
    } finally {
      setPerformanceLoading(false);
    }
  }, [fetchReturnPerformance]);

  // Used by the manual Refresh button. Each setter runs only after all
  // requested data has been received successfully.
  const loadDashboard = useCallback(async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) {
        setLoading(true);
        setMessage("");
      }

      const [usersData, booksData, borrowingsData, requestsData] =
        await Promise.all([
          fetchUsers(),
          fetchBooks(),
          fetchBorrowings(),
          fetchBorrowRequests(),
        ]);

      setUsers(usersData);
      setBooks(booksData);
      setBorrowings(borrowingsData);
      setRequests(requestsData);

      void loadReturnPerformance();
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, fetchBooks, fetchBorrowings, fetchBorrowRequests, loadReturnPerformance]);

  // Initial loading: fetch first, then update React state after the awaits.
  useEffect(() => {
    let cancelled = false;

    const initializeDashboard = async () => {
      try {
        const [usersData, booksData, borrowingsData, requestsData] =
          await Promise.all([
            fetchUsers(),
            fetchBooks(),
            fetchBorrowings(),
            fetchBorrowRequests(),
          ]);

        if (cancelled) return;

        setUsers(usersData);
        setBooks(booksData);
        setBorrowings(borrowingsData);
        setRequests(requestsData);

        void loadReturnPerformance();
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setMessage(error.message || "Unable to load dashboard data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    initializeDashboard();

    return () => {
      cancelled = true;
    };
  }, [fetchUsers, fetchBooks, fetchBorrowings, fetchBorrowRequests, loadReturnPerformance]);

  const students = useMemo(
    () => users.filter((account) => account.role === "student"),
    [users]
  );

  const librarians = useMemo(
    () => users.filter((account) => account.role === "librarian"),
    [users]
  );

  const stats = useMemo(() => {
    const activeBorrowings = borrowings.filter(
      (item) => getBorrowingStatus(item) === "borrowed"
    ).length;

    const overdueBooks = borrowings.filter(
      (item) => getBorrowingStatus(item) === "overdue"
    ).length;

    const pendingRequests = requests.filter(
      (item) => String(item.status || "").toLowerCase() === "pending"
    ).length;

    const availableBooks = books.reduce(
      (total, book) => total + Number(book.available_quantity ?? book.quantity ?? 0),
      0
    );

    const totalCopies = books.reduce(
      (total, book) => total + Number(book.quantity || 0),
      0
    );

    return {
      students: students.length,
      librarians: librarians.length,
      books: books.length,
      activeBorrowings,
      overdueBooks,
      pendingRequests,
      availableBooks,
      totalCopies,
      borrowedCopies: Math.max(0, totalCopies - availableBooks),
    };
  }, [students, librarians, books, borrowings, requests]);

  const monthlyBorrowingActivity = useMemo(() => {
    const now = new Date();
    const monthStarts = Array.from({ length: 6 }, (_, index) =>
      new Date(now.getFullYear(), now.getMonth() - 5 + index, 1)
    );

    return monthStarts.map((monthStart) => {
      const nextMonth = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth() + 1,
        1
      );

      const value = borrowings.filter((record) => {
        const rawDate =
          record.borrowed_at ||
          record.borrow_date ||
          record.approved_at ||
          record.requested_at;
        if (!rawDate) return false;

        const date = new Date(rawDate);
        return (
          !Number.isNaN(date.getTime()) &&
          date >= monthStart &&
          date < nextMonth
        );
      }).length;

      return {
        label: monthStart.toLocaleDateString(undefined, { month: "short" }),
        value,
      };
    });
  }, [borrowings]);

  const borrowingTrend = useMemo(() => {
    const current = monthlyBorrowingActivity[5]?.value || 0;
    const previous = monthlyBorrowingActivity[4]?.value || 0;

    if (previous === 0 && current > 0) {
      return { label: "New activity", tone: "positive" };
    }
    if (previous === 0 && current === 0) {
      return { label: "No activity yet", tone: "neutral" };
    }

    const change = Math.round(((current - previous) / previous) * 100);
    return {
      label: `${change > 0 ? "+" : ""}${change}% vs previous month`,
      tone: change > 0 ? "positive" : change < 0 ? "negative" : "neutral",
    };
  }, [monthlyBorrowingActivity]);

  const borrowingStatusItems = useMemo(() => {
    const counts = {
      borrowed: borrowings.filter((item) => getBorrowingStatus(item) === "borrowed").length,
      overdue: borrowings.filter((item) => getBorrowingStatus(item) === "overdue").length,
      returned: borrowings.filter((item) => getBorrowingStatus(item) === "returned").length,
      other: borrowings.filter((item) => getBorrowingStatus(item) === "other").length,
    };

    return [
      { label: "Currently borrowed", value: counts.borrowed, color: "#14956F" },
      { label: "Overdue", value: counts.overdue, color: "#E5A14A" },
      { label: "Returned", value: counts.returned, color: "#75B7E8" },
      { label: "Other", value: counts.other, color: "#A5AEA9" },
    ].filter((item) => item.value > 0);
  }, [borrowings]);

  const inventoryStatusItems = useMemo(() => [
    { label: "Available copies", value: stats.availableBooks, color: "#22B983" },
    { label: "Borrowed copies", value: stats.borrowedCopies, color: "#80B7E8" },
  ].filter((item) => item.value > 0), [stats.availableBooks, stats.borrowedCopies]);

  const categoryPerformance = useMemo(() => {
    const categories = new Map();

    books.forEach((book) => {
      const category = String(book.category || "Uncategorized").trim() || "Uncategorized";
      const current = categories.get(category) || {
        name: category,
        titles: 0,
        copies: 0,
        available: 0,
      };

      current.titles += 1;
      current.copies += Number(book.quantity || 0);
      current.available += Number(book.available_quantity ?? book.quantity ?? 0);
      categories.set(category, current);
    });

    return Array.from(categories.values())
      .map((item) => ({
        ...item,
        availability: item.copies > 0
          ? Math.round((item.available / item.copies) * 100)
          : 0,
      }))
      .sort((a, b) => b.copies - a.copies || a.name.localeCompare(b.name))
      .slice(0, 5);
  }, [books]);

  const displayedPerformanceStudents = useMemo(
    () => [...performanceStudents].sort(
      (a, b) =>
        Number(a.performance_score ?? 100) - Number(b.performance_score ?? 100) ||
        String(a.name || "").localeCompare(String(b.name || ""))
    ),
    [performanceStudents]
  );

  // The Users section is dedicated to student accounts only.
  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return students;

    return students.filter(
      (student) =>
        student.name?.toLowerCase().includes(term) ||
        student.email?.toLowerCase().includes(term) ||
        String(student.id).includes(term) ||
        student.student_number?.toLowerCase().includes(term) ||
        student.program?.toLowerCase().includes(term) ||
        student.college?.toLowerCase().includes(term)
    );
  }, [students, search]);

  const assignCandidates = useMemo(() => {
    const term = assignSearch.trim().toLowerCase();

    if (!term) return students.slice(0, 6);

    return students
      .filter(
        (student) =>
          student.name?.toLowerCase().includes(term) ||
          student.email?.toLowerCase().includes(term)
      )
      .slice(0, 6);
  }, [students, assignSearch]);

  const addStudentAsLibrarian = async (studentId) => {
    try {
      setMessage("");

      const data = await api.put(`/api/users/${studentId}/assign-librarian`, {});

      setMessage(data.message || "Student account added to the librarian team successfully.");
      setAssignModalOpen(false);
      setAssignSearch("");
      setSelectedStudent(null);
      const refreshedUsers = await fetchUsers();
      setUsers(refreshedUsers);
    } catch (error) {
      console.error("Add librarian error:", error);
      setMessage(error.message || "Unable to add this librarian.");
    }
  };

  const openLibrarianEditor = (librarian) => {
    setEditingLibrarian(librarian);
    setLibrarianForm({ name: librarian.name || "", email: librarian.email || "" });
    setLibrarianEditorOpen(true);
    setMessage("");
  };

  const closeLibrarianEditor = () => {
    if (librarianSaving) return;
    setLibrarianEditorOpen(false);
    setEditingLibrarian(null);
  };

  const handleLibrarianUpdate = async (event) => {
    event.preventDefault();
    if (!editingLibrarian) return;
    const name = librarianForm.name.trim();
    const email = librarianForm.email.trim();
    if (!name || !email) {
      setMessage("Librarian name and email are required.");
      return;
    }
    try {
      setLibrarianSaving(true);
      setMessage("");
      const data = await api.put(`/api/users/${editingLibrarian.id}/librarian`, { name, email });
      const updated = data.user || { ...editingLibrarian, name, email };
      setUsers((current) => current.map((account) =>
        Number(account.id) === Number(editingLibrarian.id)
          ? { ...account, ...updated, role: "librarian" }
          : account
      ));
      setLibrarianEditorOpen(false);
      setEditingLibrarian(null);
      setMessage(data.message || "Librarian updated successfully.");
    } catch (error) {
      setMessage(error.message || "Unable to update librarian.");
    } finally {
      setLibrarianSaving(false);
    }
  };

  const handleLibrarianDelete = async (librarian) => {
    if (!window.confirm(
      `Permanently delete librarian account for ${librarian.name || librarian.email}? This cannot be undone. To keep the account as a student, use Remove instead.`
    )) return;
    try {
      setLibrarianDeletingId(librarian.id);
      setMessage("");
      const data = await api.delete(`/api/users/${librarian.id}/librarian`);
      setUsers((current) => current.filter((account) => Number(account.id) !== Number(librarian.id)));
      setMessage(data.message || "Librarian deleted successfully.");
    } catch (error) {
      setMessage(error.message || "Unable to delete librarian.");
    } finally {
      setLibrarianDeletingId(null);
    }
  };

  const openStudentEditor = (student) => {
    setEditingStudent(student);
    setStudentForm({
      name: student.name || "",
      email: student.email || "",
      student_number: student.student_number || "",
      program: student.program || "",
      college: student.college || "",
      year_level: student.year_level == null ? "" : String(student.year_level),
      gender: student.gender || "",
    });
    setStudentEditorOpen(true);
    setMessage("");
  };

  const closeStudentEditor = () => {
    if (studentSaving) return;
    setStudentEditorOpen(false);
    setEditingStudent(null);
    setStudentForm({
      name: "", email: "", student_number: "", program: "", college: "", year_level: "", gender: "",
    });
  };

  const handleStudentUpdate = async (event) => {
    event.preventDefault();

    if (!editingStudent) return;

    const name = studentForm.name.trim();
    const email = studentForm.email.trim();
    const studentNumber = studentForm.student_number.trim();
    const program = studentForm.program.trim();
    const college = studentForm.college.trim();
    const yearLevel = studentForm.year_level === "" ? null : Number(studentForm.year_level);
    const gender = studentForm.gender.trim();

    if (!name || !email || !studentNumber || !program || !college || !yearLevel || !gender) {
      setMessage("Please complete all student account and school information fields.");
      return;
    }

    try {
      setStudentSaving(true);
      setMessage("");

      const data = await api.put(`/api/users/${editingStudent.id}`, {
        name,
        email,
        student_number: studentNumber,
        program,
        college,
        year_level: yearLevel,
        gender,
      });

      const updatedStudent = data.user || {
        ...editingStudent,
        name,
        email,
        student_number: studentNumber,
        program,
        college,
        year_level: yearLevel,
        gender,
      };

      setUsers((current) =>
        current.map((account) =>
          Number(account.id) === Number(editingStudent.id)
            ? { ...account, ...updatedStudent, role: "student" }
            : account
        )
      );

      setMessage(data.message || "Student account updated successfully.");
      setStudentEditorOpen(false);
      setEditingStudent(null);
      setStudentForm({
        name: "",
        email: "",
        student_number: "",
        program: "",
        college: "",
        year_level: "",
        gender: "",
      });
    } catch (error) {
      console.error("Update student error:", error);
      setMessage(error.message || "Unable to update this student.");
    } finally {
      setStudentSaving(false);
    }
  };

  const handleStudentDelete = async (student) => {
    const confirmed = window.confirm(
      `Delete student account for ${student.name || student.email}? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setStudentDeletingId(student.id);
      setMessage("");

      const data = await api.delete(`/api/users/${student.id}`);

      setUsers((current) =>
        current.filter((account) => Number(account.id) !== Number(student.id))
      );
      setMessage(data.message || "Student account deleted successfully.");
    } catch (error) {
      console.error("Delete student error:", error);
      setMessage(
        error.status === 409
          ? error.message
          : error.message || "Unable to delete this student."
      );
    } finally {
      setStudentDeletingId(null);
    }
  };

  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;           

    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const recentActivity = useMemo(() => {
    const groupByBatch = (items, kind) => {
      const groups = new Map();
      items.forEach((item) => {
        const batchId = item.batch_id;
        const key = batchId ? `batch-${batchId}` : `item-${item.id ?? item.borrowing_id}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
      });
      return Array.from(groups.entries()).map(([key, groupedItems]) => {
        const first = groupedItems[0];
        const titles = groupedItems.map((item) => item.book_title || item.title || `Book #${item.book_id}`);
        const statuses = [...new Set(groupedItems.map((item) => String(item.status || "unknown").toLowerCase()))];
        const status = statuses.length === 1 ? statuses[0] : "mixed";
        const date = groupedItems.map((item) => item.approved_at || item.requested_at || item.returned_at || item.borrowed_at).filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0];
        let title;
        let type;
        if (kind === "request") {
          title = status === "pending" ? "Borrow request submitted" : status === "mixed" ? "Borrow request updated" : `Borrow request ${status}`;
          type = "Request";
        } else {
          title = status === "returned" ? "Books returned" : status === "overdue" ? "Borrowing overdue" : status === "mixed" ? "Borrowing status updated" : "Books borrowed";
          type = status === "returned" ? "Return" : "Borrowing";
        }
        return {
          id: `${kind}-${key}`,
          type,
          title,
          borrower: first.user_name || `User #${first.user_id}`,
          books: titles,
          bookStatuses: groupedItems.map((item, index) => ({ title: titles[index], status: String(item.status || "unknown").toLowerCase() })),
          date,
        };
      });
    };
    return [...groupByBatch(requests, "request"), ...groupByBatch(borrowings, "borrowing")]
      .filter((item) => item.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 12);
  }, [requests, borrowings]);

  const navItems = [
    ["dashboard", "bi-grid", "Dashboard"],
    ["users", "bi-people", "Users"],
    ["librarians", "bi-person-badge", "Librarians"],
    ["reports", "bi-bar-chart-line", "Reports & Analytics"],
    ["activity", "bi-clock-history", "Activity"],
  ];

  const openSection = (section) => {
    setActiveSection(section);
    setMessage("");
    setSearch("");
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <svg className="admin-sidebar-leaves" viewBox="0 0 220 240" aria-hidden="true">
          <path className="admin-leaf-stem" d="M 10 235 C 45 190, 70 143, 112 82" />
          <path className="admin-leaf-shape admin-leaf-one" d="M 23 218 C 4 184, 4 153, 17 130 C 47 157, 48 190, 23 218 Z" />
          <path className="admin-leaf-shape admin-leaf-two" d="M 37 190 C 38 150, 61 119, 91 106 C 92 143, 72 174, 37 190 Z" />
          <path className="admin-leaf-shape admin-leaf-three" d="M 48 171 C 24 139, 24 106, 42 82 C 69 113, 72 144, 48 171 Z" />
          <path className="admin-leaf-shape admin-leaf-four" d="M 57 151 C 70 114, 100 93, 133 95 C 118 130, 91 149, 57 151 Z" />
          <path className="admin-leaf-shape admin-leaf-five" d="M 20 224 C 57 195, 98 191, 136 205 C 102 230, 60 236, 20 224 Z" />
          <path className="admin-leaf-shape admin-leaf-six" d="M 72 131 C 74 93, 98 64, 128 54 C 131 91, 109 120, 72 131 Z" />
          <path className="admin-leaf-shape admin-leaf-seven" d="M 94 102 C 110 71, 140 56, 169 61 C 151 89, 123 103, 94 102 Z" />
        </svg>

        <div className="admin-brand">
          <img
            className="admin-brand-logo"
            src="/libsync-logo.svg"
            alt="LibSync — School Library Management System"
            draggable="false"
          />
        </div>

        <div className="admin-sidebar-label">WORKSPACE</div>
        <nav className="admin-nav" aria-label="Admin navigation">
          {navItems.map(([key, icon, label]) => (
            <button
              type="button"
              key={key}
              className={activeSection === key ? "active" : ""}
              onClick={() => openSection(key)}
            >
              <i className={`bi ${icon}`} aria-hidden="true"></i>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-profile">
            <div className="admin-avatar">{(user?.name || "A").trim().charAt(0).toUpperCase()}</div>
            <div className="admin-sidebar-profile-copy">
              <strong>{user?.name || "Administrator"}</strong>
              <span>Administrator account</span>
            </div>
          </div>
          <button type="button" className="admin-logout" onClick={onLogout}>
            <i className="bi bi-box-arrow-left" aria-hidden="true"></i>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-eyebrow">LIBSYNC / ADMIN</p>
            <h1>
              {activeSection === "dashboard" && "Admin Dashboard"}
              {activeSection === "users" && "Students"}
              {activeSection === "librarians" && "Librarians"}
              {activeSection === "reports" && "Reports & Analytics"}
              {activeSection === "activity" && "System Activity"}
            </h1>
            <p className="admin-welcome">
              {activeSection === "dashboard" &&
                "Welcome back, Administrator. Manage your library system from here."}
              {activeSection === "users" &&
                "View and manage registered student accounts"}
              {activeSection === "librarians" &&
                "Manage librarian accounts and add registered students to the librarian team"}
              {activeSection === "reports" &&
                "Monitor library performance, inventory, borrowing, returns, overdue books, and student usage"}
              {activeSection === "activity" &&
                "Recent borrowing and request activity"}
            </p>
          </div>
        </header>

        {message && <div className="admin-message">{message}</div>}

        {loading && activeSection === "dashboard" ? (
          <div className="admin-loading">Loading admin dashboard...</div>
        ) : (
          <>
            {activeSection === "dashboard" && (
              <section className="admin-dashboard-section">
                <div className="admin-dashboard-heading">
                  <div>
                    <h2>Library Overview</h2>
                    <p>Live summary of students, collection, borrowing, and library activity.</p>
                  </div>
                  <button
                    type="button"
                    className="admin-secondary-button"
                    onClick={() => loadDashboard({ showLoading: true })}
                    disabled={loading}
                  >
                    <i className={`bi bi-arrow-clockwise ${loading ? "admin-spin" : ""}`} />
                    Refresh
                  </button>
                </div>

                <div className="admin-stat-grid admin-stat-grid-overview">
                  <StatCard icon="bi-people" label="Total Students" value={stats.students} note="registered student accounts" />
                  <StatCard icon="bi-person-badge" label="Total Librarians" value={stats.librarians} note="authorized library staff" />
                  <StatCard icon="bi-book" label="Book Titles" value={stats.books} note={`${stats.totalCopies.toLocaleString()} total copies`} />
                  <StatCard icon="bi-arrow-left-right" label="Active Borrowings" value={stats.activeBorrowings} note="currently on loan" />
                </div>

                <section className="admin-panel">
                  <div className="admin-panel-heading">
                    <div>
                      <h2>Student Return Performance Monitoring</h2>
                      <p>Rule-based scores from librarian-confirmed book returns. Higher scores mean better returning performance.</p>
                    </div>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      onClick={() => void loadReturnPerformance()}
                      disabled={performanceLoading}
                    >
                      <i className={`bi bi-arrow-clockwise ${performanceLoading ? "admin-spin" : ""}`} />
                      Refresh Performance
                    </button>
                  </div>

                  <div className="admin-stat-grid admin-stat-grid-overview">
                    <StatCard icon="bi-shield-check" label="High Performance" value={performanceSummary.high_performance || 0} note="80–100 points · good returning record" />
                    <StatCard icon="bi-exclamation-triangle" label="Medium Performance" value={performanceSummary.medium_performance || 0} note="50–79 points · needs improvement" />
                    <StatCard icon="bi-exclamation-octagon" label="Low Performance" value={performanceSummary.low_performance || 0} note="0–49 points · poor returning record" />
                    <StatCard icon="bi-people" label="Students Scored" value={performanceSummary.total_students || 0} note="including students with no returns yet" />
                  </div>

                  {performanceError ? (
                    <div className="admin-message">{performanceError}</div>
                  ) : performanceLoading && performanceStudents.length === 0 ? (
                    <div className="admin-loading">Loading return performance data...</div>
                  ) : displayedPerformanceStudents.length === 0 ? (
                    <div className="admin-empty-cell">No student performance data available yet.</div>
                  ) : (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Completed Returns</th>
                            <th>On-Time Returns</th>
                            <th>Late Returns</th>
                            <th>Performance Score</th>
                            <th>Performance Level</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedPerformanceStudents.map((student) => (
                            <tr key={student.user_id}>
                              <td><strong>{student.name || `User #${student.user_id}`}</strong></td>
                              <td>{Number(student.completed_returns || 0)}</td>
                              <td>{Number(student.on_time_returns || 0)}</td>
                              <td>{Number(student.late_returns || 0)}</td>
                              <td><strong>{Number(student.performance_score ?? 100)}</strong>/100</td>
                              <td>
                                <span
                                  className="admin-status-pill"
                                  style={{
                                    background: student.performance_level === "High" ? "#E4F7EF" : student.performance_level === "Medium" ? "#FFF3D6" : "#FDE8E7",
                                    color: student.performance_level === "High" ? "#147A5A" : student.performance_level === "Medium" ? "#9A6700" : "#B42318",
                                  }}
                                >
                                  {student.performance_level || "High"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <p className="admin-report-note">
                    Scoring model: start at 100; deduct 10 points per day late (maximum 50 per returned book);
                    restore 5 points for each on-time return, capped at 100. A partial day late counts as one day.
                    Scores update from confirmed returns, not active borrowing counts. High (80–100) is best.
                  </p>
                </section>

                <div className="admin-analytics-grid admin-analytics-grid-primary">
                  <section className="admin-panel admin-chart-panel admin-trend-panel">
                    <div className="admin-panel-heading">
                      <div>
                        <h2>Monthly Borrowing Activity</h2>
                        <p>Number of borrowing records created per month.</p>
                      </div>
                      <span className={`admin-trend-pill ${borrowingTrend.tone}`}>
                        <i className="bi bi-graph-up-arrow" />
                        {borrowingTrend.label}
                      </span>
                    </div>
                    <MonthlyTrendChart items={monthlyBorrowingActivity} />
                    <p className="admin-report-note">Based on recorded borrow dates in the most recent six months.</p>
                  </section>

                  <section className="admin-panel admin-chart-panel">
                    <div className="admin-panel-heading">
                      <div>
                        <h2>Borrowing Status</h2>
                        <p>Current distribution of borrowing records.</p>
                      </div>
                    </div>
                    <PercentDonut
                      items={borrowingStatusItems}
                      centerValue={borrowings.length.toLocaleString()}
                      centerLabel="Records"
                      emptyText="No borrowing records yet."
                    />
                  </section>
                </div>

                <div className="admin-analytics-grid admin-analytics-grid-secondary">
                  <section className="admin-panel admin-chart-panel">
                    <div className="admin-panel-heading">
                      <div>
                        <h2>Book Category Performance</h2>
                        <p>Catalog size and availability by category.</p>
                      </div>
                    </div>
                    {categoryPerformance.length === 0 ? (
                      <div className="admin-report-empty">No book categories available yet.</div>
                    ) : (
                      <div className="admin-category-table-wrap">
                        <table className="admin-category-table">
                          <thead>
                            <tr><th>Category</th><th>Titles</th><th>Copies</th><th>Availability</th></tr>
                          </thead>
                          <tbody>
                            {categoryPerformance.map((category) => (
                              <tr key={category.name}>
                                <td><strong>{category.name}</strong></td>
                                <td>{category.titles}</td>
                                <td>{category.copies}</td>
                                <td>
                                  <div className="admin-category-progress">
                                    <div className="admin-category-progress-track">
                                      <span style={{ width: `${category.availability}%` }} />
                                    </div>
                                    <strong>{category.availability}%</strong>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  <section className="admin-panel admin-chart-panel">
                    <div className="admin-panel-heading">
                      <div>
                        <h2>Inventory Availability</h2>
                        <p>Available copies compared with borrowed copies.</p>
                      </div>
                    </div>
                    <PercentDonut
                      items={inventoryStatusItems}
                      centerValue={stats.totalCopies.toLocaleString()}
                      centerLabel="Total copies"
                      emptyText="No inventory data available yet."
                    />
                    <div className="admin-mini-metrics">
                      <div><span>Overdue books</span><strong>{stats.overdueBooks}</strong></div>
                      <div><span>Pending requests</span><strong>{stats.pendingRequests}</strong></div>
                    </div>
                  </section>
                </div>

                <div className="admin-analytics-grid admin-analytics-grid-lower">
                  <section className="admin-panel">
                    <div className="admin-panel-heading">
                      <div>
                        <h2>Librarian Accounts</h2>
                        <p>Current authorized library staff.</p>
                      </div>
                      <button
                        type="button"
                        className="admin-primary-button"
                        onClick={() => setAssignModalOpen(true)}
                      >
                        <i className="bi bi-plus-lg" />
                        Add Librarian
                      </button>
                    </div>
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Action</th></tr></thead>
                        <tbody>
                          {librarians.slice(0, 5).map((librarian) => (
                            <tr key={librarian.id}>
                              <td>{librarian.name}</td>
                              <td>{librarian.email}</td>
                              <td><span className="admin-status-pill active">Active</span></td>
                              <td>
                                <div className="admin-row-actions">
                                  <button type="button" className="admin-edit-button" onClick={() => openLibrarianEditor(librarian)}><i className="bi bi-pencil-square" /> Edit</button>
                                  <button type="button" className="admin-danger-button" onClick={() => handleLibrarianDelete(librarian)} disabled={librarianDeletingId === librarian.id}><i className="bi bi-trash" /> {librarianDeletingId === librarian.id ? "Deleting..." : "Delete"}</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {librarians.length === 0 && (
                            <tr><td colSpan="4" className="admin-empty-cell">No librarians found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="admin-panel">
                    <div className="admin-panel-heading">
                      <div>
                        <h2>Recent System Activity</h2>
                        <p>Latest grouped borrowing and request activity.</p>
                      </div>
                      <button type="button" className="admin-link-button" onClick={() => openSection("activity")}>
                        View All
                      </button>
                    </div>
                    <ActivityTable activity={recentActivity.slice(0, 5)} formatDate={formatDate} />
                  </section>
                </div>
              </section>
            )}

            {activeSection === "users" && (
              <section className="admin-panel">
                <div className="admin-users-toolbar">
                  <div className="admin-users-heading">
                    <h2>Student Accounts</h2>
                    <p>Only registered student accounts are shown here.</p>
                    <span className="admin-users-current-filter">
                      Students ({students.length})
                    </span>
                  </div>

                  <div className="admin-search">
                    <i className="bi bi-search"></i>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by name, email, school ID, program, or college"
                    />
                  </div>
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-table admin-student-details-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>School ID</th>
                        <th>Program</th>
                        <th>College</th>
                        <th>Year Level</th>
                        <th>Gender</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student) => (
                        <tr key={student.id}>
                          <td>#{student.id}</td>
                          <td>{student.name}</td>
                          <td>{student.email}</td>
                          <td>{student.student_number || "—"}</td>
                          <td>{student.program || "—"}</td>
                          <td>{student.college || "—"}</td>
                          <td>{student.year_level ? `${student.year_level}${Number(student.year_level) === 1 ? "st" : Number(student.year_level) === 2 ? "nd" : Number(student.year_level) === 3 ? "rd" : "th"}` : "—"}</td>
                          <td>{student.gender || "—"}</td>
                          <td>
                            <span className="admin-status-pill active">
                              Active
                            </span>
                          </td>
                          <td>
                            <div className="admin-row-actions">
                              <button
                                type="button"
                                className="admin-edit-button"
                                onClick={() => openStudentEditor(student)}
                              >
                                <i className="bi bi-pencil-square" />
                                Edit
                              </button>
                              <button
                                type="button"
                                className="admin-danger-button"
                                onClick={() => handleStudentDelete(student)}
                                disabled={studentDeletingId === student.id}
                              >
                                <i className="bi bi-trash" />
                                {studentDeletingId === student.id ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {filteredStudents.length === 0 && (
                        <tr>
                          <td colSpan="10" className="admin-empty-cell">
                            No student accounts found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeSection === "librarians" && (
              <section className="admin-panel">
                <div className="admin-panel-heading">
                  <div>
                    <h2>Librarian Accounts</h2>
                    <p>
                      View librarian accounts. Add, edit, or delete librarian accounts.
                    </p>
                  </div>

                  <button
                    className="admin-primary-button"
                    onClick={() => setAssignModalOpen(true)}
                  >
                    <i className="bi bi-plus-lg"></i>
                    Add Librarian
                  </button>
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {librarians.map((librarian) => (
                        <tr key={librarian.id}>
                          <td>#{librarian.id}</td>
                          <td>{librarian.name}</td>
                          <td>{librarian.email}</td>
                          <td>
                            <span className="admin-status-pill active">
                              Active
                            </span>
                          </td>
                          <td>
                            <div className="admin-row-actions">
                              <button type="button" className="admin-edit-button" onClick={() => openLibrarianEditor(librarian)}><i className="bi bi-pencil-square" /> Edit</button>
                              <button type="button" className="admin-danger-button" onClick={() => handleLibrarianDelete(librarian)} disabled={librarianDeletingId === librarian.id}><i className="bi bi-trash" /> {librarianDeletingId === librarian.id ? "Deleting..." : "Delete"}</button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {librarians.length === 0 && (
                        <tr>
                          <td colSpan="5" className="admin-empty-cell">
                            No librarians found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeSection === "reports" && (
              <LibraryReports
                books={books}
                borrowings={borrowings}
                requests={requests}
                loading={loading}
                error={message}
                onRefresh={() => loadDashboard({ showLoading: true })}
              />
            )}

            {activeSection === "activity" && (
              <section className="admin-panel">
                <div className="admin-panel-heading">
                  <div>
                    <h2>System Activity</h2>
                    <p>
                      Read-only overview of borrowing and request events.
                    </p>
                  </div>

                  <button
                    className="admin-secondary-button"
                    onClick={() => loadDashboard({ showLoading: true })}
                  >
                    <i className="bi bi-arrow-clockwise"></i>
                    Refresh
                  </button>
                </div>

                <ActivityTable
                  activity={recentActivity}
                  formatDate={formatDate}
                />
              </section>
            )}
          </>
        )}
      </main>

      {assignModalOpen && (
        <div
          className="admin-modal-backdrop"
          onMouseDown={() => setAssignModalOpen(false)}
        >
          <div
            className="admin-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div>
                <h2>Add Librarian</h2>
                <p>Select a registered student account to add to the librarian team.</p>
              </div>
              <button onClick={() => setAssignModalOpen(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="admin-search admin-modal-search">
              <i className="bi bi-search"></i>
              <input
                value={assignSearch}
                onChange={(event) => {
                  setAssignSearch(event.target.value);
                  setSelectedStudent(null);
                }}
                placeholder="Search eligible students by name or email"
                autoFocus
              />
            </div>

            <div className="admin-candidate-list">
              {assignCandidates.map((student) => (
                <button
                  key={student.id}
                  className={
                    selectedStudent?.id === student.id ? "selected" : ""
                  }
                  onClick={() => setSelectedStudent(student)}
                >
                  <div className="admin-avatar small">
                    {student.name?.charAt(0)?.toUpperCase() || "S"}
                  </div>
                  <div>
                    <strong>{student.name}</strong>
                    <span>{student.email}</span>
                  </div>
                  <span className="admin-role-pill student">
                    Student · eligible
                  </span>
                </button>
              ))}

              {assignCandidates.length === 0 && (
                <div className="admin-empty-state">
                  No matching students found.
                </div>
              )}
            </div>

            <div className="admin-modal-actions">
              <button
                className="admin-secondary-button"
                onClick={() => setAssignModalOpen(false)}
              >
                Cancel
              </button>

              <button
                className="admin-primary-button"
                disabled={!selectedStudent}
                onClick={() =>
                  selectedStudent &&
                  addStudentAsLibrarian(selectedStudent.id)
                }
              >
                Add as Librarian
              </button>
            </div>
          </div>
        </div>
      )}

      {librarianEditorOpen && (
        <div className="admin-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeLibrarianEditor();
        }}>
          <form className="admin-modal admin-student-modal" onSubmit={handleLibrarianUpdate} onMouseDown={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <div><h2>Edit Librarian Account</h2><p>Update the librarian's name and email address.</p></div>
              <button type="button" onClick={closeLibrarianEditor} disabled={librarianSaving} aria-label="Close edit librarian dialog"><i className="bi bi-x-lg" /></button>
            </div>
            <label className="admin-form-field">
              <span>Full Name</span>
              <input type="text" value={librarianForm.name} onChange={(event) => setLibrarianForm((current) => ({ ...current, name: event.target.value }))} maxLength={100} required />
            </label>
            <label className="admin-form-field">
              <span>Email Address</span>
              <input type="email" value={librarianForm.email} onChange={(event) => setLibrarianForm((current) => ({ ...current, email: event.target.value }))} maxLength={100} required />
            </label>
            <p className="admin-form-hint">The librarian's password and role are not changed by this form.</p>
            <div className="admin-modal-actions">
              <button type="button" className="admin-secondary-button" onClick={closeLibrarianEditor} disabled={librarianSaving}>Cancel</button>
              <button type="submit" className="admin-primary-button" disabled={librarianSaving}>{librarianSaving ? "Saving..." : "Save Changes"}</button>
            </div>
          </form>
        </div>
      )}

      {studentEditorOpen && (
        <div
          className="admin-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeStudentEditor();
          }}
        >
          <form
            className="admin-modal admin-student-modal"
            onSubmit={handleStudentUpdate}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div>
                <h2>Edit Student Account</h2>
                <p>Update the student's account and school information.</p>
              </div>
              <button type="button" onClick={closeStudentEditor} aria-label="Close edit student dialog">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <label className="admin-form-field">
              <span>Full Name</span>
              <input
                type="text"
                value={studentForm.name}
                onChange={(event) => setStudentForm((current) => ({ ...current, name: event.target.value }))}
                maxLength={100}
                required
              />
            </label>

            <label className="admin-form-field">
              <span>Email Address</span>
              <input
                type="email"
                value={studentForm.email}
                onChange={(event) => setStudentForm((current) => ({ ...current, email: event.target.value }))}
                maxLength={100}
                required
              />
            </label>

            <label className="admin-form-field">
              <span>School ID</span>
              <input type="text" value={studentForm.student_number} onChange={(event) => setStudentForm((current) => ({ ...current, student_number: event.target.value }))} maxLength={50} required />
            </label>

            <label className="admin-form-field">
              <span>Program</span>
              <input type="text" value={studentForm.program} onChange={(event) => setStudentForm((current) => ({ ...current, program: event.target.value }))} maxLength={100} required />
            </label>

            <label className="admin-form-field">
              <span>College</span>
              <input type="text" value={studentForm.college} onChange={(event) => setStudentForm((current) => ({ ...current, college: event.target.value }))} maxLength={150} required />
            </label>

            <label className="admin-form-field">
              <span>Year Level</span>
              <select value={studentForm.year_level} onChange={(event) => setStudentForm((current) => ({ ...current, year_level: event.target.value }))} required>
                <option value="">Select year level</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
                <option value="5">5th Year</option>
                <option value="6">6th Year</option>
              </select>
            </label>

            <label className="admin-form-field">
              <span>Gender</span>
              <input type="text" value={studentForm.gender} onChange={(event) => setStudentForm((current) => ({ ...current, gender: event.target.value }))} maxLength={50} required />
            </label>

            <p className="admin-form-hint">The student's password is not changed by this form.</p>

            <div className="admin-modal-actions">
              <button type="button" className="admin-secondary-button" onClick={closeStudentEditor} disabled={studentSaving}>
                Cancel
              </button>
              <button type="submit" className="admin-primary-button" disabled={studentSaving}>
                {studentSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

function getBorrowingStatus(item) {
  const status = String(item.status || item.record_status || item.request_status || "").toLowerCase();

  if (item.returned_at || status === "returned") return "returned";
  if (status === "overdue") return "overdue";

  if (["borrowed", "approved", "active"].includes(status)) {
    if (item.due_date) {
      const dueDate = new Date(item.due_date);
      if (!Number.isNaN(dueDate.getTime())) {
        dueDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (dueDate < today) return "overdue";
      }
    }
    return "borrowed";
  }

  return "other";
}

function PercentDonut({ items, centerValue, centerLabel, emptyText }) {
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const positiveItems = items.filter((item) => Number(item.value || 0) > 0);
  const stops = positiveItems.map((item, index) => {
    const startValue = positiveItems
      .slice(0, index)
      .reduce((sum, previousItem) => sum + Number(previousItem.value || 0), 0);
    const endValue = startValue + Number(item.value || 0);
    const start = total > 0 ? (startValue / total) * 100 : 0;
    const end = total > 0 ? (endValue / total) * 100 : 0;
    return `${item.color} ${start}% ${end}%`;
  });

  return (
    <div className="admin-donut-layout">
      {total > 0 ? (
        <div className="admin-donut" style={{ background: `conic-gradient(${stops.join(", ")})` }}>
          <div className="admin-donut-hole">
            <strong>{centerValue}</strong>
            <span>{centerLabel}</span>
          </div>
        </div>
      ) : (
        <div className="admin-donut-empty"><i className="bi bi-pie-chart" /><span>{emptyText}</span></div>
      )}

      <div className="admin-donut-legend">
        {items.map((item) => {
          const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <div className="admin-donut-legend-row" key={item.label}>
              <span className="admin-donut-swatch" style={{ background: item.color }} />
              <span>{item.label}</span>
              <strong>{percentage}%</strong>
              <small>{Number(item.value || 0).toLocaleString()}</small>
            </div>
          );
        })}
        {total === 0 && <p>{emptyText}</p>}
      </div>
    </div>
  );
}

function MonthlyTrendChart({ items }) {
  const width = 660;
  const height = 220;
  const left = 36;
  const right = 632;
  const top = 20;
  const bottom = 174;
  const maxValue = Math.max(1, ...items.map((item) => item.value));
  const coordinates = items.map((item, index) => {
    const x = left + (items.length <= 1 ? 0 : (index / (items.length - 1)) * (right - left));
    const y = bottom - (item.value / maxValue) * (bottom - top);
    return { ...item, x, y };
  });
  const linePoints = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = coordinates.length
    ? `M ${coordinates[0].x} ${bottom} L ${coordinates.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${coordinates[coordinates.length - 1].x} ${bottom} Z`
    : "";

  const hasActivity = items.some((item) => item.value > 0);

  return (
    <div className="admin-trend-chart-wrap">
      <div className="admin-trend-y-labels"><span>{maxValue}</span><span>{Math.round(maxValue / 2)}</span><span>0</span></div>
      <svg className="admin-trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monthly borrowing activity line chart">
        {[top, top + (bottom - top) / 2, bottom].map((y) => (
          <line key={y} x1={left} x2={right} y1={y} y2={y} className="admin-trend-gridline" />
        ))}
        {hasActivity && (
          <>
            <path d={areaPath} className="admin-trend-area" />
            <polyline points={linePoints} className="admin-trend-line" />
            {coordinates.map((point) => (
              <circle key={point.label} cx={point.x} cy={point.y} r="4.5" className="admin-trend-point">
                <title>{`${point.label}: ${point.value} borrowings`}</title>
              </circle>
            ))}
          </>
        )}
      </svg>
      <div className="admin-trend-x-labels">
        {items.map((item) => <span key={item.label}>{item.label}</span>)}
      </div>
      {!hasActivity && <div className="admin-trend-empty">No borrowing activity recorded in the last six months.</div>}
    </div>
  );
}

function StatCard({ icon, label, value, note }) {
  return (
    <div className="admin-stat-card">
      <div className="admin-stat-icon">
        <i className={`bi ${icon}`}></i>
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {note && <small>{note}</small>}
      </div>
    </div>
  );
}

function ActivityTable({ activity, formatDate }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Activity</th>
            <th>Details</th>
            <th>Type</th>
            <th>Date & Time</th>
          </tr>
        </thead>
        <tbody>
          {activity.map((item) => (
            <tr key={item.id}>
              <td>{item.title}</td>
              <td><div className="admin-activity-books"><strong>{item.borrower}</strong><ul>{(item.books || []).map((book, index) => <li key={`${item.id}-${index}`}>{book}{item.bookStatuses?.length > 0 && item.bookStatuses.some((entry) => entry.status !== item.bookStatuses[0].status) ? <small> — {item.bookStatuses[index].status}</small> : null}</li>)}</ul></div></td>
              <td>
                <span className="admin-activity-pill">{item.type}</span>
              </td>
              <td>{formatDate(item.date)}</td>
            </tr>
          ))}

          {activity.length === 0 && (
            <tr>
              <td colSpan="4" className="admin-empty-cell">
                No recent activity found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default AdminDashboard;
