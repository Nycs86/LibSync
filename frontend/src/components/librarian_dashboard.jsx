import { useCallback, useEffect, useRef, useState } from "react";

import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

import "./online_book_search.css";
import "./librarian_dashboard.css";



const API_URL =

  "https://libsync-backend.onrender.com";



// ==========================================

// QR SCANNER COMPONENT

// ==========================================

// Serialize scanner setup/cleanup so React StrictMode cannot start
// two camera sessions during development remounts.
let libSyncQrScannerLifecycle = Promise.resolve();

function QRScanner({ onScan }) {
  const onScanRef = useRef(onScan);
  const hasScannedRef = useRef(false);
  const [scannerError, setScannerError] = useState("");
  const [scannerStatus, setScannerStatus] = useState(
    "Requesting camera access..."
  );
  const [didScan, setDidScan] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let disposed = false;
    let scanner = null;
    let stopPromise = null;

    const stopScanner = async () => {
      if (!scanner) return;
      // If a scan callback already started stopping the camera, wait for it.
      if (stopPromise) {
        await stopPromise;
        return;
      }
      if (!scanner.isScanning) return;

      stopPromise = scanner.stop().catch((error) => {
        console.warn("QR camera stop:", error);
      });
      await stopPromise;
    };

    hasScannedRef.current = false;

    const previousLifecycle = libSyncQrScannerLifecycle;
    const initializationPromise = previousLifecycle
      .catch(() => undefined)
      .then(async () => {
        if (disposed) return;

        const readerElement = document.getElementById("libsync-qr-reader");
        if (!readerElement) return;

        scanner = new Html5Qrcode("libsync-qr-reader", {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });

        try {
          const cameras = await Html5Qrcode.getCameras();
          if (disposed) return;

          if (!cameras || cameras.length === 0) {
            throw new Error("No camera was detected on this device.");
          }

          // Prefer a rear camera on phones; use the first available camera
          // on laptops/desktops.
          const selectedCamera =
            cameras.find((camera) => /back|rear|environment/i.test(camera.label)) ||
            cameras[0];

          const startPromise = scanner.start(
            selectedCamera.id,
            {
              fps: 10,
              qrbox: (viewfinderWidth, viewfinderHeight) => {
                const size = Math.floor(
                  Math.min(viewfinderWidth, viewfinderHeight, 280)
                );
                return { width: size, height: size };
              },
              aspectRatio: 1,
              disableFlip: false,
            },
            async (decodedText) => {
              if (disposed || hasScannedRef.current) return;

              hasScannedRef.current = true;
              setDidScan(true);
              setScannerStatus("QR detected. Looking up borrowing details...");

              await stopScanner();
              if (!disposed) {
                await onScanRef.current(decodedText);
              }
            },
            () => {
              // No QR in this video frame is normal; don't show an error.
            }
          );

          await startPromise;
          if (disposed) {
            await stopScanner();
          } else {
            setScannerStatus(
              `Camera ready${selectedCamera.label ? `: ${selectedCamera.label}` : ""}. Point it at the student's QR code.`
            );
          }
        } catch (error) {
          if (!disposed) {
            console.error("QR scanner initialization error:", error);
            const detail = error?.message || "Unable to start the camera.";
            const permissionProblem = /permission|notallowed|denied/i.test(detail);
            setScannerError(
              permissionProblem
                ? "Camera permission was denied. Allow camera access in your browser, then try again."
                : detail
            );
            setScannerStatus("Camera unavailable");
          }
        }
      });

    return () => {
      disposed = true;
      const cleanupPromise = initializationPromise
        .catch(() => undefined)
        .then(async () => {
          if (!scanner) return;
          try {
            await stopScanner();
          } catch (error) {
            console.warn("QR scanner stop cleanup:", error);
          }
          try {
            await scanner.clear();
          } catch (error) {
            // The scanner may already have cleared its UI during startup.
            console.warn("QR scanner clear cleanup:", error);
          }
        });

      libSyncQrScannerLifecycle = cleanupPromise;
    };
  }, [retryNonce]);

  const retryCamera = () => {
    setScannerError("");
    setScannerStatus("Requesting camera access...");
    setDidScan(false);
    hasScannedRef.current = false;
    setRetryNonce((current) => current + 1);
  };

  return (
    <div className="ls-qr-camera-shell">
      <div
        id="libsync-qr-reader"
        className="ls-qr-camera-viewfinder"
        aria-label="QR code camera preview"
      />

      <p className="ls-qr-camera-status" role="status">
        {scannerStatus}
      </p>

      {scannerError && (
        <div className="ls-qr-camera-error" role="alert">
          {scannerError}
        </div>
      )}

      {(scannerError || didScan) && (
        <button type="button" className="ls-qr-camera-retry" onClick={retryCamera}>
          {didScan ? "Scan Another QR Code" : "Try Camera Again"}
        </button>
      )}
    </div>
  );
}


// ==========================================

// LIBRARIAN DASHBOARD

// ==========================================

