import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import OnlineBookSearch from "./OnlineBookSearch";
import "./online_book_search.css";

const API_URL =
  "https://identify-spilt-cover.ngrok-free.dev";

// ==========================================
// QR SCANNER COMPONENT
// ==========================================
function QRScanner({ onScan }) {
  const onScanRef = useRef(onScan);
  const hasScannedRef = useRef(false);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let scanner;
    let disposed = false;

    try {
      scanner = new Html5QrcodeScanner(
        "libsync-qr-reader",
        {
          fps: 10,
          qrbox: {
            width: 250,
            height: 250,
          },
          aspectRatio: 1,
        },
        false
      );

      scanner.render(
        async (decodedText) => {
          // Ignore duplicate detections.
          if (hasScannedRef.current || disposed) {
            return;
          }

          hasScannedRef.current = true;

          try {
            await scanner.clear();
          } catch (error) {
            console.warn("Scanner cleanup:", error);
          }

          if (!disposed) {
            onScanRef.current(decodedText);
          }
        },
        () => {
          // Normal: no QR detected in this frame.
        }
      );
    } catch (error) {
      console.error("Scanner initialization error:", error);
    }

    return () => {
      disposed = true;

      if (scanner) {
        scanner.clear().catch(() => {});
      }
    };
  }, []);

  return (
    <div
      id="libsync-qr-reader"
      style={{
        width: "100%",
        maxWidth: "500px",
        margin: "20px auto",
      }}
    />
  );
}

