import { useEffect, useMemo, useState } from "react";
import { api, getStoredUser } from "../services/api";
import "./books_management.css";

const EMPTY_FORM = {
  title: "",
  author: "",
  isbn: "",
  category: "",
  publisher: "",
  year_published: "",
  quantity: "1",
};

function BooksManagement({ onBack }) {
  const user = getStoredUser();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadBooks = async ({ showLoading = true } = {}) => {
    if (showLoading) {
      setLoading(true);
      setError("");
    }

    try {
      const data = await api.get("/api/books");
      if (!Array.isArray(data)) {
        throw new Error(data?.message || "The books API returned an unexpected response.");
      }
      setBooks(data);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load books.");
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch: update state only after the asynchronous API request settles.
  useEffect(() => {
    let cancelled = false;

    const initializeBooks = async () => {
      try {
        const data = await api.get("/api/books");
        if (!Array.isArray(data)) {
          throw new Error(data?.message || "The books API returned an unexpected response.");
        }
        if (!cancelled) {
          setBooks(data);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load books.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void initializeBooks();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredBooks = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return books;

    return books.filter((book) =>
      [book.title, book.author, book.isbn, book.category, book.publisher]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [books, search]);

  const openAddForm = () => {
    setEditingBook(null);
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEditForm = (book) => {
    setEditingBook(book);
    setForm({
      title: book.title || "",
      author: book.author || "",
      isbn: book.isbn || "",
      category: book.category || "",
      publisher: book.publisher || "",
      year_published: book.year_published ?? "",
      quantity: String(book.quantity ?? 1),
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    setEditingBook(null);
    setForm(EMPTY_FORM);
  };

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const title = form.title.trim();
    const author = form.author.trim();
    const quantity = Number(form.quantity);

    if (!title || !author) {
      setError("Book title and author are required.");
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("Quantity must be a whole number greater than zero.");
      return;
    }

    const yearText = String(form.year_published).trim();
    const payload = {
      title,
      author,
      isbn: form.isbn.trim() || null,
      category: form.category.trim() || null,
      publisher: form.publisher.trim() || null,
      year_published: yearText ? Number(yearText) : null,
      quantity,
    };

    if (yearText && !Number.isInteger(payload.year_published)) {
      setError("Year published must be a valid year.");
      return;
    }

    try {
      setSaving(true);

      if (editingBook) {
        const result = await api.put(`/api/books/${editingBook.id}`, payload);
        setSuccess(result.message || "Book updated successfully.");
      } else {
        const result = await api.post("/api/books", payload);
        setSuccess(result.message || "Book added successfully.");
      }

      setShowForm(false);
      setEditingBook(null);
      setForm(EMPTY_FORM);
      await loadBooks();
    } catch (err) {
      setError(err.message || "Unable to save book.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (book) => {
    const confirmed = window.confirm(
      `Delete "${book.title}" from the library catalog?`
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const result = await api.delete(`/api/books/${book.id}`);
      setSuccess(result.message || "Book deleted successfully.");
      await loadBooks();
    } catch (err) {
      setError(err.message || "Unable to delete book.");
    }
  };

  const totalCopies = books.reduce(
    (sum, book) => sum + Number(book.quantity || 0),
    0
  );
  const availableCopies = books.reduce(
    (sum, book) => sum + Number(book.available_quantity || 0),
    0
  );

  return (
    <section className="books-management">
      <div className="books-management-header">
        <div>
          <button className="books-back-button" type="button" onClick={onBack}>
            <i className="bi bi-arrow-left" aria-hidden="true"></i>
            Back to Dashboard
          </button>
          <p className="books-eyebrow">LIBSYNC CATALOG</p>
          <h1>Books Management</h1>
          <p className="books-subtitle">
            View and maintain the books stored in the LibSync library.
            {user?.name ? ` Signed in as ${user.name}.` : ""}
          </p>
        </div>
        <button className="books-primary-button" type="button" onClick={openAddForm}>
          <i className="bi bi-plus-lg" aria-hidden="true"></i>
          Add Book
        </button>
      </div>

      <div className="books-summary-grid">
        <article className="books-summary-card">
          <span className="books-summary-icon"><i className="bi bi-book" /></span>
          <div><span>Total Titles</span><strong>{books.length}</strong></div>
        </article>
        <article className="books-summary-card">
          <span className="books-summary-icon"><i className="bi bi-collection" /></span>
          <div><span>Total Copies</span><strong>{totalCopies}</strong></div>
        </article>
        <article className="books-summary-card">
          <span className="books-summary-icon"><i className="bi bi-check-circle" /></span>
          <div><span>Available Copies</span><strong>{availableCopies}</strong></div>
        </article>
      </div>

      {error && <div className="books-alert books-alert-error" role="alert">{error}</div>}
      {success && <div className="books-alert books-alert-success" role="status">{success}</div>}

      <div className="books-table-panel">
        <div className="books-table-toolbar">
          <div>
            <h2>Library Catalog</h2>
            <p>{filteredBooks.length} of {books.length} titles</p>
          </div>
          <div className="books-search-wrap">
            <i className="bi bi-search" aria-hidden="true"></i>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, author, ISBN..."
              aria-label="Search books"
            />
          </div>
          <button className="books-refresh-button" type="button" onClick={loadBooks} disabled={loading}>
            <i className={`bi bi-arrow-clockwise ${loading ? "books-spin" : ""}`} aria-hidden="true"></i>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="books-state"><span className="books-loader"></span><p>Loading library catalog...</p></div>
        ) : filteredBooks.length === 0 ? (
          <div className="books-state">
            <i className="bi bi-journal-x" aria-hidden="true"></i>
            <h3>{books.length === 0 ? "No books found" : "No matching books"}</h3>
            <p>{books.length === 0 ? "Add your first book to the LibSync catalog." : "Try another title, author, category, or ISBN."}</p>
          </div>
        ) : (
          <div className="books-table-scroll">
            <table className="books-table">
              <thead>
                <tr>
                  <th>Book Details</th>
                  <th>Category</th>
                  <th>ISBN</th>
                  <th>Total</th>
                  <th>Available</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBooks.map((book) => {
                  const quantity = Number(book.quantity || 0);
                  const available = Number(book.available_quantity || 0);
                  const inStock = available > 0;

                  return (
                    <tr key={book.id}>
                      <td>
                        <div className="books-title-cell">
                          <strong>{book.title || "Untitled Book"}</strong>
                          <span>{book.author || "Unknown Author"}</span>
                          {book.publisher && <small>{book.publisher}{book.year_published ? ` · ${book.year_published}` : ""}</small>}
                        </div>
                      </td>
                      <td>{book.category || "Uncategorized"}</td>
                      <td>{book.isbn || "—"}</td>
                      <td>{quantity}</td>
                      <td>{available}</td>
                      <td>
                        <span className={`books-status ${inStock ? "is-available" : "is-unavailable"}`}>
                          {inStock ? "Available" : "Unavailable"}
                        </span>
                      </td>
                      <td>
                        <div className="books-row-actions">
                          <button type="button" className="books-edit-button" onClick={() => openEditForm(book)} aria-label={`Edit ${book.title}`}>
                            <i className="bi bi-pencil-square" aria-hidden="true"></i>
                          </button>
                          <button type="button" className="books-delete-button" onClick={() => handleDelete(book)} aria-label={`Delete ${book.title}`}>
                            <i className="bi bi-trash3" aria-hidden="true"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="books-modal-backdrop" role="presentation">
          <section className="books-modal" role="dialog" aria-modal="true" aria-labelledby="books-form-title">
            <div className="books-modal-heading">
              <div>
                <p className="books-eyebrow">LIBRARY INVENTORY</p>
                <h2 id="books-form-title">{editingBook ? "Edit Book" : "Add New Book"}</h2>
              </div>
              <button type="button" className="books-modal-close" onClick={closeForm} disabled={saving} aria-label="Close form">
                <i className="bi bi-x-lg" aria-hidden="true"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="books-form">
              <label className="books-form-field books-form-field-full">
                <span>Book Title *</span>
                <input name="title" value={form.title} onChange={updateField} required maxLength={255} placeholder="Enter book title" />
              </label>

              <label className="books-form-field">
                <span>Author *</span>
                <input name="author" value={form.author} onChange={updateField} required maxLength={255} placeholder="Enter author name" />
              </label>

              <label className="books-form-field">
                <span>ISBN</span>
                <input name="isbn" value={form.isbn} onChange={updateField} maxLength={30} placeholder="Enter ISBN" />
              </label>

              <label className="books-form-field">
                <span>Category</span>
                <input name="category" value={form.category} onChange={updateField} maxLength={100} placeholder="e.g. Information Technology" />
              </label>

              <label className="books-form-field">
                <span>Publisher</span>
                <input name="publisher" value={form.publisher} onChange={updateField} maxLength={255} placeholder="Enter publisher" />
              </label>

              <label className="books-form-field">
                <span>Year Published</span>
                <input name="year_published" type="number" min="0" max="9999" value={form.year_published} onChange={updateField} placeholder="e.g. 2024" />
              </label>

              <label className="books-form-field">
                <span>Total Quantity *</span>
                <input name="quantity" type="number" min="1" step="1" value={form.quantity} onChange={updateField} required />
                {editingBook && <small>Quantity cannot be lower than the number of currently borrowed copies.</small>}
              </label>

              {error && <div className="books-alert books-alert-error books-form-error" role="alert">{error}</div>}

              <div className="books-form-actions">
                <button type="button" className="books-secondary-button" onClick={closeForm} disabled={saving}>Cancel</button>
                <button type="submit" className="books-primary-button" disabled={saving}>
                  {saving ? "Saving..." : editingBook ? "Save Changes" : "Add Book"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

export default BooksManagement;