function LibrarianDashboard({ onLogout }) {

  const user = JSON.parse(

    localStorage.getItem("loggedInUser") || "null"

  );

  const userId = user?.id ?? "";



  const [activeSection, setActiveSection] = useState("");

  const [borrowRequests, setBorrowRequests] = useState([]);

  const [requestsLoaded, setRequestsLoaded] = useState(false);

  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState("");

  // Books Management state
  const [books, setBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksLoaded, setBooksLoaded] = useState(false);
  const [booksError, setBooksError] = useState("");
  const [bookSearch, setBookSearch] = useState("");
  const [bookCategoryFilter, setBookCategoryFilter] = useState("all");
  const [bookStatusFilter, setBookStatusFilter] = useState("all");
  const [bookPage, setBookPage] = useState(1);
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [bookSaving, setBookSaving] = useState(false);
  const [deletingBookId, setDeletingBookId] = useState(null);
  const [bookForm, setBookForm] = useState({
    title: "",
    author: "",
    isbn: "",
    category: "",
    publisher: "",
    year_published: "",
    quantity: "1",
  });



  // Borrowing Records state
  const [borrowingRecords, setBorrowingRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [recordsError, setRecordsError] = useState("");
  const [recordSearch, setRecordSearch] = useState("");
  const [recordStatusFilter, setRecordStatusFilter] = useState("all");
  const [recordBookFilter, setRecordBookFilter] = useState("all");
  const [recordStartDate, setRecordStartDate] = useState("");
  const [recordEndDate, setRecordEndDate] = useState("");
  const [recordPage, setRecordPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [lookupLoading, setLookupLoading] = useState(false);

  const [scannedToken, setScannedToken] = useState("");

  const [scannedBatch, setScannedBatch] = useState(null);

  const [processingRequestId, setProcessingRequestId] =

    useState(null);



  const librarianHeaders = {

    "X-User-ID": String(userId),

    

  };


  // ==========================================
  // BOOKS MANAGEMENT: LOAD BOOKS FROM THE API
  // ==========================================
  const loadBooks = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/books`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Failed to load books.");
      }

      const bookList = Array.isArray(data)
        ? data
        : Array.isArray(data.books)
          ? data.books
          : [];

      setBooks(bookList);
      setBooksLoaded(true);
      setBooksError("");
    } catch (error) {
      console.error("Load books error:", error);
      setBooksError(error.message || "Cannot connect to the books API.");
    } finally {
      setBooksLoading(false);
    }
  }, []);


  // Load approved borrowing transactions from the backend.
  // This is called from the navigation/button click (not a useEffect).
  const loadBorrowRecords = async () => {
    setRecordsLoading(true);
    setRecordsError("");

    try {
      const response = await fetch(`${API_URL}/api/borrow-records`, {
        method: "GET",
        headers: {
          "X-User-ID": String(userId),
          Accept: "application/json",
          
        },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Failed to load borrowing records.");
      }

      setBorrowingRecords(Array.isArray(data.records) ? data.records : []);
      setRecordsLoaded(true);
      setRecordPage(1);
    } catch (error) {
      console.error("Load borrowing records error:", error);
      setRecordsError(error.message || "Cannot connect to the borrowing records API.");
    } finally {
      setRecordsLoading(false);
    }
  };

  const resetBookForm = () => {
    setBookForm({
      title: "",
      author: "",
      isbn: "",
      category: "",
      publisher: "",
      year_published: "",
      quantity: "1",
    });
    setEditingBook(null);
  };

  const openAddBookModal = () => {
    resetBookForm();
    setBooksError("");
    setMessage("");
    setBookModalOpen(true);
  };

  const openEditBookModal = (book) => {
    setEditingBook(book);
    setBookForm({
      title: book.title ?? "",
      author: book.author ?? "",
      isbn: book.isbn ?? "",
      category: book.category ?? "",
      publisher: book.publisher ?? "",
      year_published: book.year_published ?? "",
      quantity: String(book.quantity ?? 1),
    });
    setBooksError("");
    setMessage("");
    setBookModalOpen(true);
  };

  const handleBookFormChange = (event) => {
    const { name, value } = event.target;
    setBookForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleBookSubmit = async (event) => {
    event.preventDefault();

    const title = bookForm.title.trim();
    const author = bookForm.author.trim();
    const quantity = Number.parseInt(bookForm.quantity, 10);

    if (!title || !author) {
      setBooksError("Please enter both the book title and author.");
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      setBooksError("Quantity must be at least 1.");
      return;
    }

    const payload = {
      title,
      author,
      isbn: bookForm.isbn.trim() || null,
      category: bookForm.category.trim() || null,
      publisher: bookForm.publisher.trim() || null,
      year_published: bookForm.year_published
        ? Number.parseInt(bookForm.year_published, 10)
        : null,
      quantity,
    };

    const bookId = editingBook?.id ?? editingBook?.book_id;
    const url = editingBook
      ? `${API_URL}/api/books/${bookId}`
      : `${API_URL}/api/books`;

    try {
      setBookSaving(true);
      setBooksError("");
      setMessage("");

      const response = await fetch(url, {
        method: editingBook ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to save this book.");
      }

      setBookModalOpen(false);
      resetBookForm();
      setBookPage(1);
      setMessage(data.message || (editingBook ? "Book updated successfully." : "Book added successfully."));
      setBooksLoading(true);
      setBooksError("");
      await loadBooks();
    } catch (error) {
      console.error("Save book error:", error);
      setBooksError(error.message || "Cannot connect to the books API.");
    } finally {
      setBookSaving(false);
    }
  };

  const handleDeleteBook = async (book) => {
    const bookId = book.id ?? book.book_id;
    if (bookId == null) {
      setBooksError("This book does not have a valid ID.");
      return;
    }

    const confirmed = window.confirm(
      `Delete "${book.title || "this book"}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setDeletingBookId(bookId);
      setBooksError("");
      setMessage("");

      const response = await fetch(`${API_URL}/api/books/${bookId}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          
        },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete this book.");
      }

      setBookPage(1);
      setMessage(data.message || "Book deleted successfully.");
      setBooksLoading(true);
      setBooksError("");
      await loadBooks();
    } catch (error) {
      console.error("Delete book error:", error);
      setBooksError(error.message || "Cannot connect to the books API.");
    } finally {
      setDeletingBookId(null);
    }
  };

  const bookCategories = [...new Set(
    books.map((book) => String(book.category || "").trim()).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  const filteredBooks = books.filter((book) => {
    const search = bookSearch.trim().toLowerCase();
    const available = Number(book.available_quantity ?? book.quantity ?? 0);
    const categoryMatches = bookCategoryFilter === "all" || String(book.category || "") === bookCategoryFilter;
    const statusMatches = bookStatusFilter === "all"
      || (bookStatusFilter === "available" && available > 0)
      || (bookStatusFilter === "borrowed" && available <= 0)
      || (bookStatusFilter === "low-stock" && available <= 2);
    const searchMatches = !search || [book.title, book.author, book.isbn, book.category]
      .some((value) => String(value || "").toLowerCase().includes(search));
    return categoryMatches && statusMatches && searchMatches;
  });

  const booksPerPage = 5;
  const totalBookPages = Math.max(1, Math.ceil(filteredBooks.length / booksPerPage));
  const currentBookPage = Math.min(bookPage, totalBookPages);
  const firstVisibleBookPage = Math.max(1, Math.min(currentBookPage - 2, totalBookPages - 4));
  const lastVisibleBookPage = Math.min(totalBookPages, firstVisibleBookPage + 4);
  const visibleBookPages = Array.from(
    { length: lastVisibleBookPage - firstVisibleBookPage + 1 },
    (_, index) => firstVisibleBookPage + index
  );
  const paginatedBooks = filteredBooks.slice(
    (currentBookPage - 1) * booksPerPage,
    currentBookPage * booksPerPage
  );
  const totalCopies = books.reduce((sum, book) => sum + Number(book.quantity ?? 0), 0);
  const availableCopies = books.reduce((sum, book) => sum + Number(book.available_quantity ?? book.quantity ?? 0), 0);
  const borrowedCopies = Math.max(0, totalCopies - availableCopies);
  const lowStockTitles = books.filter((book) => Number(book.available_quantity ?? book.quantity ?? 0) <= 2).length;



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
      setRequestsLoaded(true);

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

  // Borrowing Records filtering, summaries, and pagination.
  const formatRecordDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  };

  const recordDateInputValue = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getRecordStatus = (record) => {
    if (record.returned_at) return "returned";
    const rawStatus = String(record.status || record.record_status || record.request_status || "").toLowerCase();
    if (rawStatus === "returned") return "returned";
    if (rawStatus === "overdue") return "overdue";
    if (rawStatus === "approved" || rawStatus === "borrowed" || rawStatus === "active") {
      if (record.due_date) {
        const dueDate = new Date(record.due_date);
        if (!Number.isNaN(dueDate.getTime())) {
          dueDate.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (dueDate < today) return "overdue";
        }
      }
      return "borrowed";
    }
    return rawStatus || "unknown";
  };

  const recordBookOptions = [...new Set(
    borrowingRecords.map((record) => String(record.book_title || "").trim()).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  const filteredBorrowingRecords = borrowingRecords.filter((record) => {
    const search = recordSearch.trim().toLowerCase();
    const status = getRecordStatus(record);
    const dateValue = recordDateInputValue(record.borrow_date || record.approved_at || record.requested_at);
    const searchMatches = !search || [
      record.student_name,
      record.user_name,
      record.user_id,
      record.student_id,
      record.book_title,
      record.student_email,
    ].some((value) => String(value ?? "").toLowerCase().includes(search));
    const statusMatches = recordStatusFilter === "all" || status === recordStatusFilter;
    const bookMatches = recordBookFilter === "all" || String(record.book_title || "") === recordBookFilter;
    const startMatches = !recordStartDate || (dateValue && dateValue >= recordStartDate);
    const endMatches = !recordEndDate || (dateValue && dateValue <= recordEndDate);
    return searchMatches && statusMatches && bookMatches && startMatches && endMatches;
  });

  const borrowingRecordStats = {
    total: borrowingRecords.length,
    borrowed: borrowingRecords.filter((record) => getRecordStatus(record) === "borrowed").length,
    overdue: borrowingRecords.filter((record) => getRecordStatus(record) === "overdue").length,
    returned: borrowingRecords.filter((record) => getRecordStatus(record) === "returned").length,
  };
  const recordsPerPage = 8;
  const totalRecordPages = Math.max(1, Math.ceil(filteredBorrowingRecords.length / recordsPerPage));
  const currentRecordPage = Math.min(recordPage, totalRecordPages);
  const paginatedBorrowingRecords = filteredBorrowingRecords.slice(
    (currentRecordPage - 1) * recordsPerPage,
    currentRecordPage * recordsPerPage
  );
  const recordFirstVisiblePage = Math.max(1, Math.min(currentRecordPage - 2, totalRecordPages - 4));
  const recordLastVisiblePage = Math.min(totalRecordPages, recordFirstVisiblePage + 4);
  const visibleRecordPages = Array.from(
    { length: recordLastVisiblePage - recordFirstVisiblePage + 1 },
    (_, index) => recordFirstVisiblePage + index
  );

  const resetRecordFilters = () => {
    setRecordSearch("");
    setRecordStatusFilter("all");
    setRecordBookFilter("all");
    setRecordStartDate("");
    setRecordEndDate("");
    setRecordPage(1);
  };

  const exportBorrowingRecords = () => {
    const rows = [
      ["Student ID", "Student Name", "Email", "Book Title", "Borrow Date", "Due Date", "Return Date", "Status"],
      ...filteredBorrowingRecords.map((record) => [
        record.user_id ?? record.student_id ?? "",
        record.student_name ?? record.user_name ?? "",
        record.student_email ?? record.user_email ?? "",
        record.book_title ?? "",
        formatRecordDate(record.borrow_date || record.approved_at || record.requested_at),
        formatRecordDate(record.due_date),
        formatRecordDate(record.returned_at),
        getRecordStatus(record),
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `libsync-borrowing-records-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // DASHBOARD UI — visual layout aligned with the Student Dashboard
  return (
    <div className="ls-librarian-shell">
      <aside className="ls-librarian-sidebar">
        <svg className="ls-librarian-sidebar-leaves" viewBox="0 0 220 240" aria-hidden="true">
          <path className="ls-leaf-stem" d="M 10 235 C 45 190, 70 143, 112 82" />
          <path className="ls-leaf-shape ls-leaf-one" d="M 23 218 C 4 184, 4 153, 17 130 C 47 157, 48 190, 23 218 Z" />
          <path className="ls-leaf-shape ls-leaf-two" d="M 37 190 C 38 150, 61 119, 91 106 C 92 143, 72 174, 37 190 Z" />
          <path className="ls-leaf-shape ls-leaf-three" d="M 48 171 C 24 139, 24 106, 42 82 C 69 113, 72 144, 48 171 Z" />
          <path className="ls-leaf-shape ls-leaf-four" d="M 57 151 C 70 114, 100 93, 133 95 C 118 130, 91 149, 57 151 Z" />
          <path className="ls-leaf-shape ls-leaf-five" d="M 20 224 C 57 195, 98 191, 136 205 C 102 230, 60 236, 20 224 Z" />
          <path className="ls-leaf-shape ls-leaf-six" d="M 72 131 C 74 93, 98 64, 128 54 C 131 91, 109 120, 72 131 Z" />
          <path className="ls-leaf-shape ls-leaf-seven" d="M 94 102 C 110 71, 140 56, 169 61 C 151 89, 123 103, 94 102 Z" />
        </svg>
        <div className="ls-librarian-brand">
          <div className="ls-librarian-brand-mark"><i className="bi bi-book-half" /></div>
          <div className="ls-librarian-brand-copy">
            <span className="ls-librarian-brand-name">LibSync</span>
            <span className="ls-librarian-brand-caption">Library Management System</span>
          </div>
        </div>

        <div className="ls-librarian-sidebar-label">WORKSPACE</div>
        <nav className="ls-librarian-navigation" aria-label="Librarian navigation">
          <button type="button" className={`ls-librarian-nav-item ${(activeSection === "" || activeSection === "dashboard") ? "active" : ""}`} onClick={() => { setMessage(""); setActiveSection("dashboard"); }}>
            <i className="bi bi-grid-1x2" /><span>Dashboard</span>
          </button>
          <button type="button" className={`ls-librarian-nav-item ${activeSection === "books" ? "active" : ""}`} onClick={() => { setMessage(""); setBooksLoading(true); setBooksError(""); setActiveSection("books"); void loadBooks(); }}>
            <i className="bi bi-book" /><span>Books Management</span>
          </button>
          <button type="button" className={`ls-librarian-nav-item ${activeSection === "students" ? "active" : ""}`} onClick={() => setActiveSection("students")}>
            <i className="bi bi-people" /><span>Students</span>
          </button>
          <button type="button" className={`ls-librarian-nav-item ${activeSection === "requests" ? "active" : ""}`} onClick={openBorrowRequests}>
            <i className="bi bi-arrow-left-right" /><span>Borrow Requests</span>
          </button>
          <button type="button" className={`ls-librarian-nav-item ${activeSection === "scan" || activeSection === "scan-result" ? "active" : ""}`} onClick={() => { setMessage(""); setScannedBatch(null); setScannedToken(""); setActiveSection("scan"); }}>
            <i className="bi bi-qr-code-scan" /><span>QR Scanner</span>
          </button>
          <button
            type="button"
            className={`ls-librarian-nav-item ${activeSection === "records" ? "active" : ""}`}
            onClick={() => {
              setActiveSection("records");
              void loadBorrowRecords();
            }}
          >
            <i className="bi bi-journal-text" /><span>Borrowing Records</span>
          </button>
        </nav>

        <div className="ls-librarian-sidebar-bottom">
          <div className="ls-librarian-profile">
            <div className="ls-librarian-avatar">{(user?.name || "L").trim().charAt(0).toUpperCase()}</div>
            <div className="ls-librarian-profile-copy">
              <span className="ls-librarian-profile-name">{user?.name || "Librarian"}</span>
              <span className="ls-librarian-profile-role">Librarian account</span>
            </div>
          </div>
          <button type="button" className="ls-librarian-logout" onClick={onLogout}>
            <i className="bi bi-box-arrow-left" /><span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="ls-librarian-workspace">
        <header className="ls-librarian-topbar">
          <div>
            <p className="ls-librarian-eyebrow">{activeSection === "books" ? "LIBSYNC / BOOKS MANAGEMENT" : activeSection === "records" ? "LIBSYNC / BORROWING RECORDS" : "LIBSYNC / LIBRARIAN"}</p>
            <h1>{activeSection === "requests" ? "Borrow Requests" : activeSection === "books" ? "Books Management" : activeSection === "students" ? "Students" : activeSection === "scan" ? "QR Scanner" : activeSection === "scan-result" ? "Scanned Request" : activeSection === "records" ? "Borrowing Records" : "Librarian Dashboard"}</h1>
            <p className="ls-librarian-welcome">{activeSection === "books" ? "Manage library books, add new titles, update information, and organize the collection." : activeSection === "records" ? "View all borrowing transactions, due dates, and return status." : `Welcome back, ${user?.name || "Librarian"}. Manage your library from here.`}</p>
          </div>
        </header>

        <div className="ls-librarian-content">
      {(activeSection === "" || activeSection === "dashboard") && (
        <>
          <section className="ls-librarian-stats-grid" aria-label="Library overview">
            <article className="ls-librarian-stat-card">
              <div className="ls-librarian-stat-icon"><i className="bi bi-book" aria-hidden="true" /></div>
              <div className="ls-librarian-stat-copy">
                <span className="ls-librarian-stat-label">Total Books</span>
                <strong>—</strong>
                <small>in library collection</small>
              </div>
              <span className="ls-librarian-stat-tag">COLLECTION</span>
            </article>
            <article className="ls-librarian-stat-card">
              <div className="ls-librarian-stat-icon"><i className="bi bi-people" aria-hidden="true" /></div>
              <div className="ls-librarian-stat-copy">
                <span className="ls-librarian-stat-label">Registered Students</span>
                <strong>—</strong>
                <small>active student accounts</small>
              </div>
              <span className="ls-librarian-stat-tag">MEMBERS</span>
            </article>
            <article className="ls-librarian-stat-card">
              <div className="ls-librarian-stat-icon"><i className="bi bi-clock-history" aria-hidden="true" /></div>
              <div className="ls-librarian-stat-copy">
                <span className="ls-librarian-stat-label">Pending Requests</span>
                <strong>{requestsLoaded ? borrowRequests.filter((request) => String(request.status || "").toLowerCase() === "pending").length : "—"}</strong>
                <small>awaiting approval</small>
              </div>
              <span className="ls-librarian-stat-alert"><i className="bi bi-exclamation" aria-hidden="true" /></span>
            </article>
            <article className="ls-librarian-stat-card">
              <div className="ls-librarian-stat-icon"><i className="bi bi-bar-chart-line" aria-hidden="true" /></div>
              <div className="ls-librarian-stat-copy">
                <span className="ls-librarian-stat-label">Books Borrowed</span>
                <strong>—</strong>
                <small>borrowing activity</small>
              </div>
              <span className="ls-librarian-stat-tag">ACTIVITY</span>
            </article>
          </section>

          <section className="ls-librarian-feature-grid" aria-label="Librarian tools">
            <article className="ls-librarian-feature-card ls-feature-books">
              <div className="ls-librarian-feature-copy">
                <div className="ls-librarian-feature-icon"><i className="bi bi-book-half" aria-hidden="true" /></div>
                <h2>Books</h2>
                <p>Manage library books, add new titles, update information, and organize the collection.</p>
                <button type="button" onClick={() => { setMessage(""); setBooksLoading(true); setBooksError(""); setActiveSection("books"); void loadBooks(); }}>Manage Books <i className="bi bi-arrow-right" aria-hidden="true" /></button>
              </div>
              <div className="ls-librarian-feature-art ls-art-books" aria-hidden="true"><i className="bi bi-stack" /></div>
            </article>

            <article className="ls-librarian-feature-card ls-feature-students">
              <div className="ls-librarian-feature-copy">
                <div className="ls-librarian-feature-icon"><i className="bi bi-people" aria-hidden="true" /></div>
                <h2>Students</h2>
                <p>View and manage registered students, update records, and track library activity.</p>
                <button type="button" onClick={() => setActiveSection("students")}>View Students <i className="bi bi-arrow-right" aria-hidden="true" /></button>
              </div>
              <div className="ls-librarian-feature-art ls-art-students" aria-hidden="true"><i className="bi bi-people-fill" /></div>
            </article>

            <article className="ls-librarian-feature-card ls-feature-requests">
              <div className="ls-librarian-feature-copy">
                <div className="ls-librarian-feature-icon"><i className="bi bi-arrow-left-right" aria-hidden="true" /></div>
                <h2>Borrow Requests</h2>
                <p>Review and approve student borrowing requests in one place.</p>
                <button type="button" onClick={openBorrowRequests}>View Requests <i className="bi bi-arrow-right" aria-hidden="true" /></button>
              </div>
              <div className="ls-librarian-feature-art ls-art-requests" aria-hidden="true"><i className="bi bi-clipboard2-check" /></div>
            </article>

            <article className="ls-librarian-feature-card ls-feature-scan">
              <div className="ls-librarian-feature-copy">
                <div className="ls-librarian-feature-icon"><i className="bi bi-qr-code-scan" aria-hidden="true" /></div>
                <h2>Scan QR Code</h2>
                <p>Scan a student's borrowing QR code to process checkout and returns.</p>
                <button type="button" onClick={() => { setMessage(""); setScannedBatch(null); setScannedToken(""); setActiveSection("scan"); }}>Open Scanner <i className="bi bi-arrow-right" aria-hidden="true" /></button>
              </div>
              <div className="ls-librarian-feature-art ls-art-scan" aria-hidden="true"><i className="bi bi-qr-code" /></div>
            </article>

            <article className="ls-librarian-feature-card ls-feature-records">
              <div className="ls-librarian-feature-copy">
                <div className="ls-librarian-feature-icon"><i className="bi bi-journal-text" aria-hidden="true" /></div>
                <h2>Borrowing Records</h2>
                <p>Track and review book borrowing and returning transactions.</p>
                <button type="button" onClick={() => { setActiveSection("records"); void loadBorrowRecords(); }}>View Records <i className="bi bi-arrow-right" aria-hidden="true" /></button>
              </div>
              <div className="ls-librarian-feature-art ls-art-records" aria-hidden="true"><i className="bi bi-file-earmark-bar-graph" /></div>
            </article>
          </section>
        </>
      )}

            {/* MESSAGE */}

      {message && activeSection !== "books" && (

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

        <div className="ls-librarian-panel management-section">



          <div className="ls-librarian-panel-header management-header">

            <div>

              <h2>Scan Borrowing QR</h2>



              <p>

                Point your camera at the QR code shown

                by the student.

              </p>

            </div>



            <button

              type="button"

              onClick={() => setActiveSection("dashboard")}

            >

              Close

            </button>

          </div>



          {lookupLoading ? (

            <p>Looking up the borrowing batch...</p>

          ) : (

            <QRScanner onScan={handleScan} />

          )}



          <p className="ls-qr-camera-help">
            Keep the student's QR code centered inside the camera frame.
          </p>

        </div>

      )}



      {/* ===================================== */}

      {/* SCANNED BATCH DETAILS */}

      {/* ===================================== */}

      {activeSection === "scan-result" && scannedBatch && (

        <div className="ls-librarian-panel management-section">



          <div className="ls-librarian-panel-header management-header">

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

              <table className="ls-librarian-table management-table">

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

        <div className="ls-librarian-panel management-section">



          <div className="ls-librarian-panel-header management-header">

            <div>

              <h2>Borrow Requests</h2>



              <p>

                Review and process student book requests.

              </p>

            </div>



            <button

              type="button"

              onClick={() => setActiveSection("dashboard")}

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

              <table className="ls-librarian-table management-table">

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



      {/* BOOKS MANAGEMENT */}
      {activeSection === "books" && (
        <section className="ls-books-management" aria-label="Books management">
          <div className="ls-books-stats-grid">
            <article className="ls-books-stat-card">
              <span className="ls-books-stat-icon"><i className="bi bi-book-half" aria-hidden="true" /></span>
              <div><span>Total Books</span><strong>{booksLoaded ? books.length.toLocaleString() : "—"}</strong><small>book titles in catalog</small></div>
            </article>
            <article className="ls-books-stat-card">
              <span className="ls-books-stat-icon"><i className="bi bi-layers" aria-hidden="true" /></span>
              <div><span>Available Books</span><strong>{booksLoaded ? availableCopies.toLocaleString() : "—"}</strong><small>currently available</small></div>
            </article>
            <article className="ls-books-stat-card">
              <span className="ls-books-stat-icon"><i className="bi bi-journal-bookmark" aria-hidden="true" /></span>
              <div><span>Borrowed Books</span><strong>{booksLoaded ? borrowedCopies.toLocaleString() : "—"}</strong><small>currently borrowed</small></div>
            </article>
            <article className="ls-books-stat-card ls-books-stat-warning">
              <span className="ls-books-stat-icon"><i className="bi bi-exclamation-triangle" aria-hidden="true" /></span>
              <div><span>Low Stock Titles</span><strong>{booksLoaded ? lowStockTitles.toLocaleString() : "—"}</strong><small>need attention</small></div>
            </article>
          </div>

          <div className="ls-books-list-panel">
            <div className="ls-books-list-heading">
              <div className="ls-books-heading-icon"><i className="bi bi-book-half" aria-hidden="true" /></div>
              <div className="ls-books-heading-copy">
                <h2>Book List</h2>
                <p>View, search, and manage all library books.</p>
              </div>
              <button type="button" className="ls-books-add-button" onClick={openAddBookModal}>
                <i className="bi bi-plus-lg" aria-hidden="true" /> Add Book
              </button>
            </div>

            {message && <div className="ls-books-feedback ls-books-feedback-success" role="status">{message}</div>}
            {booksError && !bookModalOpen && <div className="ls-books-feedback ls-books-feedback-error" role="alert">{booksError}</div>}

            <div className="ls-books-toolbar">
              <label className="ls-books-search">
                <i className="bi bi-search" aria-hidden="true" />
                <input
                  type="search"
                  value={bookSearch}
                  placeholder="Search by title, author, ISBN, or category..."
                  onChange={(event) => { setBookSearch(event.target.value); setBookPage(1); }}
                  aria-label="Search books"
                />
              </label>
              <select
                className="ls-books-filter"
                value={bookCategoryFilter}
                onChange={(event) => { setBookCategoryFilter(event.target.value); setBookPage(1); }}
                aria-label="Filter by category"
              >
                <option value="all">All Categories</option>
                {bookCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <select
                className="ls-books-filter"
                value={bookStatusFilter}
                onChange={(event) => { setBookStatusFilter(event.target.value); setBookPage(1); }}
                aria-label="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="available">Available</option>
                <option value="borrowed">Borrowed / Unavailable</option>
                <option value="low-stock">Low Stock (2 or fewer)</option>
              </select>
              <button
                type="button"
                className="ls-books-reset-button"
                onClick={() => { setBookSearch(""); setBookCategoryFilter("all"); setBookStatusFilter("all"); setBookPage(1); }}
              >
                <i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Reset
              </button>
            </div>

            <div className="ls-books-table-wrap">
              <table className="ls-books-table">
                <thead>
                  <tr><th>#</th><th>Cover</th><th>Title</th><th>Author</th><th>Category</th><th>ISBN</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {(booksLoading || (!booksLoaded && !booksError)) && !booksLoaded ? (
                    <tr><td colSpan="8" className="ls-books-empty"><span className="ls-books-spinner" /> Loading books...</td></tr>
                  ) : paginatedBooks.length === 0 ? (
                    <tr><td colSpan="8" className="ls-books-empty">
                      <i className="bi bi-journal-x" aria-hidden="true" />
                      <strong>{booksLoaded ? "No books found" : "Books have not loaded yet"}</strong>
                      <span>{booksLoaded ? "Try another search or add a new book to the collection." : "Check the connection and refresh the list."}</span>
                      {!booksLoading && <button type="button" onClick={() => { setBooksLoading(true); setBooksError(""); void loadBooks(); }}>Refresh Books</button>}
                    </td></tr>
                  ) : paginatedBooks.map((book, index) => {
                    const available = Number(book.available_quantity ?? book.quantity ?? 0);
                    const quantity = Number(book.quantity ?? 0);
                    const status = available > 0 ? "Available" : quantity > 0 ? "Borrowed" : "Out of stock";
                    const rowNumber = (currentBookPage - 1) * booksPerPage + index + 1;
                    const bookId = book.id ?? book.book_id;
                    return (
                      <tr key={bookId ?? `${book.title}-${rowNumber}`}>
                        <td className="ls-books-row-number">{rowNumber}</td>
                        <td>
                          <span className={`ls-book-cover-tile ls-book-cover-${index % 5}`} aria-label={`Book cover placeholder for ${book.title || "book"}`}>
                            <i className="bi bi-book-half" aria-hidden="true" />
                          </span>
                        </td>
                        <td><strong className="ls-books-title">{book.title || "Untitled book"}</strong><small className="ls-books-publisher">{book.publisher || ""}</small></td>
                        <td>{book.author || "—"}</td>
                        <td><span className="ls-books-category">{book.category || "Uncategorized"}</span></td>
                        <td className="ls-books-isbn">{book.isbn || "—"}</td>
                        <td><span className={`ls-books-status ${available > 0 ? "is-available" : quantity > 0 ? "is-borrowed" : "is-empty-stock"}`}>{status}</span><small className="ls-books-quantity">{available} of {quantity} available</small></td>
                        <td>
                          <div className="ls-books-actions">
                            <button type="button" className="ls-books-edit-action" aria-label={`Edit ${book.title || "book"}`} title="Edit book" onClick={() => openEditBookModal(book)}>
                              <i className="bi bi-pencil" aria-hidden="true" />
                            </button>
                            <button type="button" className="ls-books-delete-action" aria-label={`Delete ${book.title || "book"}`} title="Delete book" disabled={deletingBookId === bookId} onClick={() => handleDeleteBook(book)}>
                              <i className="bi bi-trash3" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="ls-books-list-footer">
              <span>Showing {filteredBooks.length === 0 ? 0 : (currentBookPage - 1) * booksPerPage + 1} to {Math.min(currentBookPage * booksPerPage, filteredBooks.length)} of {filteredBooks.length} books</span>
              <div className="ls-books-pagination" aria-label="Books list pages">
                <button type="button" aria-label="Previous page" disabled={currentBookPage <= 1} onClick={() => setBookPage((page) => Math.max(1, page - 1))}><i className="bi bi-chevron-left" aria-hidden="true" /></button>
                {visibleBookPages.map((page) => (
                  <button type="button" key={page} className={page === currentBookPage ? "active" : ""} aria-current={page === currentBookPage ? "page" : undefined} onClick={() => setBookPage(page)}>{page}</button>
                ))}
                <button type="button" aria-label="Next page" disabled={currentBookPage >= totalBookPages} onClick={() => setBookPage((page) => Math.min(totalBookPages, page + 1))}><i className="bi bi-chevron-right" aria-hidden="true" /></button>
              </div>
            </div>
          </div>

          {bookModalOpen && (
            <div className="ls-books-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !bookSaving) setBookModalOpen(false); }}>
              <section className="ls-books-modal" role="dialog" aria-modal="true" aria-labelledby="ls-books-modal-title">
                <header className="ls-books-modal-header">
                  <span className="ls-books-modal-icon"><i className="bi bi-book-half" aria-hidden="true" /></span>
                  <div><h2 id="ls-books-modal-title">{editingBook ? "Edit Book Details" : "Add New Book"}</h2><p>{editingBook ? "Update the information for this title." : "Add a new title to your library collection."}</p></div>
                  <button type="button" className="ls-books-modal-close" aria-label="Close form" disabled={bookSaving} onClick={() => setBookModalOpen(false)}><i className="bi bi-x-lg" aria-hidden="true" /></button>
                </header>
                <form className="ls-books-form" onSubmit={handleBookSubmit}>
                  <label className="ls-books-form-field"><span>Title <b>*</b></span><input name="title" value={bookForm.title} onChange={handleBookFormChange} placeholder="Enter book title" required maxLength="255" /></label>
                  <label className="ls-books-form-field"><span>ISBN</span><input name="isbn" value={bookForm.isbn} onChange={handleBookFormChange} placeholder="Enter ISBN number" maxLength="32" /></label>
                  <label className="ls-books-form-field"><span>Author <b>*</b></span><input name="author" value={bookForm.author} onChange={handleBookFormChange} placeholder="Enter author name" required maxLength="255" /></label>
                  <label className="ls-books-form-field"><span>Quantity <b>*</b></span><input type="number" name="quantity" value={bookForm.quantity} onChange={handleBookFormChange} min="1" step="1" required /></label>
                  <label className="ls-books-form-field"><span>Category</span><input name="category" value={bookForm.category} onChange={handleBookFormChange} placeholder="e.g. Technology" list="ls-books-category-suggestions" maxLength="100" /><datalist id="ls-books-category-suggestions">{bookCategories.map((category) => <option key={category} value={category} />)}</datalist></label>
                  <label className="ls-books-form-field"><span>Publisher</span><input name="publisher" value={bookForm.publisher} onChange={handleBookFormChange} placeholder="Enter publisher" maxLength="255" /></label>
                  <label className="ls-books-form-field"><span>Year Published</span><input type="number" name="year_published" value={bookForm.year_published} onChange={handleBookFormChange} placeholder="e.g. 2024" min="1000" max={new Date().getFullYear() + 1} step="1" /></label>
                  <p className="ls-books-form-note"><i className="bi bi-info-circle" aria-hidden="true" /> Required fields are marked with an asterisk.</p>
                  {booksError && <div className="ls-books-feedback ls-books-feedback-error ls-books-form-error" role="alert">{booksError}</div>}
                  <footer className="ls-books-form-footer">
                    <button type="button" className="ls-books-cancel-button" disabled={bookSaving} onClick={() => { setBookModalOpen(false); setBooksError(""); }}>Cancel</button>
                    <button type="submit" className="ls-books-submit-button" disabled={bookSaving}>{bookSaving ? <><span className="ls-books-button-spinner" /> Saving...</> : <><i className="bi bi-floppy" aria-hidden="true" /> {editingBook ? "Save Changes" : "Add Book"}</>}</button>
                  </footer>
                </form>
              </section>
            </div>
          )}
        </section>
      )}



      {/* STUDENTS PLACEHOLDER */}

      {activeSection === "students" && (

        <div className="ls-librarian-panel management-section">

          <h2>Students</h2>

          <p>Student list will be added next.</p>



          <button

            type="button"

            onClick={() => setActiveSection("dashboard")}

          >

            Close

          </button>

        </div>

      )}



      {/* BORROWING RECORDS */}
      {activeSection === "records" && (
        <section className="ls-records-page" aria-label="Borrowing Records">
          <section className="ls-records-stats-grid" aria-label="Borrowing statistics">
            <article className="ls-records-stat-card">
              <span className="ls-records-stat-icon"><i className="bi bi-journal-bookmark" aria-hidden="true" /></span>
              <div><span className="ls-records-stat-label">Total Borrowings</span><strong>{recordsLoaded ? borrowingRecordStats.total : "—"}</strong><small>approved transactions</small></div>
            </article>
            <article className="ls-records-stat-card">
              <span className="ls-records-stat-icon"><i className="bi bi-clock-history" aria-hidden="true" /></span>
              <div><span className="ls-records-stat-label">Currently Borrowed</span><strong>{recordsLoaded ? borrowingRecordStats.borrowed : "—"}</strong><small>not yet returned, before due date</small></div>
            </article>
            <article className="ls-records-stat-card ls-records-stat-warning">
              <span className="ls-records-stat-icon"><i className="bi bi-exclamation-triangle" aria-hidden="true" /></span>
              <div><span className="ls-records-stat-label">Overdue Books</span><strong>{recordsLoaded ? borrowingRecordStats.overdue : "—"}</strong><small>past the due date</small></div>
            </article>
            <article className="ls-records-stat-card">
              <span className="ls-records-stat-icon"><i className="bi bi-check-circle" aria-hidden="true" /></span>
              <div><span className="ls-records-stat-label">Returned Books</span><strong>{recordsLoaded ? borrowingRecordStats.returned : "—"}</strong><small>already returned</small></div>
            </article>
          </section>

          <section className="ls-records-panel">
            <header className="ls-records-panel-header">
              <div className="ls-records-panel-title">
                <span className="ls-records-title-icon"><i className="bi bi-journal-text" aria-hidden="true" /></span>
                <div><h2>Borrowing Records</h2><p>List of all borrowing transactions in the library.</p></div>
              </div>
              <div className="ls-records-panel-actions">
                <button type="button" className="ls-records-outline-button" onClick={exportBorrowingRecords} disabled={filteredBorrowingRecords.length === 0}>
                  <i className="bi bi-download" aria-hidden="true" /> Export CSV
                </button>
                <button type="button" className="ls-records-refresh-button" onClick={() => void loadBorrowRecords()} disabled={recordsLoading} aria-label="Refresh borrowing records">
                  <i className={`bi bi-arrow-clockwise ${recordsLoading ? "ls-records-spin" : ""}`} aria-hidden="true" /> Refresh
                </button>
              </div>
            </header>

            <div className="ls-records-toolbar">
              <label className="ls-records-search-field">
                <i className="bi bi-search" aria-hidden="true" />
                <input type="search" value={recordSearch} onChange={(event) => { setRecordSearch(event.target.value); setRecordPage(1); }} placeholder="Search by student name, ID, or book title..." aria-label="Search borrowing records" />
              </label>
              <select value={recordStatusFilter} onChange={(event) => { setRecordStatusFilter(event.target.value); setRecordPage(1); }} aria-label="Filter by status">
                <option value="all">All Status</option><option value="borrowed">Borrowed</option><option value="overdue">Overdue</option><option value="returned">Returned</option>
              </select>
              <select value={recordBookFilter} onChange={(event) => { setRecordBookFilter(event.target.value); setRecordPage(1); }} aria-label="Filter by book">
                <option value="all">All Books</option>{recordBookOptions.map((bookTitle) => <option key={bookTitle} value={bookTitle}>{bookTitle}</option>)}
              </select>
              <label className="ls-records-date-field"><span>From</span><input type="date" value={recordStartDate} max={recordEndDate || undefined} onChange={(event) => { setRecordStartDate(event.target.value); setRecordPage(1); }} aria-label="Borrow date from" /></label>
              <label className="ls-records-date-field"><span>To</span><input type="date" value={recordEndDate} min={recordStartDate || undefined} onChange={(event) => { setRecordEndDate(event.target.value); setRecordPage(1); }} aria-label="Borrow date to" /></label>
              <button type="button" className="ls-records-reset-button" onClick={resetRecordFilters}><i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Reset</button>
            </div>

            {recordsError && <div className="ls-records-feedback ls-records-feedback-error" role="alert"><i className="bi bi-exclamation-circle" aria-hidden="true" /> {recordsError}</div>}

            {recordsLoading && borrowingRecords.length === 0 ? (
              <div className="ls-records-empty"><span className="ls-records-loading-spinner" /><strong>Loading borrowing records...</strong><p>Getting the latest borrowing and return details from LibSync.</p></div>
            ) : recordsError ? (
              <div className="ls-records-empty"><i className="bi bi-exclamation-circle" aria-hidden="true" /><strong>Could not load borrowing records</strong><p>Check the message above, then click Refresh after the backend is running.</p></div>
            ) : !recordsLoaded ? (
              <div className="ls-records-empty"><i className="bi bi-journal-text" aria-hidden="true" /><strong>Borrowing records not loaded yet</strong><p>Open this page or click Refresh to load transactions.</p></div>
            ) : borrowingRecords.length === 0 ? (
              <div className="ls-records-empty"><i className="bi bi-journal-x" aria-hidden="true" /><strong>No borrowing records yet</strong><p>Approved borrowing requests will appear here.</p></div>
            ) : filteredBorrowingRecords.length === 0 ? (
              <div className="ls-records-empty ls-records-empty-compact"><i className="bi bi-search" aria-hidden="true" /><strong>No matching records</strong><p>Try changing your search or filters.</p></div>
            ) : (
              <>
                <div className="ls-records-table-wrap">
                  <table className="ls-records-table">
                    <thead><tr><th>#</th><th>Student ID</th><th>Student Name</th><th>Book Title</th><th>Borrow Date</th><th>Due Date</th><th>Return Date</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {paginatedBorrowingRecords.map((record, index) => {
                        const status = getRecordStatus(record);
                        const statusLabel = status === "borrowed" ? "Borrowed" : status === "overdue" ? "Overdue" : status === "returned" ? "Returned" : status.replace(/_/g, " ");
                        return (
                          <tr key={record.request_id ?? record.id ?? `${record.user_id}-${record.book_id}-${index}`}>
                            <td>{(currentRecordPage - 1) * recordsPerPage + index + 1}</td>
                            <td><span className="ls-records-student-id">{record.student_id ?? record.user_id ?? "—"}</span></td>
                            <td><div className="ls-records-student-cell"><strong>{record.student_name || record.user_name || "Unknown student"}</strong><small>{record.student_email || record.user_email || ""}</small></div></td>
                            <td><span className="ls-records-book-title">{record.book_title || "Unknown book"}</span></td>
                            <td>{formatRecordDate(record.borrow_date || record.approved_at || record.requested_at)}</td>
                            <td>{formatRecordDate(record.due_date)}</td>
                            <td>{formatRecordDate(record.returned_at)}</td>
                            <td><span className={`ls-records-status ls-records-status-${status}`}>{statusLabel}</span></td>
                            <td><button type="button" className="ls-records-view-button" onClick={() => setSelectedRecord(record)} aria-label={`View record for ${record.student_name || record.user_name || "student"}`} title="View details"><i className="bi bi-eye" aria-hidden="true" /></button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <footer className="ls-records-table-footer">
                  <span>Showing {filteredBorrowingRecords.length === 0 ? 0 : (currentRecordPage - 1) * recordsPerPage + 1} to {Math.min(currentRecordPage * recordsPerPage, filteredBorrowingRecords.length)} of {filteredBorrowingRecords.length} records</span>
                  <nav className="ls-records-pagination" aria-label="Borrowing records pages">
                    <button type="button" aria-label="Previous page" disabled={currentRecordPage <= 1} onClick={() => setRecordPage((page) => Math.max(1, page - 1))}><i className="bi bi-chevron-left" aria-hidden="true" /></button>
                    {visibleRecordPages.map((page) => <button key={page} type="button" className={page === currentRecordPage ? "active" : ""} aria-current={page === currentRecordPage ? "page" : undefined} onClick={() => setRecordPage(page)}>{page}</button>)}
                    <button type="button" aria-label="Next page" disabled={currentRecordPage >= totalRecordPages} onClick={() => setRecordPage((page) => Math.min(totalRecordPages, page + 1))}><i className="bi bi-chevron-right" aria-hidden="true" /></button>
                  </nav>
                </footer>
              </>
            )}
          </section>

          {selectedRecord && (
            <div className="ls-records-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRecord(null); }}>
              <section className="ls-records-modal" role="dialog" aria-modal="true" aria-labelledby="ls-records-modal-title">
                <header className="ls-records-modal-header"><span className="ls-records-title-icon"><i className="bi bi-journal-check" aria-hidden="true" /></span><div><h2 id="ls-records-modal-title">Borrowing Record Details</h2><p>Transaction information from the library database.</p></div><button type="button" onClick={() => setSelectedRecord(null)} aria-label="Close details"><i className="bi bi-x-lg" aria-hidden="true" /></button></header>
                <div className="ls-records-detail-grid">
                  <div><span>Student Name</span><strong>{selectedRecord.student_name || selectedRecord.user_name || "Unknown student"}</strong></div>
                  <div><span>Student ID</span><strong>{selectedRecord.student_id ?? selectedRecord.user_id ?? "—"}</strong></div>
                  <div><span>Email</span><strong>{selectedRecord.student_email || selectedRecord.user_email || "—"}</strong></div>
                  <div><span>Book Title</span><strong>{selectedRecord.book_title || "Unknown book"}</strong></div>
                  <div><span>Borrow Date</span><strong>{formatRecordDate(selectedRecord.borrow_date || selectedRecord.approved_at || selectedRecord.requested_at)}</strong></div>
                  <div><span>Due Date</span><strong>{formatRecordDate(selectedRecord.due_date)}</strong></div>
                  <div><span>Return Date</span><strong>{formatRecordDate(selectedRecord.returned_at)}</strong></div>
                  <div><span>Status</span><strong><span className={`ls-records-status ls-records-status-${getRecordStatus(selectedRecord)}`}>{getRecordStatus(selectedRecord)}</span></strong></div>
                  <div><span>Transaction ID</span><strong>{selectedRecord.request_id ?? selectedRecord.id ?? "—"}</strong></div>
                  <div><span>Borrow Batch ID</span><strong>{selectedRecord.batch_id ?? "—"}</strong></div>
                </div>
                <footer className="ls-records-modal-footer"><button type="button" onClick={() => setSelectedRecord(null)}>Close</button></footer>
              </section>
            </div>
          )}
        </section>
      )}


        </div>
      </main>
    </div>
  );
}

export default LibrarianDashboard;
