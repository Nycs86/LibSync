import { useState } from "react";

function LibrarianDashboard({ onLogout }) {
  const user = JSON.parse(
    localStorage.getItem("loggedInUser")
  );

  const API_URL =
    "https://identify-spilt-cover.ngrok-free.dev";

  const [activeSection, setActiveSection] = useState("");
  const [borrowRequests, setBorrowRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");


  const getBorrowRequests = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/borrow-requests`,
        {
          method: "GET",
          headers: {
            "ngrok-skip-browser-warning": "true",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message || "Failed to load borrow requests."
        );
        return;
      }

      setBorrowRequests(data.requests || []);

    } catch (error) {
      console.error(error);
      setMessage("Cannot connect to the server.");

    } finally {
      setLoading(false);
    }
  };


  const openBorrowRequests = () => {
    setActiveSection("requests");
    getBorrowRequests();
  };


  const handleDecision = async (requestId, decision) => {
    try {
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/borrow-requests/${requestId}/decision`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-User-ID": user.id,
            "ngrok-skip-browser-warning": "true",
          },

          body: JSON.stringify({
            decision: decision,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message || "Failed to process request."
        );
        return;
      }

      if (decision === "approved") {
        setMessage(
          "Borrow request approved successfully."
        );
      } else {
        setMessage(
          "Borrow request declined successfully."
        );
      }

      await getBorrowRequests();

    } catch (error) {
      console.error(error);
      setMessage("Cannot connect to the server.");
    }
  };


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

          <button
            onClick={() =>
              setActiveSection("books")
            }
          >
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

          <button
            onClick={() =>
              setActiveSection("students")
            }
          >
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

          <button
            onClick={openBorrowRequests}
          >
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

          <button
            onClick={() =>
              setActiveSection("records")
            }
          >
            View Records
          </button>

        </div>

      </div>


      {/* MESSAGE */}
      {message && (
        <div className="dashboard-message">
          {message}
        </div>
      )}


      {/* BORROW REQUEST SECTION */}
      {activeSection === "requests" && (

        <div className="management-section">

          <div className="management-header">

            <div>
              <h2>Borrow Requests</h2>

              <p>
                Review and process student book requests.
              </p>
            </div>

            <button
              onClick={() =>
                setActiveSection("")
              }
            >
              Close
            </button>

          </div>


          {loading ? (

            <p>Loading borrow requests...</p>

          ) : borrowRequests.length === 0 ? (

            <p>No borrow requests found.</p>

          ) : (

            <table className="management-table">

              <thead>
                <tr>
                  <th>ID</th>
                  <th>Student</th>
                  <th>Email</th>
                  <th>Book</th>
                  <th>Date Requested</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>


              <tbody>

                {borrowRequests.map((request) => (

                  <tr key={request.id}>

                    <td>
                      {request.id}
                    </td>

                    <td>
                      {request.user_name}
                    </td>

                    <td>
                      {request.user_email}
                    </td>

                    <td>
                      {request.book_title}
                    </td>

                    <td>
                      {request.requested_at
                        ? new Date(
                            request.requested_at
                          ).toLocaleString()
                        : ""}
                    </td>

                    <td>
                      {request.status}
                    </td>


                    <td>

                      {request.status === "pending" ? (

                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                          }}
                        >

                          <button
                            onClick={() =>
                              handleDecision(
                                request.id,
                                "approved"
                              )
                            }
                          >
                            Approve
                          </button>


                          <button
                            onClick={() =>
                              handleDecision(
                                request.id,
                                "declined"
                              )
                            }
                          >
                            Decline
                          </button>

                        </div>

                      ) : (

                        <span>
                          Processed
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


      {/* BOOKS PLACEHOLDER */}
      {activeSection === "books" && (

        <div className="management-section">

          <h2>Books</h2>

          <p>
            Book management will be added next.
          </p>

          <button
            onClick={() =>
              setActiveSection("")
            }
          >
            Close
          </button>

        </div>

      )}


      {/* STUDENTS PLACEHOLDER */}
      {activeSection === "students" && (

        <div className="management-section">

          <h2>Students</h2>

          <p>
            Student list will be added next.
          </p>

          <button
            onClick={() =>
              setActiveSection("")
            }
          >
            Close
          </button>

        </div>

      )}


      {/* BORROWING RECORDS PLACEHOLDER */}
      {activeSection === "records" && (

        <div className="management-section">

          <h2>Borrowing Records</h2>

          <p>
            Borrowing records will be added next.
          </p>

          <button
            onClick={() =>
              setActiveSection("")
            }
          >
            Close
          </button>

        </div>

      )}

    </div>
  );
}

export default LibrarianDashboard;