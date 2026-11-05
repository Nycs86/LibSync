import { useCallback, useEffect, useMemo, useState } from "react";
import LibraryReports from "./library_reports";
import BooksManagement from "./books_management";
import { api, getStoredUser } from "../services/api";
import "./admin_dashboard.css";
import "./dashboard_polish.css";

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

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Centralized API service automatically attaches the JWT access token.
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

  // Load each area independently so one unavailable endpoint does not
  // prevent the rest of the admin dashboard from displaying.
  const loadDashboard = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) {
      setLoading(true);
      setMessage("");
    }

    const results = await Promise.allSettled([
      fetchUsers(),
      fetchBooks(),
      fetchBorrowings(),
      fetchBorrowRequests(),
    ]);
    const setters = [setUsers, setBooks, setBorrowings, setRequests];
    const labels = ["users", "books", "borrowings", "borrow requests"];
    const failures = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        setters[index](result.value);
      } else {
        setters[index]([]);
        failures.push(labels[index]);
        console.error(`Unable to load ${labels[index]}:`, result.reason);
      }
    });

    setMessage(
      failures.length
        ? `Some dashboard data could not be loaded: ${failures.join(", ")}. Use Refresh Data to try again.`
        : ""
    );
    setLoading(false);
  }, [fetchUsers, fetchBooks, fetchBorrowings, fetchBorrowRequests]);

  // Initial load: wait for API responses before updating React state.
  // This avoids synchronous state updates inside the effect body.
  useEffect(() => {
    let cancelled = false;

    const initializeDashboard = async () => {
      const results = await Promise.allSettled([
        fetchUsers(),
        fetchBooks(),
        fetchBorrowings(),
        fetchBorrowRequests(),
      ]);

      if (cancelled) return;

      const setters = [setUsers, setBooks, setBorrowings, setRequests];
      const labels = ["users", "books", "borrowings", "borrow requests"];
      const failures = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          setters[index](result.value);
        } else {
          setters[index]([]);
          failures.push(labels[index]);
          console.error(`Unable to load ${labels[index]}:`, result.reason);
        }
      });

      setMessage(
        failures.length
          ? `Some dashboard data could not be loaded: ${failures.join(", ")}. Use Refresh Data to try again.`
          : ""
      );
      setLoading(false);
    };

    void initializeDashboard();

    return () => {
      cancelled = true;
    };
  }, [fetchUsers, fetchBooks, fetchBorrowings, fetchBorrowRequests]);

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
      (item) => item.status === "borrowed"
    ).length;

    const overdueBooks = borrowings.filter((item) => {
      if (item.status === "overdue") return true;
      if (item.status !== "borrowed" || !item.due_date) return false;

      const due = new Date(item.due_date);
      return !Number.isNaN(due.getTime()) && due < new Date();
    }).length;

    const pendingRequests = requests.filter(
      (item) => item.status === "pending"
    ).length;

    const availableBooks = books.reduce(
      (total, book) => total + Number(book.available_quantity || 0),
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
    };
  }, [students, librarians, books, borrowings, requests]);

  // The Users section is dedicated to student accounts only.
  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return students;

    return students.filter(
      (student) =>
        student.name?.toLowerCase().includes(term) ||
        student.email?.toLowerCase().includes(term) ||
        String(student.id).includes(term)
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
      setUsers(await fetchUsers());
    } catch (error) {
      console.error("Assign librarian error:", error);
      setMessage(error.message || "Unable to add this librarian.");
    }
  };

  const removeLibrarian = async (librarianId) => {
    const confirmed = window.confirm(
      "Remove this librarian and return the account to Student?"
    );
    if (!confirmed) return;

    try {
      setMessage("");
      const data = await api.put(`/api/users/${librarianId}/remove-librarian`, {});
      setMessage(data.message || "Librarian returned to student successfully.");
      setUsers(await fetchUsers());
    } catch (error) {
      console.error("Remove librarian error:", error);
      setMessage(error.message || "Unable to remove this librarian.");
    }
  };

  const formatDate = (value) => {
    if (!value) return "ΓÇö";
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
    const requestActivity = requests.map((item) => ({
      id: `request-${item.id}`,
      type: "Request",
      title:
        item.status === "pending"
          ? "Borrow request submitted"
          : `Borrow request ${item.status}`,
      detail: `${item.user_name || `User #${item.user_id}`} ΓÇó ${
        item.book_title || `Book #${item.book_id}`
      }`,
      date: item.approved_at || item.requested_at,
    }));

    const borrowingActivity = borrowings.map((item) => ({
      id: `borrowing-${item.id || item.borrowing_id}`,
      type: item.status === "returned" ? "Return" : "Borrowing",
      title:
        item.status === "returned"
          ? "Book returned"
          : item.status === "overdue"
          ? "Book overdue"
          : "Book borrowed",
      detail: `${item.user_name || `User #${item.user_id}`} ΓÇó ${
        item.book_title || item.title || `Book #${item.book_id}`
      }`,
      date: item.returned_at || item.borrowed_at,
    }));

    return [...requestActivity, ...borrowingActivity]
      .filter((item) => item.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 12);
  }, [requests, borrowings]);

  const navItems = [
    ["dashboard", "bi-grid", "Dashboard"],
    ["books", "bi-book", "Books Management"],
    ["users", "bi-people", "Students"],
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
            alt="LibSync ΓÇö School Library Management System"
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
              {activeSection === "books" && "Books Management"}
              {activeSection === "users" && "Students"}
              {activeSection === "librarians" && "Librarians"}
              {activeSection === "reports" && "Reports & Analytics"}
              {activeSection === "activity" && "System Activity"}
            </h1>
            <p className="admin-welcome">
              {activeSection === "dashboard" &&
                "Welcome back, Administrator. Monitor the library and manage system resources from here."}
              {activeSection === "books" &&
                "Manage the complete library catalog, inventory, and book records."}
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
          <button
            type="button"
            className="admin-secondary-button"
            onClick={() => loadDashboard({ showLoading: true })}
            disabled={loading}
          >
            <i className={`bi bi-arrow-clockwise ${loading ? "admin-spin" : ""}`} aria-hidden="true"></i>
            Refresh Data
          </button>
        </header>

        {message && <div className="admin-message" role="status">{message}</div>}

        {loading && activeSection === "dashboard" ? (
          <div className="admin-loading">Loading admin dashboard...</div>
        ) : (
          <>
            {activeSection === "books" && (
              <BooksManagement
                onBack={() => {
                  openSection("dashboard");
                  void loadDashboard({ showLoading: true });
                }}
              />
            )}

            {activeSection === "dashboard" && (
              <section className="admin-dashboard-section">
                <div className="admin-stat-grid">
                  <StatCard
                    icon="bi-people"
                    label="Total Students"
                    value={stats.students}
                  />
                  <StatCard
                    icon="bi-person-badge"
                    label="Total Librarians"
                    value={stats.librarians}
                  />
                  <StatCard
                    icon="bi-book"
                    label="Total Books"
                    value={stats.books}
                  />
                  <StatCard
                    icon="bi-arrow-left-right"
                    label="Active Borrowings"
                    value={stats.activeBorrowings}
                  />
                  <StatCard
                    icon="bi-exclamation-triangle"
                    label="Overdue Books"
                    value={stats.overdueBooks}
                  />
                  <StatCard
                    icon="bi-clock"
                    label="Pending Requests"
                    value={stats.pendingRequests}
                  />
                </div>

                <div className="admin-dashboard-grid">
                  <div className="admin-panel">
                    <div className="admin-panel-heading">
                      <div>
                        <h2>Librarian Accounts</h2>
                        <p>Current authorized library staff.</p>
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
                            <th>Name</th>
                            <th>Email</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {librarians.slice(0, 5).map((librarian) => (
                            <tr key={librarian.id}>
                              <td>{librarian.name}</td>
                              <td>{librarian.email}</td>
                              <td>
                                <span className="admin-status-pill active">
                                  Active
                                </span>
                              </td>
                              <td>
                                <button
                                  className="admin-danger-button"
                                  onClick={() =>
                                    removeLibrarian(librarian.id)
                                  }
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}

                          {librarians.length === 0 && (
                            <tr>
                              <td colSpan="4" className="admin-empty-cell">
                                No librarians found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="admin-panel">
                    <div className="admin-panel-heading">
                      <div>
                        <h2>Library Overview</h2>
                        <p>Current physical catalog availability.</p>
                      </div>
                    </div>

                    <OverviewRow
                      icon="bi-book"
                      label="Book Titles"
                      value={stats.books}
                    />
                    <OverviewRow
                      icon="bi-collection"
                      label="Total Copies"
                      value={stats.totalCopies}
                    />
                    <OverviewRow
                      icon="bi-check-circle"
                      label="Available Copies"
                      value={stats.availableBooks}
                    />
                    <OverviewRow
                      icon="bi-arrow-left-right"
                      label="Currently Borrowed"
                      value={stats.activeBorrowings}
                    />
                  </div>
                </div>

                <div className="admin-panel admin-quick-actions">
                  <div className="admin-panel-heading">
                    <div>
                      <h2>Quick Actions</h2>
                      <p>Go directly to the most-used administration tasks.</p>
                    </div>
                  </div>
                  <div className="admin-quick-action-buttons">
                    <button type="button" className="admin-primary-button" onClick={() => openSection("books")}>
                      <i className="bi bi-book" aria-hidden="true"></i> Manage Books
                    </button>
                    <button type="button" className="admin-secondary-button" onClick={() => openSection("users")}>
                      <i className="bi bi-people" aria-hidden="true"></i> View Students
                    </button>
                    <button type="button" className="admin-secondary-button" onClick={() => openSection("librarians")}>
                      <i className="bi bi-person-badge" aria-hidden="true"></i> Manage Librarians
                    </button>
                    <button type="button" className="admin-secondary-button" onClick={() => openSection("reports")}>
                      <i className="bi bi-bar-chart-line" aria-hidden="true"></i> Open Reports
                    </button>
                  </div>
                </div>

                <div className="admin-panel">
                  <div className="admin-panel-heading">
                    <div>
                      <h2>Recent System Activity</h2>
                      <p>Latest borrowing and request activity.</p>
                    </div>
                    <button
                      className="admin-link-button"
                      onClick={() => openSection("activity")}
                    >
                      View All
                    </button>
                  </div>

                  <ActivityTable
                    activity={recentActivity.slice(0, 6)}
                    formatDate={formatDate}
                  />
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
                      placeholder="Search students by name, email, or ID"
                    />
                  </div>
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student) => (
                        <tr key={student.id}>
                          <td>#{student.id}</td>
                          <td>{student.name}</td>
                          <td>{student.email}</td>
                          <td>
                            <span className="admin-status-pill active">
                              Active
                            </span>
                          </td>
                        </tr>
                      ))}

                      {filteredStudents.length === 0 && (
                        <tr>
                          <td colSpan="4" className="admin-empty-cell">
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
                      View librarian accounts. Add a registered student account to the librarian team or return a librarian account to student.
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
                            <button
                              className="admin-danger-button"
                              onClick={() =>
                                removeLibrarian(librarian.id)
                              }
                            >
                              <i className="bi bi-trash"></i>
                              Remove
                            </button>
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
                    Student ┬╖ eligible
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
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="admin-stat-card">
      <div className="admin-stat-icon">
        <i className={`bi ${icon}`}></i>
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function OverviewRow({ icon, label, value }) {
  return (
    <div className="admin-overview-row">
      <div className="admin-overview-icon">
        <i className={`bi ${icon}`}></i>
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
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
              <td>{item.detail}</td>
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

