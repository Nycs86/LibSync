import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

function StudentDashboard({ onLogout }) {
  const user = JSON.parse(
    localStorage.getItem("loggedInUser")
  );

  const [activeMenu, setActiveMenu] = useState("books");

  const [books] = useState([
    {
      id: "BK001",
      title: "Introduction to Algorithms",
      author: "Thomas H. Cormen",
      category: "Computer Science",
      available: true,
    },
    {
      id: "BK002",
      title: "Clean Code",
      author: "Robert C. Martin",
      category: "Programming",
      available: true,
    },
    {
      id: "BK003",
      title: "Database System Concepts",
      author: "Abraham Silberschatz",
      category: "Database",
      available: true,
    },
    {
      id: "BK004",
      title: "Web Development Basics",
      author: "John Smith",
      category: "Web Development",
      available: false,
    },
  ]);

  const [selectedBooks, setSelectedBooks] = useState([]);

  const addBook = (book) => {
    const exists = selectedBooks.some(
      (item) => item.id === book.id
    );

    if (!exists && book.available) {
      setSelectedBooks((prev) => [...prev, book]);
    }
  };

  const removeBook = (bookId) => {
    setSelectedBooks((prev) =>
      prev.filter((book) => book.id !== bookId)
    );
  };

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
            className={
              activeMenu === "books"
                ? "student-menu active"
                : "student-menu"
            }
            onClick={() => setActiveMenu("books")}
          >
            <i className="bi bi-book"></i>
            <span>Books</span>
          </button>

          <button
            className={
              activeMenu === "selected"
                ? "student-menu active"
                : "student-menu"
            }
            onClick={() => setActiveMenu("selected")}
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
            className={
              activeMenu === "qr"
                ? "student-menu active"
                : "student-menu"
            }
            onClick={() => setActiveMenu("qr")}
          >
            <i className="bi bi-qr-code"></i>
            <span>QR Code</span>
          </button>

        </aside>

        {/* MAIN CONTENT */}
        <main className="student-main">

          {/* BOOKS */}
          {activeMenu === "books" && (
            <section>
              <div className="student-section-heading">
                <div>
                  <h2>Available Books</h2>
                  <p>
                    Choose the books you want to borrow.
                  </p>
                </div>
              </div>

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
                            ? "Available"
                            : "Borrowed"}
                        </span>
                      </div>

                      <button
                        className="select-book-button"
                        disabled={!book.available || selected}
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
            </section>
          )}

          {/* SELECTED BOOKS */}
          {activeMenu === "selected" && (
            <section>
              <div className="student-section-heading">
                <div>
                  <h2>Selected Books</h2>
                  <p>
                    These are the books you selected for borrowing.
                  </p>
                </div>
              </div>

              {selectedBooks.length === 0 ? (
                <div className="student-empty-state">
                  <i className="bi bi-cart-x"></i>

                  <h3>No books selected</h3>

                  <p>
                    Go to Books and select a book first.
                  </p>
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
                          className="remove-book-button"
                          onClick={() =>
                            removeBook(book.id)
                          }
                        >
                          <i className="bi bi-trash"></i>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    className="generate-qr-button"
                    onClick={() => setActiveMenu("qr")}
                  >
                    <i className="bi bi-qr-code"></i>
                    Generate QR Code
                  </button>
                </>
              )}
            </section>
          )}

          {/* QR CODE */}
          {activeMenu === "qr" && (
            <section>
              <div className="student-section-heading">
                <div>
                  <h2>QR Code</h2>
                  <p>
                    Generate your borrowing request QR code.
                  </p>
                </div>
              </div>

              {selectedBooks.length === 0 ? (
                <div className="student-empty-state">
                  <i className="bi bi-qr-code"></i>

                  <h3>No borrowing request</h3>

                  <p>
                    Select books first before generating
                    your QR code.
                  </p>

                  <button
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

                    <div className="qr-real-container">
                      <QRCodeCanvas
                        value={JSON.stringify({
                          request_type: "BORROW",
                          student_id: user?.id,
                          student_name: user?.name,
                          books: selectedBooks.map((book) => ({
                            book_id: book.id,
                            book_title: book.title,
                            author: book.author,
                          })),
                        })}
                        size={220}
                        level="H"
                      />
                    </div>

                    <p className="qr-note">
                      This QR code will contain your selected
                      books and borrowing request information.
                    </p>

                    <div className="qr-book-summary">
                      <h3>Selected Books</h3>

                      {selectedBooks.map((book) => (
                        <div
                          className="qr-book-item"
                          key={book.id}
                        >
                          <i className="bi bi-book"></i>
                          <span>{book.title}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      className="generate-real-qr-button"
                    >
                      <i className="bi bi-qr-code"></i>
                      Generate QR
                    </button>
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