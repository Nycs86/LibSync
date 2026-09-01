function LibrarianDashboard({ onLogout }) {
  const user = JSON.parse(
    localStorage.getItem("loggedInUser")
  );

  return (
    <div className="dashboard-page">

      {/* HEADER */}
      <div className="dashboard-header">
        <div>
          <h1>Librarian Dashboard</h1>
          <p>
            Welcome, {user?.name || "Librarian"}
          </p>
        </div>

        <button
          className="logout-button"
          onClick={onLogout}
        >
          Logout
        </button>
      </div>

      {/* DASHBOARD CARDS */}
      <div className="dashboard-cards">

        {/* BOOKS */}
        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <i className="bi bi-book"></i>
          </div>

          <h2>Books</h2>

          <p>
            Manage library books
          </p>

          <button>
            Manage Books
          </button>
        </div>

        {/* STUDENTS */}
        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <i className="bi bi-people"></i>
          </div>

          <h2>Students</h2>

          <p>
            View registered students
          </p>

          <button>
            View Students
          </button>
        </div>

        {/* BORROW REQUESTS */}
        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <i className="bi bi-arrow-left-right"></i>
          </div>

          <h2>Borrow Requests</h2>

          <p>
            Review student requests
          </p>

          <button>
            View Requests
          </button>
        </div>

        {/* BORROWING RECORDS */}
        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <i className="bi bi-journal-text"></i>
          </div>

          <h2>Borrowing Records</h2>

          <p>
            Track borrowed books
          </p>

          <button>
            View Records
          </button>
        </div>

      </div>

    </div>
  );
}

export default LibrarianDashboard;