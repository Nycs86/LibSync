import { useState } from "react";

function AdminDashboard({ onLogout }) {
  const user = JSON.parse(
    localStorage.getItem("loggedInUser")
  );

  const API_URL = "https://identify-spilt-cover.ngrok-free.dev";

  const [activeSection, setActiveSection] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");


  const getUsers = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(`${API_URL}/api/users`, {
        method: "GET",
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Failed to get users.");
        return;
      }

      setUsers(data);

    } catch (error) {
      console.error(error);
      setMessage("Cannot connect to the server.");
    } finally {
      setLoading(false);
    }
  };


  const openStudents = () => {
    setActiveSection("students");
    getUsers();
  };


  const openLibrarians = () => {
    setActiveSection("librarians");
    getUsers();
  };


  const assignAsLibrarian = async (studentId) => {
    try {
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/users/${studentId}/assign-librarian`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-User-ID": user.id,
            "ngrok-skip-browser-warning": "true",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Failed to assign librarian.");
        return;
      }

      setMessage("Student assigned as librarian successfully.");

      await getUsers();

    } catch (error) {
      console.error(error);
      setMessage("Cannot connect to the server.");
    }
  };

  const removeLibrarian = async (librarianId) => {
  try {
    setMessage("");

    const response = await fetch(
      `${API_URL}/api/users/${librarianId}/remove-librarian`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": user.id,
          "ngrok-skip-browser-warning": "true",
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


  const students = users.filter(
    (account) => account.role === "student"
  );

  const librarians = users.filter(
    (account) => account.role === "librarian"
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

          <button onClick={openLibrarians}>
            Manage Librarians
          </button>
        </div>


        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <i className="bi bi-mortarboard"></i>
          </div>

          <h2>Students</h2>
          <p>Manage library users</p>

          <button onClick={openStudents}>
            Manage Students
          </button>
        </div>


        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <i className="bi bi-book"></i>
          </div>

          <h2>Books</h2>
          <p>Manage library books</p>

          <button onClick={() => setActiveSection("books")}>
            Manage Books
          </button>
        </div>


        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <i className="bi bi-arrow-left-right"></i>
          </div>

          <h2>Borrow Requests</h2>
          <p>View and manage requests</p>

          <button onClick={() => setActiveSection("requests")}>
            View Requests
          </button>
        </div>

      </div>


      {message && (
        <div className="dashboard-message">
          {message}
        </div>
      )}


      {activeSection === "students" && (
        <div className="management-section">

          <div className="management-header">
            <div>
              <h2>Students</h2>
              <p>
                Select a student to assign as librarian.
              </p>
            </div>

            <button
              onClick={() => setActiveSection("")}
            >
              Close
            </button>
          </div>


          {loading ? (
            <p>Loading students...</p>
          ) : students.length === 0 ? (
            <p>No students found.</p>
          ) : (
            <table className="management-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td>{student.id}</td>
                    <td>{student.name}</td>
                    <td>{student.email}</td>
                    <td>{student.role}</td>

                    <td>
                      <button
                        onClick={() =>
                          assignAsLibrarian(student.id)
                        }
                      >
                        Assign as Librarian
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

        </div>
      )}


      {activeSection === "librarians" && (
        <div className="management-section">

          <div className="management-header">
            <div>
              <h2>Librarians</h2>
              <p>Current library staff accounts.</p>
            </div>

            <button
              onClick={() => setActiveSection("")}
            >
              Close
            </button>
          </div>


          {loading ? (
            <p>Loading librarians...</p>
          ) : librarians.length === 0 ? (
            <p>No librarians found.</p>
          ) : (
            <table className="management-table">
             <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                  {librarians.map((librarian) => (
                    <tr key={librarian.id}>
                      <td>{librarian.id}</td>
                      <td>{librarian.name}</td>
                      <td>{librarian.email}</td>
                      <td>{librarian.role}</td>

                      <td>
                        <button
                          onClick={() => removeLibrarian(librarian.id)}
                        >
                          Remove Librarian
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

        </div>
      )}


      {activeSection === "books" && (
        <div className="management-section">
          <h2>Books</h2>
          <p>Book management will be added next.</p>

          <button
            onClick={() => setActiveSection("")}
          >
            Close
          </button>
        </div>
      )}


      {activeSection === "requests" && (
        <div className="management-section">
          <h2>Borrow Requests</h2>
          <p>Borrow request management will be added next.</p>

          <button
            onClick={() => setActiveSection("")}
          >
            Close
          </button>
        </div>
      )}

    </div>
  );
}

export default AdminDashboard;