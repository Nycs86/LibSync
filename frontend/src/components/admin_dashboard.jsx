import { useEffect, useMemo, useState } from "react";
import "./admin_dashboard.css";

const API_URL = "https://libsync-backend.onrender.com";

function AdminDashboard({ onLogout }) {
  const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");

  const [activeSection, setActiveSection] = useState("dashboard");
  const [userFilter, setUserFilter] = useState("all");
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

  const getUsers = async () => {
    const response = await fetch(`${API_URL}/api/users`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to load users.");
    }

    setUsers(Array.isArray(data) ? data : data.users || []);
    return data;
  };

  const getBooks = async () => {
    const response = await fetch(`${API_URL}/api/books`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to load books.");
    }

    setBooks(Array.isArray(data) ? data : data.books || []);
    return data;
  };

  const getBorrowings = async () => {
    const response = await fetch(`${API_URL}/api/borrowings`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to load borrowings.");
    }

    setBorrowings(Array.isArray(data) ? data : data.borrowings || []);
    return data;
  };

  const getBorrowRequests = async () => {
    const response = await fetch(`${API_URL}/api/borrow-requests`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to load borrow requests.");
    }

    setRequests(Array.isArray(data) ? data : data.requests || []);
    return data;
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setMessage("");

      await Promise.all([
        getUsers(),
        getBooks(),
        getBorrowings(),
        getBorrowRequests(),
      ]);
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

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

  const filteredUsers = useMemo(() => {
    let source = users;

    if (userFilter === "students") source = students;
    if (userFilter === "librarians") source = librarians;

    const term = search.trim().toLowerCase();

    if (!term) return source;

    return source.filter(
      (account) =>
        account.name?.toLowerCase().includes(term) ||
        account.email?.toLowerCase().includes(term) ||
        String(account.id).includes(term)
    );
  }, [users, students, librarians, userFilter, search]);

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

  const assignAsLibrarian = async (studentId) => {
    try {
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/users/${studentId}/assign-librarian`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-User-ID": String(user?.id || ""),
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Failed to assign librarian.");
        return;
      }

      setMessage("User assigned as librarian successfully.");
      setAssignModalOpen(false);
      setAssignSearch("");
      setSelectedStudent(null);
      await getUsers();
    } catch (error) {
      console.error(error);
      setMessage("Cannot connect to the server.");
    }
  };

  const removeLibrarian = async (librarianId) => {
    const confirmed = window.confirm(
      "Remove this librarian and return the account to Student?"
    );

    if (!confirmed) return;

    try {
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/users/${librarianId}/remove-librarian`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-User-ID": String(user?.id || ""),
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Failed to remove librarian.");
        return;
      }

      setMessage("Librarian returned to student successfully.");
      await getUsers();
    } catch (error) {
      console.error(error);
      setMessage("Cannot connect to the server.");
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
    const requestActivity = requests.map((item) => ({
      id: `request-${item.id}`,
      type: "Request",
      title:
        item.status === "pending"
          ? "Borrow request submitted"
          : `Borrow request ${item.status}`,
      detail: `${item.user_name || `User #${item.user_id}`} • ${
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
      detail: `${item.user_name || `User #${item.user_id}`} • ${
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
    ["users", "bi-people", "Users"],
    ["librarians", "bi-person-badge", "Librarians"],
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
        <div className="admin-brand">
          <div className="admin-brand-icon">
            <i className="bi bi-book-half"></i>
          </div>
          <div>
            <strong>LibSync</strong>
            <span>ADMIN PANEL</span>
          </div>
        </div>

        <nav className="admin-nav">
          {navItems.map(([key, icon, label]) => (
            <button
              key={key}
              className={activeSection === key ? "active" : ""}
              onClick={() => openSection(key)}
            >
              <i className={`bi ${icon}`}></i>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <button onClick={onLogout}>
            <i className="bi bi-box-arrow-left"></i>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1>
              {activeSection === "dashboard" && "Admin Dashboard"}
              {activeSection === "users" && "Users"}
              {activeSection === "librarians" && "Librarians"}
              {activeSection === "activity" && "System Activity"}
            </h1>
            <p>
              {activeSection === "dashboard" &&
                "System overview and library statistics"}
              {activeSection === "users" &&
                "View all system users, students, and librarians"}
              {activeSection === "librarians" &&
                "Manage librarian accounts and permissions"}
              {activeSection === "activity" &&
                "Recent borrowing and request activity"}
            </p>
          </div>

          <div className="admin-profile">
            <div className="admin-avatar">
              {(user?.name || "A").charAt(0).toUpperCase()}
            </div>
            <div>
              <strong>{user?.name || "Administrator"}</strong>
              <span>Administrator</span>
            </div>
          </div>
        </header>

        {message && <div className="admin-message">{message}</div>}

        {loading && activeSection === "dashboard" ? (
          <div className="admin-loading">Loading admin dashboard...</div>
        ) : (
          <>
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
                        Assign Librarian
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
                  <div className="admin-tabs">
                    <button
                      className={userFilter === "all" ? "active" : ""}
                      onClick={() => setUserFilter("all")}
                    >
                      All Users ({users.length})
                    </button>
                    <button
                      className={userFilter === "students" ? "active" : ""}
                      onClick={() => setUserFilter("students")}
                    >
                      Students ({students.length})
                    </button>
                    <button
                      className={userFilter === "librarians" ? "active" : ""}
                      onClick={() => setUserFilter("librarians")}
                    >
                      Librarians ({librarians.length})
                    </button>
                  </div>

                  <div className="admin-search">
                    <i className="bi bi-search"></i>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by name, email, or ID"
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
                        <th>Role</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((account) => (
                        <tr key={account.id}>
                          <td>#{account.id}</td>
                          <td>{account.name}</td>
                          <td>{account.email}</td>
                          <td>
                            <span
                              className={`admin-role-pill ${account.role}`}
                            >
                              {account.role}
                            </span>
                          </td>
                          <td>
                            <span className="admin-status-pill active">
                              Active
                            </span>
                          </td>
                        </tr>
                      ))}

                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan="5" className="admin-empty-cell">
                            No users found.
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
                      Admin can assign a student account as librarian or
                      return a librarian account to student.
                    </p>
                  </div>

                  <button
                    className="admin-primary-button"
                    onClick={() => setAssignModalOpen(true)}
                  >
                    <i className="bi bi-plus-lg"></i>
                    Assign Librarian
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
                    onClick={loadDashboard}
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
                <h2>Assign Librarian</h2>
                <p>Select an existing student account.</p>
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
                placeholder="Search student by name or email"
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
                    Student
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
                  assignAsLibrarian(selectedStudent.id)
                }
              >
                Assign as Librarian
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
