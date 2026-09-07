import { useState } from "react";

function StudentDashboard({ onLogout }) {
  const user = JSON.parse(
    localStorage.getItem("loggedInUser")
  );

  const API_URL =
    "https://identify-spilt-cover.ngrok-free.dev";

  const [activeSection, setActiveSection] = useState("");
  const [books, setBooks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [borrowings, setBorrowings] = useState([]);
  const [profile, setProfile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");


  // =========================
  // GET BOOKS
  // =========================

  const getBooks = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/books`,
        {
          headers: {
            "ngrok-skip-browser-warning": "true",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message || "Failed to load books."
        );
        return;
      }

      setBooks(Array.isArray(data) ? data : []);

    } catch (error) {
      console.error(error);
      setMessage("Cannot connect to the server.");

    } finally {
      setLoading(false);
    }
  };


  // =========================
  // BORROW BOOK
  // =========================

  const requestBook = async (bookId) => {
    try {
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/borrow-requests`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },

          body: JSON.stringify({
            user_id: user.id,
            book_id: bookId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            "Unable to submit borrow request."
        );
        return;
      }

      setMessage(
        "Borrow request submitted successfully."
      );

      await getBooks();

    } catch (error) {
      console.error(error);
      setMessage("Cannot connect to the server.");
    }
  };


  // =========================
  // GET STUDENT REQUESTS
  // =========================

  const getMyRequests = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/student/borrow-requests/${user.id}`,
        {
          headers: {
            "ngrok-skip-browser-warning": "true",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            "Failed to load borrow requests."
        );
        return;
      }

      setRequests(data.requests || []);

    } catch (error) {
      console.error(error);
      setMessage("Cannot connect to the server.");

    } finally {
      setLoading(false);
    }
  };


  // =========================
  // GET BORROWED BOOKS
  // =========================

  const getBorrowings = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/student/borrowings/${user.id}`,
        {
          headers: {
            "ngrok-skip-browser-warning": "true",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            "Failed to load borrowed books."
        );
        return;
      }

      if (Array.isArray(data)) {
        setBorrowings(data);
      } else {
        setBorrowings(data.borrowings || []);
      }

    } catch (error) {
      console.error(error);
      setMessage("Cannot connect to the server.");

    } finally {
      setLoading(false);
    }
  };


  // =========================
  // GET PROFILE
  // =========================

  const getProfile = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/student/profile/${user.id}`,
        {
          headers: {
            "ngrok-skip-browser-warning": "true",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message || "Failed to load profile."
        );
        return;
      }

      setProfile(data.user || data);

    } catch (error) {
      console.error(error);
      setMessage("Cannot connect to the server.");

    } finally {
      setLoading(false);
    }
  };


  // =========================
  // OPEN SECTIONS
  // =========================

  const openBooks = () => {
    setActiveSection("books");
    getBooks();
  };


  const openRequests = () => {
    setActiveSection("requests");
    getMyRequests();
  };


  const openBorrowings = () => {
    setActiveSection("borrowings");
    getBorrowings();
  };


  const openProfile = () => {
    setActiveSection("profile");
    getProfile();
  };


  // =========================
  // DATE FORMAT
  // =========================

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleString();
  };


  return (
    <div className="dashboard-page">

      {/* HEADER */}

      <div className="dashboard-header">

        <div>
          <h1>Student Dashboard</h1>

          <p>
            Welcome, {user?.name || "Student"}
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
            Browse available library books
          </p>

          <button onClick={openBooks}>
            View Books
          </button>

        </div>


        {/* REQUESTS */}

        <div className="dashboard-card">

          <div className="dashboard-card-icon">
            <i className="bi bi-arrow-left-right"></i>
          </div>

          <h2>Borrow Requests</h2>

          <p>
            Check your request status
          </p>

          <button onClick={openRequests}>
            My Requests
          </button>

        </div>


        {/* BORROWED BOOKS */}

        <div className="dashboard-card">

          <div className="dashboard-card-icon">
            <i className="bi bi-journal-bookmark"></i>
          </div>

          <h2>Borrowed Books</h2>

          <p>
            View borrowed books and due dates
          </p>

          <button onClick={openBorrowings}>
            View Borrowed Books
          </button>

        </div>


        {/* PROFILE */}

        <div className="dashboard-card">

          <div className="dashboard-card-icon">
            <i className="bi bi-person"></i>
          </div>

          <h2>Profile</h2>

          <p>
            View your student account
          </p>

          <button onClick={openProfile}>
            View Profile
          </button>

        </div>

      </div>


      {/* MESSAGE */}

      {message && (
        <div className="dashboard-message">
          {message}
        </div>
      )}


      {/* =========================
          BOOKS
      ========================= */}

      {activeSection === "books" && (

        <div className="management-section">

          <div className="management-header">

            <div>
              <h2>Available Books</h2>

              <p>
                Select a book you want to borrow.
              </p>
            </div>

            <button
              onClick={() => setActiveSection("")}
            >
              Close
            </button>

          </div>


          {loading ? (

            <p>Loading books...</p>

          ) : books.length === 0 ? (

            <p>No books found.</p>

          ) : (

            <table className="management-table">

              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Author</th>
                  <th>Category</th>
                  <th>Available</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>


              <tbody>

                {books.map((book) => (

                  <tr key={book.id}>

                    <td>{book.id}</td>

                    <td>{book.title}</td>

                    <td>{book.author}</td>

                    <td>
                      {book.category || "-"}
                    </td>

                    <td>
                      {book.available_quantity}
                    </td>

                    <td>
                      {book.status}
                    </td>

                    <td>

                      {book.available_quantity > 0 ? (

                        <button
                          onClick={() =>
                            requestBook(book.id)
                          }
                        >
                          Borrow
                        </button>

                      ) : (

                        <span>
                          Unavailable
                        </span>

                      )}

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          )}

        </div>

      )}


      {/* =========================
          BORROW REQUESTS
      ========================= */}

      {activeSection === "requests" && (

        <div className="management-section">

          <div className="management-header">

            <div>
              <h2>My Borrow Requests</h2>

              <p>
                View the status of your book requests.
              </p>
            </div>

            <button
              onClick={() => setActiveSection("")}
            >
              Close
            </button>

          </div>


          {loading ? (

            <p>Loading requests...</p>

          ) : requests.length === 0 ? (

            <p>No borrow requests found.</p>

          ) : (

            <table className="management-table">

              <thead>
                <tr>
                  <th>ID</th>
                  <th>Book</th>
                  <th>Requested</th>
                  <th>Status</th>
                </tr>
              </thead>


              <tbody>

                {requests.map((request) => (

                  <tr key={request.id}>

                    <td>
                      {request.id}
                    </td>

                    <td>
                      {request.book_title}
                    </td>

                    <td>
                      {formatDate(
                        request.requested_at
                      )}
                    </td>

                    <td>
                      {request.status}
                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          )}

        </div>

      )}


      {/* =========================
          BORROWED BOOKS
      ========================= */}

      {activeSection === "borrowings" && (

        <div className="management-section">

          <div className="management-header">

            <div>
              <h2>Borrowed Books</h2>

              <p>
                View your borrowed books and return dates.
              </p>
            </div>

            <button
              onClick={() => setActiveSection("")}
            >
              Close
            </button>

          </div>


          {loading ? (

            <p>Loading borrowed books...</p>

          ) : borrowings.length === 0 ? (

            <p>No borrowing records found.</p>

          ) : (

            <table className="management-table">

              <thead>
                <tr>
                  <th>ID</th>
                  <th>Book</th>
                  <th>Borrowed</th>
                  <th>Due Date</th>
                  <th>Returned</th>
                  <th>Status</th>
                </tr>
              </thead>


              <tbody>

                {borrowings.map((borrowing) => (

                  <tr key={borrowing.id}>

                    <td>
                      {borrowing.id}
                    </td>

                    <td>
                      {borrowing.book_title ||
                        borrowing.title ||
                        `Book #${borrowing.book_id}`}
                    </td>

                    <td>
                      {formatDate(
                        borrowing.borrowed_at
                      )}
                    </td>

                    <td>
                      {formatDate(
                        borrowing.due_date
                      )}
                    </td>

                    <td>
                      {borrowing.returned_at
                        ? formatDate(
                            borrowing.returned_at
                          )
                        : "Not returned"}
                    </td>

                    <td>
                      {borrowing.status}
                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          )}

        </div>

      )}


      {/* =========================
          PROFILE
      ========================= */}

      {activeSection === "profile" && (

        <div className="management-section">

          <div className="management-header">

            <div>
              <h2>Student Profile</h2>

              <p>
                Your LibSync account information.
              </p>
            </div>

            <button
              onClick={() => setActiveSection("")}
            >
              Close
            </button>

          </div>


          {loading ? (

            <p>Loading profile...</p>

          ) : profile ? (

            <div>

              <p>
                <strong>ID:</strong>{" "}
                {profile.id}
              </p>

              <p>
                <strong>Name:</strong>{" "}
                {profile.name}
              </p>

              <p>
                <strong>Email:</strong>{" "}
                {profile.email}
              </p>

              <p>
                <strong>Role:</strong>{" "}
                {profile.role}
              </p>

            </div>

          ) : (

            <p>Profile not found.</p>

          )}

        </div>

      )}

    </div>
  );
}

export default StudentDashboard;