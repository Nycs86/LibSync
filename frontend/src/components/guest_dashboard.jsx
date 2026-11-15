import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import "./guest_dashboard.css";

const PENDING_GUEST_BOOK_KEY = "libsyncGuestPendingBook";

function mapGuestBook(book) {
  const availableQuantity = Number(book.available_quantity ?? book.availableQuantity ?? 0);

  return {
    id: Number(book.id),
    title: book.title || "Untitled Book",
    author: book.author || "Unknown Author",
    category: book.category || "Uncategorized",
    isbn: book.isbn || "",
    publisher: book.publisher || "",
    yearPublished: book.year_published || book.yearPublished || "",
    description: book.description || book.book_description || book.summary || "",
    availableQuantity,
    available: availableQuantity > 0,
    cover:
      book.cover_image_url ||
      book.cover_image ||
      book.cover_url ||
      book.image_url ||
      book.thumbnail ||
      book.image ||
      book.book_cover ||
      book.book_image ||
      book.image_path ||
      book.cover ||
      book.photo_url ||
      "",
  };
}

function GuestBookCover({ book }) {
  const isbn = String(book.isbn || "").replace(/[^0-9Xx]/g, "");
  const sources = [
    book.cover,
    isbn
      ? `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-M.jpg?default=false`
      : "",
  ].filter(Boolean);
  const [sourceIndex, setSourceIndex] = useState(0);
  const colors = ["#e7f1e9", "#f5e8d9", "#e8edf8", "#f3e8ef", "#f4efd9"];
  const coverColor = colors[Math.abs(Number(book.id) || 0) % colors.length];

  return (
    <div className="guest-book-cover">
      {sourceIndex < sources.length ? (
        <img
          src={sources[sourceIndex]}
          alt={`Cover of ${book.title}`}
          loading="lazy"
          onError={() => setSourceIndex((current) => current + 1)}
        />
      ) : (
        <div className="guest-book-cover-placeholder" style={{ background: coverColor }}>
          <span className="guest-book-cover-rule" />
          <i className="bi bi-book-half" aria-hidden="true" />
          <strong>{book.title}</strong>
          <small>{book.author}</small>
        </div>
      )}
    </div>
  );
}

