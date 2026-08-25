import { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";

function App() {
  const emptyForm = {
    title: "",
    author: "",
    isbn: "",
    category: "",
    publisher: "",
    year_published: "",
    quantity: 1,
  };

  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  const fetchUsers = async () => {
  try {
    const response = await fetch(
      "http://127.0.0.1:5000/api/users"
    );

    const data = await response.json();

    setUsers(data);
  } catch (error) {
    console.error("Error fetching users:", error);
  }
};

  const fetchBooks = async () => {
    try {
      const response = await fetch(
        "http://127.0.0.1:5000/api/books"
      );

      const data = await response.json();

      setBooks(data);
    } catch (error) {
      console.error(error);
      showMessage("Unable to connect to the server.", "danger");
    }
  };

  useEffect(() => {
  fetchBooks();
  fetchUsers();
}, []);

  const showMessage = (text, type = "info") => {
    setMessage(text);
    setMessageType(type);

    setTimeout(() => {
      setMessage("");
    }, 3000);
  };

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const url = editingId
      ? `http://127.0.0.1:5000/api/books/${editingId}`
      : "http://127.0.0.1:5000/api/books";

    const method = editingId ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          year_published: form.year_published
            ? Number(form.year_published)
            : null,
          quantity: Number(form.quantity),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showMessage(data.message, "success");

        setForm(emptyForm);
        setEditingId(null);

        fetchBooks();
      } else {
        showMessage(data.message, "danger");
      }
    } catch (error) {
      console.error(error);
      showMessage("Unable to connect to the server.", "danger");
    }
  };

  const handleEdit = (book) => {
    setEditingId(book.id);

    setForm({
      title: book.title || "",
      author: book.author || "",
      isbn: book.isbn || "",
      category: book.category || "",
      publisher: book.publisher || "",
      year_published: book.year_published || "",
      quantity: book.quantity || 1,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this book?"
    );

    if (!confirmDelete) {
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:5000/api/books/${id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (response.ok) {
        showMessage(data.message, "success");
        fetchBooks();
      } else {
        showMessage(data.message, "danger");
      }
    } catch (error) {
      console.error(error);
      showMessage("Unable to connect to the server.", "danger");
    }
  };

  return (
    <div className="app">

      {/* NAVBAR */}
      <nav className="navbar navbar-dark bg-dark px-4">
        <span className="navbar-brand fw-bold">
          LibSync
        </span>

        <span className="text-light">
          Library Management System
        </span>
      </nav>

      <main className="container py-5">

        {/* MESSAGE */}
        {message && (
          <div className={`alert alert-${messageType}`}>
            {message}
          </div>
        )}

        {/* BOOK FORM */}
        <div className="card shadow-sm mb-5">
          <div className="card-body p-4">

            <h2 className="fw-bold mb-4">
              {editingId ? "Edit Book" : "Add New Book"}
            </h2>

            <form onSubmit={handleSubmit}>

              <div className="row">

                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    Book Title
                  </label>

                  <input
                    type="text"
                    name="title"
                    className="form-control"
                    value={form.title}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    Author
                  </label>

                  <input
                    type="text"
                    name="author"
                    className="form-control"
                    value={form.author}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    ISBN
                  </label>

                  <input
                    type="text"
                    name="isbn"
                    className="form-control"
                    value={form.isbn}
                    onChange={handleChange}
                  />
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    Category
                  </label>

                  <input
                    type="text"
                    name="category"
                    className="form-control"
                    value={form.category}
                    onChange={handleChange}
                  />
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    Publisher
                  </label>

                  <input
                    type="text"
                    name="publisher"
                    className="form-control"
                    value={form.publisher}
                    onChange={handleChange}
                  />
                </div>

                <div className="col-md-3 mb-3">
                  <label className="form-label">
                    Year Published
                  </label>

                  <input
                    type="number"
                    name="year_published"
                    className="form-control"
                    value={form.year_published}
                    onChange={handleChange}
                  />
                </div>

                <div className="col-md-3 mb-3">
                  <label className="form-label">
                    Quantity
                  </label>

                  <input
                    type="number"
                    name="quantity"
                    className="form-control"
                    min="1"
                    value={form.quantity}
                    onChange={handleChange}
                    required
                  />
                </div>

              </div>

              <button
                type="submit"
                className="btn btn-primary me-2"
              >
                {editingId ? "Update Book" : "Add Book"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
              )}

            </form>

          </div>
        </div>

        {/* BOOK CATALOG */}
        <div className="d-flex justify-content-between align-items-center mb-3">

          <div>
            <h2 className="fw-bold mb-1">
              Book Catalog
            </h2>

            <p className="text-muted">
              Books currently registered in LibSync.
            </p>
          </div>

          <span className="badge bg-dark fs-6">
            {books.length} Books
          </span>

        </div>

        <div className="table-responsive">

          <table className="table table-hover align-middle bg-white">

            <thead className="table-dark">

              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Author</th>
                <th>Category</th>
                <th>ISBN</th>
                <th>Quantity</th>
                <th>Available</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>

            </thead>

            <tbody>

              {books.map((book) => (

                <tr key={book.id}>

                  <td>{book.id}</td>

                  <td className="fw-semibold">
                    {book.title}
                  </td>

                  <td>{book.author}</td>

                  <td>{book.category}</td>

                  <td>{book.isbn}</td>

                  <td>{book.quantity}</td>

                  <td>{book.available_quantity}</td>

                  <td>
                    <span
                      className={`badge ${
                        book.status === "available"
                          ? "bg-success"
                          : book.status === "borrowed"
                          ? "bg-warning text-dark"
                          : "bg-danger"
                      }`}
                    >
                      {book.status}
                    </span>
                  </td>

                  <td>
                    <button
                      className="btn btn-sm btn-warning me-2"
                      onClick={() => handleEdit(book)}
                    >
                      Edit
                    </button>

                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(book.id)}
                    >
                      Delete
                    </button>
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </main>

    </div>
  );
}

<div className="mt-5">

  <div className="d-flex justify-content-between align-items-center mb-3">

    <div>
      <h2 className="fw-bold mb-1">
        Users
      </h2>

      <p className="text-muted">
        Registered users in LibSync.
      </p>
    </div>

    <span className="badge bg-dark fs-6">
      {users.length} users
    </span>

  </div>

  <div className="table-responsive">

    <table className="table table-hover align-middle bg-white">

      <thead className="table-dark">
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Created</th>
        </tr>
      </thead>

      <tbody>

        {users.map((user) => (
          <tr key={user.id}>

            <td>{user.id}</td>

            <td className="fw-semibold">
              {user.name}
            </td>

            <td>{user.email}</td>

            <td>
              <span className="badge bg-primary">
                {user.role}
              </span>
            </td>

            <td>
              {user.created_at}
            </td>

          </tr>
        ))}

      </tbody>

    </table>

  </div>

</div>
export default App;