function AdminDashboard({ onLogout }) {
  const user = JSON.parse(
    localStorage.getItem("loggedInUser")
  );

  return (
    <div className="dashboard-page">

      <div className="dashboard-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p>Welcome, {user?.name || "Administrator"}</p>
        </div>

        <button
          className="logout-button"
          onClick={onLogout}
        >
          Logout
        </button>
      </div>

      <div className="dashboard-cards">

        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <i className="bi bi-people"></i>
          </div>

          <h2>Librarians</h2>
          <p>Manage library staff</p>

          <button>
            Manage Librarians
          </button>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <i className="bi bi-mortarboard"></i>
          </div>

          <h2>Students</h2>
          <p>Manage library users</p>

          <button>
            Manage Students
          </button>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <i className="bi bi-book"></i>
          </div>

          <h2>Books</h2>
          <p>Manage library books</p>

          <button>
            Manage Books
          </button>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <i className="bi bi-arrow-left-right"></i>
          </div>

          <h2>Borrow Requests</h2>
          <p>View and manage requests</p>

          <button>
            View Requests
          </button>
        </div>

      </div>

    </div>
  );
}

export default AdminDashboard;