function GuestDashboard({ onLogin, onRegister }) {
  const [books, setBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortOrder, setSortOrder] = useState("az");
  const [previewBook, setPreviewBook] = useState(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const loadBooks = async () => {
      try {
        // Public catalogue endpoint. Guest access is read-only; no guest role is created.
        const data = await api.get("/api/books", { signal: controller.signal });
        if (!Array.isArray(data)) {
          throw new Error(data?.message || "The library catalogue returned an unexpected response.");
        }
        if (!controller.signal.aborted) {
          setBooks(data.map(mapGuestBook));
        }
      } catch (error) {
        if (error.name !== "AbortError" && !controller.signal.aborted) {
          console.error("Load guest catalogue error:", error);
          setLoadError(error.message || "Unable to load the library catalogue right now.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void loadBooks();
    return () => controller.abort();
  }, []);

  const categories = useMemo(
    () => [...new Set(books.map((book) => book.category).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    ),
    [books]
  );

  const visibleBooks = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return books
      .filter((book) => {
        const matchesCategory = selectedCategory === "all" || book.category === selectedCategory;
        const searchableText = [book.title, book.author, book.category, book.isbn, book.publisher]
          .join(" ")
          .toLowerCase();
        return matchesCategory && (!search || searchableText.includes(search));
      })
      .sort((a, b) => {
        const result = a.title.localeCompare(b.title, undefined, {
          sensitivity: "base",
          numeric: true,
        });
        return sortOrder === "za" ? -result : result;
      });
  }, [books, searchTerm, selectedCategory, sortOrder]);

  const savePendingBook = (book) => {
    if (!book) return;
    try {
      sessionStorage.setItem(
        PENDING_GUEST_BOOK_KEY,
        JSON.stringify({
          id: book.id,
          title: book.title,
          savedAt: new Date().toISOString(),
        })
      );
    } catch (error) {
      console.warn("Could not preserve the guest-selected book:", error);
    }
  };

  const continueToLogin = () => {
    savePendingBook(previewBook);
    setShowAuthPrompt(false);
    setPreviewBook(null);
    onLogin();
  };

  const continueToRegister = () => {
    savePendingBook(previewBook);
    setShowAuthPrompt(false);
    setPreviewBook(null);
    onRegister();
  };

  const openBookPreview = (book) => setPreviewBook(book);

  const handleCardSelectBook = (book) => {
    if (!book?.available) return;
    // Guests may not reserve books. Ask them to authenticate before continuing.
    setPreviewBook(book);
    setShowAuthPrompt(true);
  };

  return (
    <div className="guest-page">
      <div className="guest-layout">
        <aside className="guest-sidebar" aria-label="Guest navigation">
          <div className="guest-sidebar-decoration" aria-hidden="true" />
          <a className="guest-sidebar-brand" href="#guest-home" aria-label="LibSync Home">
            <img src="/libsync-logo.svg" alt="LibSync" />
          </a>

          <div className="guest-sidebar-section-label">WORKSPACE</div>
          <nav className="guest-sidebar-nav">
            <a className="is-active" href="#guest-home">
              <i className="bi bi-house-door" aria-hidden="true" />
              <span>Home</span>
            </a>
            <a href="#guest-catalog">
              <i className="bi bi-book" aria-hidden="true" />
              <span>Book Catalog</span>
            </a>
            <a href="#guest-categories">
              <i className="bi bi-grid" aria-hidden="true" />
              <span>Categories</span>
            </a>
            <a href="#guest-about">
              <i className="bi bi-info-circle" aria-hidden="true" />
              <span>About</span>
            </a>
          </nav>

          <div className="guest-sidebar-account">
            <div className="guest-account-icon">
              <i className="bi bi-person" aria-hidden="true" />
            </div>
            <h2>Guest Account</h2>
            <p>Browse and explore the library catalog.</p>
            <button type="button" onClick={onLogin}>
              <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
              Login / Register
            </button>
          </div>
        </aside>

        <div className="guest-main">
      <main className="guest-content" id="guest-home">
        <section className="guest-hero">
          <div className="guest-hero-copy">
            <span className="guest-eyebrow">YOUR LIBRARY SPACE</span>
            <h1>Welcome to LibSync</h1>
            <p>Explore our library collection, discover new reads, and find the resources you need.</p>
          </div>
        </section>

        <section className="guest-notice" id="guest-about" aria-label="Guest browsing information">
          <i className="bi bi-info-circle-fill" aria-hidden="true" />
          <div>
            <strong>You are browsing as a guest</strong>
            <p>You can search and view books. Sign in or register when you are ready to select a book and submit a borrowing request.</p>
          </div>
        </section>

        <section className="guest-catalog-panel" id="guest-catalog" aria-label="Library catalogue">
          <div className="guest-catalog-controls">
            <label className="guest-search-box">
              <i className="bi bi-search" aria-hidden="true" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search books by title, author, ISBN, or category..."
                aria-label="Search books by title, author, ISBN, or category"
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm("")} aria-label="Clear search">
                  <i className="bi bi-x-lg" />
                </button>
              )}
            </label>

            <label className="guest-filter-control" id="guest-categories">
              <i className="bi bi-grid" aria-hidden="true" />
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                aria-label="Filter books by category"
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option value={category} key={category}>{category}</option>
                ))}
              </select>
            </label>

            <label className="guest-sort-control">
              <i className="bi bi-sort-alpha-down" aria-hidden="true" />
              <span>Sort</span>
              <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} aria-label="Sort books">
                <option value="az">Title: A to Z</option>
                <option value="za">Title: Z to A</option>
              </select>
            </label>
          </div>

          <div className="guest-catalog-heading">
            <div>
              <h2>Library Books</h2>
              <p>{isLoading ? "Loading titles..." : `${visibleBooks.length} ${visibleBooks.length === 1 ? "title" : "titles"} available to browse`}</p>
            </div>
            <span className="guest-view-only"><i className="bi bi-bookmark-check" aria-hidden="true" /> View-only access</span>
          </div>

          {isLoading ? (
            <div className="guest-catalog-message"><span className="guest-loading-spinner" /> Loading books...</div>
          ) : loadError ? (
            <div className="guest-catalog-message guest-catalog-error">
              <i className="bi bi-exclamation-circle" aria-hidden="true" />
              <strong>Unable to load books</strong>
              <span>{loadError}</span>
            </div>
          ) : visibleBooks.length === 0 ? (
            <div className="guest-catalog-message">
              <i className="bi bi-search" aria-hidden="true" />
              <strong>No books found</strong>
              <span>Try another search term or choose a different category.</span>
            </div>
          ) : (
            <div className="guest-book-grid">
              {visibleBooks.map((book) => (
                <article className="guest-book-card" key={book.id}>
                  <button
                    type="button"
                    className="guest-book-preview-trigger"
                    onClick={() => openBookPreview(book)}
                    aria-label={`Preview ${book.title}`}
                  >
                    <GuestBookCover book={book} />
                    <strong className="guest-book-title">{book.title}</strong>
                    <span className="guest-book-author">By: {book.author}</span>
                    <span className={`guest-book-status ${book.available ? "is-available" : "is-unavailable"}`}>
                      {book.available ? `Available (${book.availableQuantity})` : "Unavailable"}
                    </span>
                  </button>
                  <div className="guest-book-card-actions">
                    <button
                      type="button"
                      className="guest-card-select-book"
                      disabled={!book.available}
                      onClick={() => handleCardSelectBook(book)}
                      aria-label={`Select ${book.title}; login or register required`}
                    >
                      Select Book
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {previewBook && (
        <div
          className="guest-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewBook(null);
          }}
        >
          <section className="guest-book-modal" role="dialog" aria-modal="true" aria-labelledby="guest-book-modal-title">
            <button type="button" className="guest-modal-close" onClick={() => setPreviewBook(null)} aria-label="Close book preview">
              <i className="bi bi-x-lg" />
            </button>
            <div className="guest-modal-layout">
              <GuestBookCover book={previewBook} />
              <div className="guest-modal-copy">
                <span className="guest-eyebrow">BOOK PREVIEW</span>
                <h2 id="guest-book-modal-title">{previewBook.title}</h2>
                <p className="guest-modal-author">By {previewBook.author}</p>
                <span className={`guest-book-status ${previewBook.available ? "is-available" : "is-unavailable"}`}>
                  {previewBook.available ? `Available (${previewBook.availableQuantity})` : "Currently unavailable"}
                </span>
                <dl className="guest-book-metadata">
                  <div><dt>Category</dt><dd>{previewBook.category}</dd></div>
                  {previewBook.isbn && <div><dt>ISBN</dt><dd>{previewBook.isbn}</dd></div>}
                  {previewBook.publisher && <div><dt>Publisher</dt><dd>{previewBook.publisher}</dd></div>}
                  {previewBook.yearPublished && <div><dt>Year Published</dt><dd>{previewBook.yearPublished}</dd></div>}
                </dl>
                <p className="guest-modal-description">{previewBook.description || "No description is available for this book."}</p>
                <div className="guest-modal-actions">
                  <button type="button" className="guest-secondary-button" onClick={() => setPreviewBook(null)}>Close</button>
                  <button
                    type="button"
                    className="guest-primary-button"
                    disabled={!previewBook.available}
                    onClick={() => setShowAuthPrompt(true)}
                  >
                    Select Book
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {showAuthPrompt && previewBook && (
        <div
          className="guest-modal-backdrop guest-auth-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowAuthPrompt(false);
              setPreviewBook(null);
            }
          }}
        >
          <section className="guest-auth-modal" role="dialog" aria-modal="true" aria-labelledby="guest-auth-title">
            <div className="guest-auth-icon"><i className="bi bi-person-lock" aria-hidden="true" /></div>
            <h2 id="guest-auth-title">Sign in to select this book</h2>
            <p>To add <strong>{previewBook.title}</strong> to your Selected Books and submit a borrowing request, please log in or create a student account.</p>
            <div className="guest-modal-actions">
              <button
                type="button"
                className="guest-secondary-button"
                onClick={() => {
                  setShowAuthPrompt(false);
                  setPreviewBook(null);
                }}
              >
                Continue Browsing
              </button>
              <button type="button" className="guest-primary-button" onClick={continueToLogin}>Login</button>
              <button type="button" className="guest-register-modal-button" onClick={continueToRegister}>Register</button>
            </div>
          </section>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}

export default GuestDashboard;
