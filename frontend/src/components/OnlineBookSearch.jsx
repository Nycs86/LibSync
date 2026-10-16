import { useState } from "react";

const API_URL = "https://libsync-backend.onrender.com";

function OnlineBookSearch({ onBookAdded }) {
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const searchBooks = async (e) => {
    e.preventDefault();
    const search = query.trim();

    if (!search) {
      setError("Enter a title, author, or ISBN.");
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/books/search-online?q=${encodeURIComponent(search)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to search books.");
      }

      setBooks(data.books || []);

      if (!data.books || data.books.length === 0) {
        setMessage("No books found.");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  const addToLibrary = async (book) => {
    const bookKey =
      book.openlibrary_key || book.isbn || `${book.title}-${book.author}`;

    const quantity = Number(quantities[bookKey] || 1);

    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("Quantity must be at least 1.");
      return;
    }

    setAddingId(bookKey);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/books`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          category: book.category || "General",
          publisher: book.publisher,
          year_published: book.year_published,
          quantity,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to add book.");
      }

      setMessage(`"${book.title}" added to LibSync.`);

      if (onBookAdded) {
        onBookAdded();
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to add book.");
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="online-book-search">
      <h2>Search Online Books</h2>

      <form className="online-book-search-form" onSubmit={searchBooks}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, author, or ISBN"
        />

        <button type="submit" disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      <div className="online-book-results">
        {books.map((book) => {
          const bookKey =
            book.openlibrary_key ||
            book.isbn ||
            `${book.title}-${book.author}`;

          return (
            <div className="online-book-card" key={bookKey}>
              <div className="online-book-cover">
                {book.cover_url ? (
                  <img src={book.cover_url} alt={book.title} />
                ) : (
                  <div className="online-book-no-cover">No Cover</div>
                )}
              </div>

              <div className="online-book-info">
                <h3>{book.title}</h3>
                <p><strong>Author:</strong> {book.author}</p>
                <p><strong>ISBN:</strong> {book.isbn || "Not available"}</p>
                <p><strong>Category:</strong> {book.category || "General"}</p>
                <p><strong>Publisher:</strong> {book.publisher || "Not available"}</p>
                <p><strong>Year:</strong> {book.year_published || "Not available"}</p>

                <div className="online-book-add-row">
                  <label>
                    Quantity
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={quantities[bookKey] || 1}
                      onChange={(e) =>
                        setQuantities((current) => ({
                          ...current,
                          [bookKey]: e.target.value,
                        }))
                      }
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => addToLibrary(book)}
                    disabled={addingId === bookKey}
                  >
                    {addingId === bookKey ? "Adding..." : "Add to LibSync"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default OnlineBookSearch;