// ==========================================
// LIBRARIAN DASHBOARD
// ==========================================
function LibrarianDashboard({ onLogout }) {
  const user = JSON.parse(
    localStorage.getItem("loggedInUser") || "null"
  );

  const [activeSection, setActiveSection] = useState("");
  const [borrowRequests, setBorrowRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [lookupLoading, setLookupLoading] = useState(false);
  const [scannedToken, setScannedToken] = useState("");
  const [scannedBatch, setScannedBatch] = useState(null);
  const [processingRequestId, setProcessingRequestId] =
    useState(null);

  const librarianHeaders = {
    "X-User-ID": String(user?.id ?? ""),
    "ngrok-skip-browser-warning": "true",
  };

  // ==========================================
  // LOAD ALL BORROW REQUESTS
  // ==========================================
  const getBorrowRequests = async (clearMessage = true) => {
    try {
      setLoading(true);

      if (clearMessage) {
        setMessage("");
      }

      const response = await fetch(
        `${API_URL}/api/borrow-requests`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "ngrok-skip-browser-warning": "true",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to load borrow requests."
        );
      }

      setBorrowRequests(data.requests || []);
    } catch (error) {
      console.error("Load requests error:", error);

      setMessage(
        error.message || "Cannot connect to the server."
      );
    } finally {
      setLoading(false);
    }
  };

  const openBorrowRequests = () => {
    setActiveSection("requests");
    getBorrowRequests();
  };

  // ==========================================
  // LOOK UP A BORROW BATCH USING THE QR TOKEN
  // ==========================================
  const lookupBatchByToken = async (token) => {
    const response = await fetch(
      `${API_URL}/api/borrow-batches/lookup`,
      {
        method: "POST",
        headers: {
          ...librarianHeaders,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          qr_token: token,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Unable to find this borrowing batch."
      );
    }

    if (!data.batch) {
      throw new Error(
        "The server did not return borrowing batch details."
      );
    }

    return data.batch;
  };

  // ==========================================
  // HANDLE A SUCCESSFUL QR SCAN
  // ==========================================
  const handleScan = async (decodedText) => {
    if (lookupLoading) {
      return;
    }

    const token = decodedText.trim();

    if (!token) {
      setMessage("The scanned QR code is empty.");
      return;
    }

    setLookupLoading(true);
    setMessage("");
    setScannedBatch(null);

    try {
      const batch = await lookupBatchByToken(token);

      setScannedToken(token);
      setScannedBatch(batch);
      setActiveSection("scan-result");

      setMessage(
        `Borrowing batch #${batch.id} scanned successfully.`
      );
    } catch (error) {
      console.error("QR lookup error:", error);

      setMessage(
        error.message ||
          "Unable to retrieve the scanned borrowing request."
      );
    } finally {
      setLookupLoading(false);
    }
  };

  // ==========================================
  // APPROVE OR DECLINE AN INDIVIDUAL BOOK
  // ==========================================
  const handleDecision = async (requestId, decision) => {
    if (processingRequestId !== null) {
      return;
    }

    try {
      setProcessingRequestId(requestId);
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/borrow-requests/${requestId}/decision`,
        {
          method: "PUT",
          headers: {
            ...librarianHeaders,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            decision,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to process borrow request."
        );
      }

      const successMessage =
        decision === "approved"
          ? "Book borrowing request approved successfully."
          : "Book borrowing request declined successfully.";

      // Refresh the full request list.
      await getBorrowRequests(false);

      // Refresh the scanned batch so the displayed statuses
      // reflect the latest database values.
      if (scannedToken) {
        try {
          const updatedBatch =
            await lookupBatchByToken(scannedToken);

          setScannedBatch(updatedBatch);
        } catch (refreshError) {
          console.error(
            "Refresh scanned batch error:",
            refreshError
          );
        }
      }

      setMessage(
        data.message || successMessage
      );
    } catch (error) {
      console.error("Borrow decision error:", error);

      setMessage(
        error.message || "Cannot connect to the server."
      );
    } finally {
      setProcessingRequestId(null);
    }
  };

  // ==========================================
  // REUSABLE APPROVE / DECLINE BUTTONS
  // ==========================================
  const renderDecisionButtons = (request) => {
    if (request.status !== "pending") {
      return (
        <span>
          {request.status}
        </span>
      );
    }

    const busy = processingRequestId !== null;

    return (
      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            handleDecision(
              request.request_id ?? request.id,
              "approved"
            )
          }
        >
          {processingRequestId ===
          (request.request_id ?? request.id)
            ? "Processing..."
            : "Approve"}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            handleDecision(
              request.request_id ?? request.id,
              "declined"
            )
          }
        >
          Decline
        </button>
      </div>
    );
  };

  // ==========================================
  // DASHBOARD UI
  // ==========================================
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
          type="button"
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
          <p>Manage library books</p>

          <button
            type="button"
            onClick={() => setActiveSection("books")}
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
          <p>View registered students</p>

          <button
            type="button"
            onClick={() => setActiveSection("students")}
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
          <p>Review student requests</p>

          <button
            type="button"
            onClick={openBorrowRequests}
          >
            View Requests
          </button>
        </div>

        {/* QR SCANNER */}
        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <i className="bi bi-qr-code-scan"></i>
          </div>

          <h2>Scan QR Code</h2>
          <p>Scan a student's borrowing request</p>

          <button
            type="button"
            onClick={() => {
              setMessage("");
              setScannedBatch(null);
              setScannedToken("");
              setActiveSection("scan");
            }}
          >
            Open Scanner
          </button>
        </div>

        {/* BORROWING RECORDS */}
        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <i className="bi bi-journal-text"></i>
          </div>

          <h2>Borrowing Records</h2>
          <p>Track borrowed books</p>

          <button
            type="button"
            onClick={() => setActiveSection("records")}
          >
            View Records
          </button>
        </div>

      </div>

      {/* MESSAGE */}
      {message && (
        <div
          className="dashboard-message"
          role="status"
        >
          {message}
        </div>
      )}

      {/* ===================================== */}
      {/* QR SCANNER SECTION */}
      {/* ===================================== */}
      {activeSection === "scan" && (
        <div className="management-section">

          <div className="management-header">
            <div>
              <h2>Scan Borrowing QR</h2>

              <p>
                Point your camera at the QR code shown
                by the student.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveSection("")}
            >
              Close
            </button>
          </div>

          {lookupLoading ? (
            <p>Looking up the borrowing batch...</p>
          ) : (
            <QRScanner onScan={handleScan} />
          )}

          <p>
            Allow camera access in your browser when prompted.
          </p>
        </div>
      )}

      {/* ===================================== */}
      {/* SCANNED BATCH DETAILS */}
      {/* ===================================== */}
      {activeSection === "scan-result" && scannedBatch && (
        <div className="management-section">

          <div className="management-header">
            <div>
              <h2>Scanned Borrowing Request</h2>

              <p>
                Batch ID: {scannedBatch.id}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveSection("scan")}
            >
              Scan Another
            </button>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <h3>Student Information</h3>

            <p>
              <strong>Name:</strong>{" "}
              {scannedBatch.student_name}
            </p>

            <p>
              <strong>Email:</strong>{" "}
              {scannedBatch.student_email}
            </p>

            <p>
              <strong>Batch Status:</strong>{" "}
              {scannedBatch.status}
            </p>

            <p>
              <strong>Date Requested:</strong>{" "}
              {scannedBatch.requested_at
                ? new Date(
                    scannedBatch.requested_at
                  ).toLocaleString()
                : "N/A"}
            </p>
          </div>

          <h3>Selected Books</h3>

          {!scannedBatch.requests ||
          scannedBatch.requests.length === 0 ? (
            <p>No book requests found in this batch.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="management-table">
                <thead>
                  <tr>
                    <th>Request ID</th>
                    <th>Book ID</th>
                    <th>Book Title</th>
                    <th>Author</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {scannedBatch.requests.map((request) => (
                    <tr key={request.request_id}>
                      <td>{request.request_id}</td>
                      <td>{request.book_id}</td>
                      <td>{request.book_title}</td>
                      <td>{request.author || "N/A"}</td>
                      <td>{request.status}</td>
                      <td>
                        {renderDecisionButtons(request)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p style={{ marginTop: "20px" }}>
            Each book request is processed individually.
            Approved requests create borrowing records;
            declined requests do not reduce availability.
          </p>

        </div>
      )}

      {/* ===================================== */}
      {/* ALL BORROW REQUESTS */}
      {/* ===================================== */}
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
              type="button"
              onClick={() => setActiveSection("")}
            >
              Close
            </button>
          </div>

          {loading ? (
            <p>Loading borrow requests...</p>
          ) : borrowRequests.length === 0 ? (
            <p>No borrow requests found.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
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
                      <td>{request.id}</td>
                      <td>{request.user_name}</td>
                      <td>{request.user_email}</td>
                      <td>{request.book_title}</td>

                      <td>
                        {request.requested_at
                          ? new Date(
                              request.requested_at
                            ).toLocaleString()
                          : "N/A"}
                      </td>

                      <td>{request.status}</td>

                      <td>
                        {renderDecisionButtons(request)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* BOOKS PLACEHOLDER */}
      {activeSection === "books" && (
        <div className="management-section">
          <h2>Books</h2>
          <p>Book management will be added next.</p>

          <button
            type="button"
            onClick={() => setActiveSection("")}
          >
            Close
          </button>
        </div>
      )}

      {/* STUDENTS PLACEHOLDER */}
      {activeSection === "students" && (
        <div className="management-section">
          <h2>Students</h2>
          <p>Student list will be added next.</p>

          <button
            type="button"
            onClick={() => setActiveSection("")}
          >
            Close
          </button>
        </div>
      )}

      {/* BORROWING RECORDS PLACEHOLDER */}
      {activeSection === "records" && (
        <div className="management-section">
          <h2>Borrowing Records</h2>
          <p>Borrowing records will be added next.</p>

          <button
            type="button"
            onClick={() => setActiveSection("")}
          >
            Close
          </button>
        </div>
      )}

    </div>
  );
}

export default LibrarianDashboard;