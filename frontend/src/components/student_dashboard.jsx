import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

const API_BASE_URL =
  "https://identify-spilt-cover.ngrok-free.dev";

function StudentDashboard({ onLogout }) {
  const storedUser = localStorage.getItem("loggedInUser");
  const user = storedUser ? JSON.parse(storedUser) : null;

  const [activeMenu, setActiveMenu] = useState("books");

  const [books, setBooks] = useState([]);
  const [selectedBooks, setSelectedBooks] = useState([]);
  const [qrRequest, setQrRequest] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [pageError, setPageError] = useState("");

  // ==========================================
  // LOAD ACTUAL BOOKS FROM MYSQL
  // ==========================================
  useEffect(() => {
    let cancelled = false;

    const loadBooks = async () => {
      setIsLoading(true);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/books`,
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
            data.message || "Unable to load books."
          );
        }

        if (!Array.isArray(data)) {
          throw new Error(
            "Unexpected response from the books API."
          );
        }

        const formattedBooks = data.map((book) => {
          const availableQuantity = Number(
            book.available_quantity ?? 0
          );

          return {
            id: Number(book.id),
            title: book.title || "Untitled Book",
            author: book.author || "Unknown Author",
            category: book.category || "Uncategorized",
            availableQuantity,
            available: availableQuantity > 0,
          };
        });

        if (!cancelled) {
          setBooks(formattedBooks);
        }
      } catch (error) {
        console.error("Load books error:", error);

        if (!cancelled) {
          setPageError(
            error.message || "Unable to load library books."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadBooks();

    return () => {
      cancelled = true;
    };
  }, []);

  // ==========================================
  // LOAD EXISTING BORROW BATCHES
  // ==========================================
  // This allows a student to retrieve an existing
  // borrowing batch after refreshing the dashboard.
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;

    const loadBorrowBatches = async () => {
      setBatchesLoading(true);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/student/borrow-batches/${user.id}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              "ngrok-skip-browser-warning": "true",
              "X-User-ID": String(user.id),
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load borrowing batches."
          );
        }

        const batches = Array.isArray(data.batches)
          ? data.batches
          : [];

        // Find the latest active batch that has a QR token.
        const existingBatch = batches.find(
          (batch) =>
            batch.qr_token &&
            [
              "pending",
              "approved",
              "partially_returned",
            ].includes(batch.status)
        );

        if (!cancelled && existingBatch) {
          const batchBooks = Array.isArray(existingBatch.books)
            ? existingBatch.books
            : [];

          setQrRequest({
            batchId: existingBatch.id,
            requestIds: batchBooks
              .map((book) => Number(book.request_id))
              .filter(Number.isFinite),
            qrPayload: existingBatch.qr_token,
            status: existingBatch.status,
            books: batchBooks.map((book) => ({
              id: Number(book.book_id),
              title: book.title || "Untitled Book",
              author: book.author || "Unknown Author",
            })),
          });
        }
      } catch (error) {
        console.error("Load borrowing batches error:", error);

        if (!cancelled) {
          setPageError(
            error.message ||
              "Unable to retrieve your existing borrowing request."
          );
        }
      } finally {
        if (!cancelled) {
          setBatchesLoading(false);
        }
      }
    };

    loadBorrowBatches();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // ==========================================
  // SELECT A BOOK
  // ==========================================
  const addBook = (book) => {
    setPageError("");

    const alreadySelected = selectedBooks.some(
      (item) => item.id === book.id
    );

    if (alreadySelected || !book.available) {
      return;
    }

    setSelectedBooks((previous) => [
      ...previous,
      book,
    ]);
  };

  // ==========================================
  // REMOVE A SELECTED BOOK
  // ==========================================
  const removeBook = (bookId) => {
    setSelectedBooks((previous) =>
      previous.filter((book) => book.id !== bookId)
    );
  };

  // ==========================================
  // SUBMIT MULTIPLE BOOKS AND GENERATE ONE QR
  // ==========================================
  const handleGenerateQR = async () => {
    setPageError("");

    if (!user?.id || !Number.isInteger(Number(user.id))) {
      setPageError(
        "Your student ID is missing. Please log in again."
      );
      return;
    }

    if (selectedBooks.length === 0) {
      setPageError("Please select at least one book.");
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/borrow-requests`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({
            user_id: Number(user.id),
            book_ids: selectedBooks.map(
              (book) => book.id
            ),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to submit your borrowing request."
        );
      }

      // Use the token created and returned by Flask.
      // Never create a replacement token in the frontend.
      const qrPayload = data.qr_payload || data.qr_token;

      if (!qrPayload) {
        setPageError(
          "The request was accepted, but the backend did not " +
            "return a QR token. Check your existing borrowing batch " +
            "before trying again to avoid duplicate requests."
        );
        return;
      }

      setQrRequest({
        batchId: data.batch_id,
        requestIds: data.request_ids || [],
        qrPayload,
        status: "pending",
        books: [...selectedBooks],
      });

      setSelectedBooks([]);
      setActiveMenu("qr");
    } catch (error) {
      console.error("Submit borrowing request error:", error);

      setPageError(
        error.message ||
          "Unable to submit your borrowing request."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // ==========================================
  // DASHBOARD UI
  // ==========================================
  return (
    <div className="student-dashboard">

      {/* HEADER */}
      <header className="student-header">
        <div>
          <h1>Student Dashboard</h1>

          <p>
            Welcome, {user?.name || "Student"}!
          </p>
        </div>

        <button
          type="button"
          className="student-logout"
          onClick={onLogout}
        >
          <i className="bi bi-box-arrow-right"></i>
          Logout
        </button>
      </header>

      {/* BODY */}
      <div className="student-body">

        {/* SIDEBAR */}
        <aside className="student-sidebar">

          <button
            type="button"
            className={
              activeMenu === "books"
                ? "student-menu active"
                : "student-menu"
            }
            onClick={() => {
              setActiveMenu("books");
              setPageError("");
            }}
          >
            <i className="bi bi-book"></i>
            <span>Books</span>
          </button>

          <button
            type="button"
            className={
              activeMenu === "selected"
                ? "student-menu active"
                : "student-menu"
            }
            onClick={() => {
              setActiveMenu("selected");
              setPageError("");
            }}
          >
            <i className="bi bi-cart3"></i>
            <span>Selected Books</span>

            {selectedBooks.length > 0 && (
              <span className="menu-count">
                {selectedBooks.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className={
              activeMenu === "qr"
                ? "student-menu active"
                : "student-menu"
            }
            onClick={() => {
              setActiveMenu("qr");
              setPageError("");
            }}
          >
            <i className="bi bi-qr-code"></i>
            <span>QR Code</span>
          </button>

        </aside>

        {/* MAIN CONTENT */}
        <main className="student-main">

          {/* ERROR MESSAGE */}
          {pageError && (
            <div
              className="form-error"
              role="alert"
              style={{ marginBottom: "20px" }}
            >
              {pageError}
            </div>
          )}

          {/* ================================== */}
          {/* BOOKS */}
          {/* ================================== */}
          {activeMenu === "books" && (
            <section>

              <div className="student-section-heading">
                <h2>Available Books</h2>

                <p>
                  Choose the books you want to borrow.
                </p>
              </div>

              {isLoading ? (
                <p>Loading books...</p>
              ) : books.length === 0 ? (
                <div className="student-empty-state">
                  <i className="bi bi-book"></i>

                  <h3>No books found</h3>

                  <p>
                    Books added by the librarian will appear here.
                  </p>
                </div>
              ) : (
                <div className="student-books-grid">

                  {books.map((book) => {
                    const selected = selectedBooks.some(
                      (item) => item.id === book.id
                    );

                    return (
                      <div
                        className="student-book-card"
                        key={book.id}
                      >

                        <div className="student-book-icon">
                          <i className="bi bi-book"></i>
                        </div>

                        <div className="student-book-info">
                          <h3>{book.title}</h3>

                          <p className="book-author">
                            {book.author}
                          </p>

                          <p className="book-category">
                            {book.category}
                          </p>

                          <span
                            className={
                              book.available
                                ? "book-status available"
                                : "book-status unavailable"
                            }
                          >
                            {book.available
                              ? `Available (${book.availableQuantity})`
                              : "Unavailable"}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="select-book-button"
                          disabled={
                            !book.available || selected
                          }
                          onClick={() => addBook(book)}
                        >
                          {selected
                            ? "Selected"
                            : book.available
                            ? "Select Book"
                            : "Unavailable"}
                        </button>

                      </div>
                    );
                  })}

                </div>
              )}

            </section>
          )}

          {/* ================================== */}
          {/* SELECTED BOOKS */}
          {/* ================================== */}
          {activeMenu === "selected" && (
            <section>

              <div className="student-section-heading">
                <h2>Selected Books</h2>

                <p>
                  Review your selected books before submitting.
                </p>
              </div>

              {selectedBooks.length === 0 ? (
                <div className="student-empty-state">
                  <i className="bi bi-cart-x"></i>

                  <h3>No books selected</h3>

                  <p>
                    Go to Books and select a book first.
                  </p>

                  <button
                    type="button"
                    className="go-books-button"
                    onClick={() => setActiveMenu("books")}
                  >
                    Browse Books
                  </button>
                </div>
              ) : (
                <>
                  <div className="selected-books-list">

                    {selectedBooks.map((book) => (
                      <div
                        className="selected-book-row"
                        key={book.id}
                      >

                        <div className="selected-book-icon">
                          <i className="bi bi-book"></i>
                        </div>

                        <div className="selected-book-details">
                          <h3>{book.title}</h3>
                          <p>{book.author}</p>
                        </div>

                        <button
                          type="button"
                          className="remove-book-button"
                          onClick={() => removeBook(book.id)}
                        >
                          <i className="bi bi-trash"></i>
                          Remove
                        </button>

                      </div>
                    ))}

                  </div>

                  <button
                    type="button"
                    className="generate-qr-button"
                    disabled={isGenerating}
                    onClick={handleGenerateQR}
                  >
                    <i className="bi bi-qr-code"></i>

                    {isGenerating
                      ? "Submitting Request..."
                      : "Submit Request & Generate QR"}
                  </button>
                </>
              )}

            </section>
          )}

          {/* ================================== */}
          {/* QR CODE */}
          {/* ================================== */}
          {activeMenu === "qr" && (
            <section>

              <div className="student-section-heading">
                <h2>QR Code</h2>

                <p>
                  Your borrowing request QR code.
                </p>
              </div>

              {batchesLoading ? (
                <div className="student-empty-state">
                  <p>
                    Checking your existing borrowing requests...
                  </p>
                </div>
              ) : !qrRequest ? (
                <div className="student-empty-state">
                  <i className="bi bi-qr-code"></i>

                  <h3>No QR generated yet</h3>

                  <p>
                    Select books and submit your request first.
                  </p>

                  <button
                    type="button"
                    className="go-books-button"
                    onClick={() => setActiveMenu("books")}
                  >
                    Browse Books
                  </button>
                </div>
              ) : (
                <div className="qr-page">

                  <div className="qr-card">

                    <h2>Borrowing Request</h2>

                    <p className="qr-student-name">
                      Student:{" "}
                      <strong>
                        {user?.name || "Student"}
                      </strong>
                    </p>

                    {qrRequest.batchId && (
                      <p>
                        Batch ID: {qrRequest.batchId}
                      </p>
                    )}

                    <div className="qr-real-container">
                      <QRCodeCanvas
                        value={String(qrRequest.qrPayload)}
                        size={220}
                        level="H"
                        includeMargin
                      />
                    </div>

                    <p className="qr-note">
                      Show this QR code to the librarian.
                      Your borrowing request remains pending
                      until the librarian processes it.
                    </p>

                    <div className="qr-book-summary">
                      <h3>Requested Books</h3>

                      {qrRequest.books.map((book) => (
                        <div
                          className="qr-book-item"
                          key={book.id}
                        >
                          <i className="bi bi-book"></i>
                          <span>{book.title}</span>
                        </div>
                      ))}
                    </div>

                    <p>
                      Total books: {qrRequest.books.length}
                    </p>

                    {qrRequest.status && (
                      <p>
                        Status:{" "}
                        <strong>
                          {qrRequest.status}
                        </strong>
                      </p>
                    )}

                  </div>

                </div>
              )}

            </section>
          )}

        </main>

      </div>
    </div>
  );
}

export default StudentDashboard;