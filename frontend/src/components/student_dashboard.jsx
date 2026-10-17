import { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import "./student_dashboard.css";

const API_BASE_URL = "https://identify-spilt-cover.ngrok-free.dev";

const COVER_COLORS = [
  "#E1F2E7",
  "#F7E5D5",
  "#E1E8F7",
  "#F4E6F0",
  "#F5EFCF",
  "#DCEFEB",
];

function getStoredCover(book) {
  return (
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
    ""
  );
}

function storedCoverKey(book, googleCover, openLibraryCover) {
  return [
    getStoredCover(book),
    String(book.isbn || ""),
    googleCover || "",
    openLibraryCover || "",
  ].join("|");
}

function normalizeBookText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mapGoogleVolumeToOnlineBook(item) {
  const info = item?.volumeInfo || {};
  const imageLinks = info.imageLinks || {};
  const cover = (
    imageLinks.extraLarge ||
    imageLinks.large ||
    imageLinks.medium ||
    imageLinks.thumbnail ||
    imageLinks.smallThumbnail ||
    ""
  ).replace(/^http:/i, "https:");
  const identifiers = info.industryIdentifiers || [];
  const isbn =
    identifiers.find((identifier) => identifier.type === "ISBN_13")?.identifier ||
    identifiers.find((identifier) => identifier.type === "ISBN_10")?.identifier ||
    "";

  return {
    id: `online-${item.id}`,
    googleVolumeId: item.id,
    isOnline: true,
    title: info.title || "Untitled Book",
    author: Array.isArray(info.authors) && info.authors.length
      ? info.authors.join(", ")
      : "Author not listed",
    category: Array.isArray(info.categories) && info.categories.length
      ? info.categories[0].split(" /")[0]
      : "Online catalog",
    isbn,
    publisher: info.publisher || "",
    yearPublished: info.publishedDate || "",
    description: info.description || "",
    cover_image_url: cover,
    previewLink: info.previewLink || info.infoLink || "",
    infoLink: info.infoLink || "",
    available: false,
    availableQuantity: 0,
    quantity: 0,
  };
}

async function findGoogleBookCover(book, signal) {
  const isbn = String(book.isbn || "").replace(/[^0-9Xx]/g, "");
  const query = isbn
    ? `isbn:${isbn}`
    : `intitle:${book.title}${book.author && !/unknown author|n\/?a|none/i.test(book.author) ? ` inauthor:${book.author}` : ""}`;
  const params = new URLSearchParams({ q: query, maxResults: "10" });
  const response = await fetch(
    `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
    { signal }
  );
  if (!response.ok) return "";

  const data = await response.json();
  const items = data.items || [];
  const normalizedTitle = normalizeBookText(book.title);
  const normalizedAuthor = normalizeBookText(book.author);
  const hasSpecificAuthor = Boolean(normalizedAuthor) && !/unknown author|n a|none/.test(normalizedAuthor);

  const exactIsbnMatch = isbn
    ? items.find((item) =>
        (item.volumeInfo?.industryIdentifiers || []).some(
          (identifier) => String(identifier.identifier || "").replace(/[^0-9Xx]/g, "") === isbn
        )
      )
    : null;

  const titleMatch = items.find((item) => {
    const info = item.volumeInfo || {};
    const candidateTitle = normalizeBookText(info.title);
    const candidateAuthors = normalizeBookText((info.authors || []).join(" "));
    const matchesTitle = candidateTitle === normalizedTitle ||
      candidateTitle.startsWith(`${normalizedTitle} `);
    const matchesAuthor = !hasSpecificAuthor || (
      Boolean(candidateAuthors) &&
      (candidateAuthors.includes(normalizedAuthor) || normalizedAuthor.includes(candidateAuthors))
    );
    return matchesTitle && matchesAuthor;
  });

  // Only use exact ISBN matches or title/author matches; never show a random search result.
  for (const item of [exactIsbnMatch, titleMatch].filter(Boolean)) {
    const images = item.volumeInfo?.imageLinks || {};
    const imageUrl = images.thumbnail || images.smallThumbnail || images.small || "";
    if (imageUrl) return imageUrl.replace(/^http:/i, "https:");
  }
  return "";
}

async function findOpenLibraryCover(book, signal) {
  if (!book.title) return "";
  const isbn = String(book.isbn || "").replace(/[^0-9Xx]/g, "");
  if (isbn) {
    const isbnCover = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-M.jpg?default=false`;
    // Let the image's onError handler continue to the next source if this ISBN has no cover.
    return isbnCover;
  }

  const params = new URLSearchParams({
    title: book.title,
    fields: "title,author_name,cover_i,isbn",
    limit: "10",
  });
  if (book.author && !/unknown author|n\/?a|none/i.test(book.author)) params.set("author", book.author);

  const response = await fetch(
    `https://openlibrary.org/search.json?${params.toString()}`,
    { signal }
  );
  if (!response.ok) return "";

  const data = await response.json();
  const docs = (data.docs || []).filter((item) => item.cover_i);
  const normalizedTitle = normalizeBookText(book.title);
  const normalizedAuthor = normalizeBookText(book.author);
  const hasSpecificAuthor = Boolean(normalizedAuthor) && !/unknown author|n a|none/.test(normalizedAuthor);
  const matchingDoc = docs.find((item) => {
    const candidateTitle = normalizeBookText(item.title);
    const candidateAuthors = normalizeBookText((item.author_name || []).join(" "));
    const matchesTitle = candidateTitle === normalizedTitle ||
      candidateTitle.startsWith(`${normalizedTitle} `);
    const matchesAuthor = !hasSpecificAuthor || (
      Boolean(candidateAuthors) &&
      (candidateAuthors.includes(normalizedAuthor) || normalizedAuthor.includes(candidateAuthors))
    );
    return matchesTitle && matchesAuthor;
  });
  const coverId = matchingDoc?.cover_i;
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg?default=false` : "";
}

function BookCover({ book, googleCover, openLibraryCover, variant = "card" }) {
  const storedCover = getStoredCover(book);
  const isbn = String(book.isbn || "").replace(/[^0-9Xx]/g, "");
  const isbnCover = isbn
    ? `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-M.jpg?default=false`
    : "";
  // Prefer a manually saved cover, then online results, and use ISBN cover as a fallback.
  const sources = [...new Set([storedCover, googleCover, isbnCover, openLibraryCover].filter(Boolean))];
  const [sourceIndex, setSourceIndex] = useState(0);

  const coverColor = COVER_COLORS[Math.abs(Number(book.id) || 0) % COVER_COLORS.length];

  return (
    <div className={`student-book-cover student-book-cover--${variant}`}>
      {sourceIndex < sources.length ? (
        <img
          src={sources[sourceIndex]}
          alt={`Cover of ${book.title}`}
          loading="lazy"
          onError={() => setSourceIndex((current) => current + 1)}
        />
      ) : (
        <div
          className="student-book-cover-placeholder"
          style={{ background: coverColor }}
          aria-label={`Illustrated placeholder cover for ${book.title}`}
        >
          <i className="bi bi-book-half" aria-hidden="true"></i>
          <span>{book.title || "Untitled Book"}</span>
          <small>{book.author || "Unknown Author"}</small>
        </div>
      )}
    </div>
  );
}

function StudentDashboard({ onLogout }) {
  const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  const userId = user?.id;

  const [activeMenu, setActiveMenu] = useState("books");
  const [books, setBooks] = useState([]);
  const [onlineBooks, setOnlineBooks] = useState([]);
  const [isOnlineLoading, setIsOnlineLoading] = useState(true);
  const [onlineBooksError, setOnlineBooksError] = useState("");
  const [selectedBooks, setSelectedBooks] = useState([]);
  const [qrRequest, setQrRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pageError, setPageError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("az");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [previewBook, setPreviewBook] = useState(null);
  const [googleBookCovers, setGoogleBookCovers] = useState({});
  const [openLibraryBookCovers, setOpenLibraryBookCovers] = useState({});
  const [studentRequests, setStudentRequests] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [loanDays, setLoanDays] = useState(1);
  const [showReturnQr, setShowReturnQr] = useState(false);
  const [returnQrMessage, setReturnQrMessage] = useState("");
  const [studentBatches, setStudentBatches] = useState([]);
  const [isBatchesLoading, setIsBatchesLoading] = useState(false);
  const [batchStatusError, setBatchStatusError] = useState("");
  const [batchRefreshVersion, setBatchRefreshVersion] = useState(0);

  // Load the real book catalogue from the existing backend.
  useEffect(() => {
    const controller = new AbortController();

    const loadBooks = async () => {
      setIsLoading(true);
      setPageError("");

      try {
        const response = await fetch(`${API_BASE_URL}/api/books`, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          signal: controller.signal,
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Unable to load books.");
        }
        if (!Array.isArray(data)) {
          throw new Error("The books API returned an unexpected response.");
        }

        const formattedBooks = data.map((book) => {
          const availableQuantity = Number(book.available_quantity ?? 0);
          return {
            id: Number(book.id),
            title: book.title || "Untitled Book",
            author: book.author || "Unknown Author",
            category: book.category || "Uncategorized",
            isbn: book.isbn || "",
            publisher: book.publisher || "",
            yearPublished: book.year_published || book.yearPublished || "",
            quantity: Number(book.quantity ?? 0),
            availableQuantity,
            available: availableQuantity > 0,
            cover_image_url: book.cover_image_url || "",
            cover_image: book.cover_image || "",
            cover_url: book.cover_url || "",
            image_url: book.image_url || "",
            thumbnail: book.thumbnail || "",
            image: book.image || "",
            book_cover: book.book_cover || "",
            book_image: book.book_image || "",
            image_path: book.image_path || "",
            cover: book.cover || "",
            photo_url: book.photo_url || "",
          };
        });

        setBooks(formattedBooks);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Load books error:", error);
          setPageError(error.message || "Unable to connect to the server.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    loadBooks();
    return () => controller.abort();
  }, []);

  // Load a separate online catalog automatically when the dashboard opens.
  // These records are discovery-only: they are not available for borrowing
  // until a librarian adds the title to the LibSync inventory.
  useEffect(() => {
    const controller = new AbortController();
    const subjectQueries = [
      "subject:fiction",
      "subject:computers",
      "subject:education",
      "subject:romance",
    ];

    const loadOnlineBooks = async () => {
      const responses = await Promise.allSettled(
        subjectQueries.map(async (query) => {
          const params = new URLSearchParams({
            q: query,
            maxResults: "12",
            orderBy: "relevance",
            printType: "books",
          });
          const response = await fetch(
            `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
            { signal: controller.signal }
          );
          if (!response.ok) {
            throw new Error(`Google Books request failed (${response.status}).`);
          }
          const data = await response.json();
          return Array.isArray(data.items) ? data.items : [];
        })
      );

      if (controller.signal.aborted) return;

      const successfulResponses = responses.filter((result) => result.status === "fulfilled");
      const rawItems = successfulResponses.flatMap((result) => result.value);
      const seenVolumeIds = new Set();
      const seenTitles = new Set();
      const uniqueOnlineBooks = rawItems
        .filter((item) => {
          const info = item?.volumeInfo || {};
          const titleKey = normalizeBookText(info.title);
          if (!item?.id || !titleKey || seenVolumeIds.has(item.id) || seenTitles.has(titleKey)) {
            return false;
          }
          seenVolumeIds.add(item.id);
          seenTitles.add(titleKey);
          return true;
        })
        .map(mapGoogleVolumeToOnlineBook);

      setOnlineBooks(uniqueOnlineBooks);
      if (successfulResponses.length === 0) {
        setOnlineBooksError("The online book catalog is temporarily unavailable. You can still browse books in the LibSync library.");
      } else if (uniqueOnlineBooks.length === 0) {
        setOnlineBooksError("No online titles were returned. Please try again later.");
      } else {
        setOnlineBooksError("");
      }
      setIsOnlineLoading(false);
    };

    loadOnlineBooks().catch((error) => {
      if (error.name !== "AbortError" && !controller.signal.aborted) {
        console.warn("Load Google Books catalog error:", error);
        setOnlineBooksError("The online book catalog is temporarily unavailable. You can still browse books in the LibSync library.");
        setIsOnlineLoading(false);
      }
    });

    return () => controller.abort();
  }, []);

  // Automatically look up online book covers when there is no manually saved cover.
  // Google Books is tried first; Open Library is queried only if Google has no cover.
  // A small worker pool avoids firing too many requests at once for larger catalogues.
  useEffect(() => {
    const controller = new AbortController();
    const booksNeedingLookup = books.filter((book) => !getStoredCover(book) && book.title);

    if (booksNeedingLookup.length === 0) return () => controller.abort();

    const findCovers = async () => {
      const foundGoogle = {};
      const foundOpenLibrary = {};
      let nextIndex = 0;

      const worker = async () => {
        while (!controller.signal.aborted) {
          const index = nextIndex;
          nextIndex += 1;
          if (index >= booksNeedingLookup.length) return;

          const book = booksNeedingLookup[index];
          let googleCover = "";
          try {
            googleCover = await findGoogleBookCover(book, controller.signal);
          } catch (error) {
            if (error.name !== "AbortError") {
              // Continue to Open Library if Google Books is unavailable.
            }
          }

          if (googleCover) {
            foundGoogle[book.id] = googleCover;
            continue;
          }

          try {
            const openLibraryCover = await findOpenLibraryCover(book, controller.signal);
            if (openLibraryCover) foundOpenLibrary[book.id] = openLibraryCover;
          } catch (error) {
            if (error.name !== "AbortError") {
              // The placeholder cover remains available if both APIs fail.
            }
          }
        }
      };

      const workerCount = Math.min(3, booksNeedingLookup.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      if (!controller.signal.aborted) {
        setGoogleBookCovers((previous) => ({ ...previous, ...foundGoogle }));
        setOpenLibraryBookCovers((previous) => ({ ...previous, ...foundOpenLibrary }));
      }
    };

    findCovers();
    return () => controller.abort();
  }, [books]);

  // Load only the signed-in student's own borrowing requests for the dashboard activity panel.
  useEffect(() => {
    // State starts as an empty list and not loading, so no synchronous
    // state updates are needed when there is no signed-in student ID.
    if (!userId) return undefined;

    const controller = new AbortController();
    const loadStudentRequests = async () => {
      setIsHistoryLoading(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/student/borrow-requests/${encodeURIComponent(userId)}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              "ngrok-skip-browser-warning": "true",
            },
            signal: controller.signal,
          }
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Unable to load borrowing activity.");
        }
        setStudentRequests(Array.isArray(data.requests) ? data.requests : []);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.warn("Load student borrowing activity error:", error);
          setStudentRequests([]);
        }
      } finally {
        if (!controller.signal.aborted) setIsHistoryLoading(false);
      }
    };

    loadStudentRequests();
    return () => controller.abort();
  }, [userId]);

  // Load the student's borrowing batches when the QR page opens or is refreshed.
  // The server sets due_date only when the librarian finishes approving the batch,
  // so a pending approval does not consume the student's chosen loan period.
  useEffect(() => {
    if (activeMenu !== "qr" || !userId) return undefined;

    const controller = new AbortController();
    const loadStudentBatches = async () => {
      setIsBatchesLoading(true);
      setBatchStatusError("");
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/student/borrow-batches/${encodeURIComponent(userId)}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              "X-User-ID": String(userId),
              "ngrok-skip-browser-warning": "true",
            },
            signal: controller.signal,
          }
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Unable to load borrowing status.");
        }
        setStudentBatches(Array.isArray(data.batches) ? data.batches : []);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.warn("Load student borrowing batches error:", error);
          setBatchStatusError(error.message || "Unable to refresh borrowing status.");
        }
      } finally {
        if (!controller.signal.aborted) setIsBatchesLoading(false);
      }
    };

    loadStudentBatches();
    return () => controller.abort();
  }, [activeMenu, userId, qrRequest?.batchId, batchRefreshVersion]);

  const categories = useMemo(
    () =>
      [...new Set(books.map((book) => book.category).filter(Boolean))].sort((a, b) =>
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
        const comparison = a.title.localeCompare(b.title, undefined, {
          sensitivity: "base",
          numeric: true,
        });
        return sortOrder === "za" ? -comparison : comparison;
      });
  }, [books, searchTerm, selectedCategory, sortOrder]);

  const visibleOnlineBooks = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const libraryTitles = new Set(books.map((book) => normalizeBookText(book.title)));
    return onlineBooks.filter((book) => {
      // Avoid showing exact title duplicates already held by LibSync.
      if (libraryTitles.has(normalizeBookText(book.title))) return false;
      const searchableText = [book.title, book.author, book.category, book.isbn, book.publisher, book.description]
        .join(" ")
        .toLowerCase();
      return !search || searchableText.includes(search);
    });
  }, [onlineBooks, books, searchTerm]);

  const featuredBooks = useMemo(
    () => [...books].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 4),
    [books]
  );

  const recentStudentRequests = studentRequests.slice(0, 4);
  const formatActivityDate = (value) => {
    if (!value) return "Date unavailable";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
    return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const formatDueDate = (value) => {
    if (!value) return "Not set yet";
    // Parse SQL DATE and DATETIME strings as local calendar dates to avoid UTC day shifts.
    const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    const parsed = dateOnly
      ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
      : new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
    return parsed.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getDaysRemaining = (value) => {
    if (!value) return null;
    const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    const due = dateOnly
      ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
      : new Date(value);
    if (Number.isNaN(due.getTime())) return null;
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((due.getTime() - today.getTime()) / 86400000);
  };

  const activeQrBatch = useMemo(() => {
    const activeStatuses = ["pending", "approved", "partially_returned"];
    const storedBatch = qrRequest?.batchId
      ? studentBatches.find((batch) => Number(batch.id) === Number(qrRequest.batchId))
      : null;

    if (qrRequest) {
      const storedBooks = Array.isArray(storedBatch?.books) && storedBatch.books.length
        ? storedBatch.books
        : qrRequest.books;
      return {
        ...qrRequest,
        batchId: storedBatch?.id ?? qrRequest.batchId,
        qrPayload: storedBatch?.qr_token || qrRequest.qrPayload,
        returnQrPayload: storedBatch?.return_qr_token || qrRequest.returnQrPayload || null,
        status: storedBatch?.status || "pending",
        loanDays: Number(storedBatch?.loan_days ?? qrRequest.loanDays ?? 1),
        dueDate: storedBatch?.due_date || null,
        requestedAt: storedBatch?.requested_at || qrRequest.requestedAt || null,
        approvedAt: storedBatch?.approved_at || qrRequest.approvedAt || null,
        books: storedBooks.map((book) => ({
          ...book,
          id: book.id ?? book.book_id,
          title: book.title || book.book_title || "Untitled Book",
        })),
      };
    }

    const latestActive = studentBatches.find(
      (batch) => activeStatuses.includes(batch.status) && batch.qr_token
    ) || studentBatches.find((batch) => batch.status === "returned" && batch.qr_token);
    if (!latestActive) return null;
    return {
      batchId: latestActive.id,
      qrPayload: latestActive.qr_token,
      returnQrPayload: latestActive.return_qr_token || null,
      status: latestActive.status,
      loanDays: Number(latestActive.loan_days || 1),
      dueDate: latestActive.due_date || null,
      requestedAt: latestActive.requested_at || null,
      approvedAt: latestActive.approved_at || null,
      books: (latestActive.books || []).map((book) => ({
        ...book,
        id: book.id ?? book.book_id,
        title: book.title || book.book_title || "Untitled Book",
      })),
    };
  }, [qrRequest, studentBatches]);

  const addBook = (book) => {
    setPageError("");
    setSelectedBooks((previous) => {
      const exists = previous.some((item) => item.id === book.id);
      if (exists || !book.available) return previous;
      return [...previous, book];
    });
  };

  const removeBook = (bookId) => {
    setSelectedBooks((previous) => previous.filter((book) => book.id !== bookId));
  };

  const handleGenerateQR = async () => {
    setPageError("");

    if (!user?.id || !Number.isInteger(Number(user.id))) {
      setPageError("Your student account ID is missing. Please log in again.");
      return;
    }
    if (selectedBooks.length === 0) {
      setPageError("Please select at least one book.");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/borrow-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          user_id: Number(user.id),
          book_ids: selectedBooks.map((book) => book.id),
          loan_days: Number(loanDays),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to submit borrow request.");
      }

      const qrPayload = data.qr_payload || data.qr_token;
      if (!qrPayload) {
        setPageError(
          "The backend accepted the request but did not return a QR token. " +
            "The request may already be saved. Check the backend response " +
            "before submitting again to avoid duplicate requests."
        );
        return;
      }

      setQrRequest({
        batchId: data.batch_id,
        requestIds: data.request_ids || [],
        qrPayload,
        returnQrPayload: data.return_qr_token || null,
        loanDays: Number(data.loan_days || loanDays),
        dueDate: data.due_date || null,
        requestedAt: data.requested_at || null,
        approvedAt: data.approved_at || null,
        books: [...selectedBooks],
      });
      setSelectedBooks([]);
      setShowReturnQr(false);
      setReturnQrMessage("");
      setActiveMenu("qr");
    } catch (error) {
      console.error("Generate QR error:", error);
      setPageError(error.message || "Unable to generate the borrowing request.");
    } finally {
      setIsGenerating(false);
    }
  };

  const navigateTo = (menu) => {
    setActiveMenu(menu);
    setPageError("");
    setSearchTerm("");
    if (menu === "books") setSelectedCategory("all");
    if (menu === "categories") setSelectedCategory("all");
  };

  const renderBookGrid = (items) => {
    if (isLoading) {
      return <div className="student-catalog-message">Loading books...</div>;
    }
    if (items.length === 0) {
      return (
        <div className="student-empty-state student-catalog-empty">
          <i className="bi bi-search"></i>
          <h3>No books found</h3>
          <p>Try another search term or choose a different category.</p>
          <button
            type="button"
            className="go-books-button"
            onClick={() => {
              setSearchTerm("");
              setSelectedCategory("all");
              setActiveMenu("books");
            }}
          >
            Show All Books
          </button>
        </div>
      );
    }

    return (
      <div className="student-books-grid">
        {items.map((book) => {
          const selected = selectedBooks.some((item) => item.id === book.id);
          return (
            <article className="student-book-card" key={book.id}>
              <button
                type="button"
                className="student-book-preview-button"
                onClick={() => setPreviewBook(book)}
                aria-label={`Preview ${book.title}`}
              >
                <BookCover
                  key={`card-${book.id}-${storedCoverKey(book, googleBookCovers[book.id], openLibraryBookCovers[book.id])}`}
                  book={book}
                  googleCover={googleBookCovers[book.id]}
                  openLibraryCover={openLibraryBookCovers[book.id]}
                  variant="card"
                />
                <div className="student-book-info">
                  <span className="student-book-category-tag">{book.category}</span>
                  <h3>{book.title}</h3>
                  <p className="book-author">{book.author}</p>
                  {book.yearPublished ? (
                    <p className="student-book-year">Published {book.yearPublished}</p>
                  ) : null}
                </div>
              </button>

              <div className="student-book-card-footer">
                <span className={`book-status ${book.available ? "available" : "unavailable"}`}>
                  {book.available ? `Available (${book.availableQuantity})` : "Unavailable"}
                </span>
                <button
                  type="button"
                  className="select-book-button"
                  disabled={!book.available || selected}
                  onClick={() => addBook(book)}
                >
                  {selected ? "Selected" : book.available ? "Select Book" : "Unavailable"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  const renderOnlineBookGrid = () => {
    if (isOnlineLoading) {
      return <div className="student-catalog-message"><i className="bi bi-cloud-download"></i> Loading books from Google Books…</div>;
    }
    if (visibleOnlineBooks.length === 0) {
      return (
        <div className="student-catalog-message student-online-empty">
          <i className="bi bi-globe2"></i>
          {onlineBooksError ? onlineBooksError : searchTerm ? "No online books match this search." : "No extra online titles to show right now."}
        </div>
      );
    }

    return (
      <div className="student-books-grid student-online-books-grid">
        {visibleOnlineBooks.map((book) => (
          <article className="student-book-card student-online-book-card" key={book.id}>
            <button
              type="button"
              className="student-book-preview-button"
              onClick={() => setPreviewBook(book)}
              aria-label={`Preview online book ${book.title}`}
            >
              <BookCover
                key={`online-card-${book.id}`}
                book={book}
                googleCover={book.cover_image_url}
                openLibraryCover=""
                variant="card"
              />
              <div className="student-book-info">
                <span className="student-book-category-tag">{book.category}</span>
                <h3>{book.title}</h3>
                <p className="book-author">{book.author}</p>
                {book.yearPublished ? <p className="student-book-year">Published {book.yearPublished}</p> : null}
              </div>
            </button>
            <div className="student-book-card-footer student-online-book-footer">
              <span className="student-online-source"><i className="bi bi-globe2"></i> Online catalog</span>
              <button type="button" className="student-online-preview-button" onClick={() => setPreviewBook(book)}>
                View Details
              </button>
            </div>
          </article>
        ))}
      </div>
    );
  };

  const firstName = String(user?.name || "Student").trim().split(/\s+/)[0] || "Student";

  return (
    <div className="student-dashboard">
      <aside className="student-sidebar">
        <div className="student-brand">
          <div className="student-brand-mark">
            <i className="bi bi-book-half"></i>
          </div>
          <div className="student-brand-copy">
            <span className="student-brand-name">LibSync</span>
            <span className="student-brand-caption">Library Management System</span>
          </div>
        </div>

        <div className="student-sidebar-label">WORKSPACE</div>
        <nav className="student-navigation" aria-label="Student navigation">
          <button type="button" className={`student-menu ${activeMenu === "books" ? "active" : ""}`} onClick={() => navigateTo("books")}>
            <i className="bi bi-book"></i><span>Books</span>
          </button>
          <button type="button" className={`student-menu ${activeMenu === "categories" ? "active" : ""}`} onClick={() => navigateTo("categories")}>
            <i className="bi bi-grid"></i><span>Categories</span>
          </button>
          <button type="button" className={`student-menu ${activeMenu === "selected" ? "active" : ""}`} onClick={() => navigateTo("selected")}>
            <i className="bi bi-cart3"></i><span>Selected Books</span>
            {selectedBooks.length > 0 && <span className="menu-count">{selectedBooks.length}</span>}
          </button>
          <button type="button" className={`student-menu ${activeMenu === "qr" ? "active" : ""}`} onClick={() => navigateTo("qr")}>
            <i className="bi bi-qr-code"></i><span>QR Code</span>
          </button>
        </nav>

        <div className="student-sidebar-leaves" aria-hidden="true">
          <span className="student-sidebar-leaf student-sidebar-leaf--one"></span>
          <span className="student-sidebar-leaf student-sidebar-leaf--two"></span>
          <span className="student-sidebar-leaf student-sidebar-leaf--three"></span>
          <span className="student-sidebar-leaf student-sidebar-leaf--four"></span>
        </div>

        <div className="student-sidebar-bottom">
          <div className="student-sidebar-student">
            <div className="student-sidebar-avatar"><i className="bi bi-person-fill"></i></div>
            <div className="student-sidebar-user-copy">
              <strong>{user?.name || "Student"}</strong>
              <span>Student account</span>
            </div>
          </div>
          <button type="button" className="student-logout" onClick={onLogout}>
            <i className="bi bi-box-arrow-right"></i><span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="student-workspace">
        {(activeMenu === "books" || activeMenu === "categories") && (
          <div className="student-topbar">
            <label className="student-global-search">
              <i className="bi bi-search"></i>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search books by title, author, or category"
                aria-label="Search books by title, author, or category"
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm("")} aria-label="Clear search">
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </label>
          </div>
        )}

        <header className="student-header">
          <div className="student-header-copy">
            <span className="student-header-label">YOUR LIBRARY SPACE</span>
            <h1>{activeMenu === "books" ? `Hello ${firstName}, what will you read today?` : activeMenu === "categories" ? "Explore book categories" : activeMenu === "selected" ? "Your selected books" : "Your borrowing QR code"}</h1>
            <p>{activeMenu === "books" ? "Discover your next favorite book from the library catalogue." : activeMenu === "categories" ? "Browse the collection by subject or genre." : activeMenu === "selected" ? "Review your book choices before submitting a request." : "Show this QR code to the librarian when it is ready."}</p>
          </div>
        </header>

        <main className="student-main">
          {pageError && <div className="form-error" role="alert">{pageError}</div>}

          {activeMenu === "books" && (
            <section className="student-home-grid">
              <div className="student-home-primary">
                <div className="student-stats">
                  <article className="student-stat-card">
                    <div className="student-stat-icon catalog"><i className="bi bi-collection"></i></div>
                    <div className="student-stat-copy"><span>Books in catalogue</span><strong>{books.length}</strong></div>
                  </article>
                  <article className="student-stat-card">
                    <div className="student-stat-icon available"><i className="bi bi-bookmark-check"></i></div>
                    <div className="student-stat-copy"><span>Available titles</span><strong>{books.filter((book) => book.available).length}</strong></div>
                  </article>
                  <article className="student-stat-card">
                    <div className="student-stat-icon selected"><i className="bi bi-bag-check"></i></div>
                    <div className="student-stat-copy"><span>Selected books</span><strong>{selectedBooks.length}</strong></div>
                  </article>
                </div>

                <div className="student-catalog-heading-row">
                  <div className="student-section-heading">
                    <h2>All Books</h2>
                    <p>Click a book to preview its details.</p>
                  </div>
                  <label className="student-sort-control">
                    <i className="bi bi-sort-alpha-down"></i>
                    <span>Sort</span>
                    <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} aria-label="Sort books">
                      <option value="az">Title: A–Z</option>
                      <option value="za">Title: Z–A</option>
                    </select>
                  </label>
                </div>
                {renderBookGrid(visibleBooks)}

                <section className="student-online-catalog-section">
                  <div className="student-catalog-heading-row student-online-heading-row">
                    <div className="student-section-heading">
                      <span className="student-header-label">ONLINE CATALOG</span>
                      <h2>Explore More Books</h2>
                      <p>Automatically loaded from Google Books. These titles are for discovery and are not yet in the LibSync borrowing inventory.</p>
                    </div>
                    <span className="student-online-count"><i className="bi bi-cloud-check"></i> {isOnlineLoading ? "Loading…" : `${visibleOnlineBooks.length} titles`}</span>
                  </div>
                  {renderOnlineBookGrid()}
                </section>
              </div>

              <aside className="student-home-aside" aria-label="Library recommendations and activity">
                <section className="student-side-panel">
                  <div className="student-side-panel-heading">
                    <div>
                      <h3>Library Highlights</h3>
                      <p>Recently added library books</p>
                    </div>
                    <button type="button" onClick={() => navigateTo("categories")} aria-label="Browse book categories">
                      <i className="bi bi-arrow-up-right"></i>
                    </button>
                  </div>

                  {featuredBooks.length === 0 ? (
                    <div className="student-side-empty">Books added by your librarian will appear here.</div>
                  ) : (
                    <div className="student-featured-list">
                      {featuredBooks.map((book) => (
                        <button type="button" className="student-featured-book" key={book.id} onClick={() => setPreviewBook(book)}>
                          <BookCover
                            key={`side-${book.id}-${storedCoverKey(book, googleBookCovers[book.id], openLibraryBookCovers[book.id])}`}
                            book={book}
                            googleCover={googleBookCovers[book.id]}
                            openLibraryCover={openLibraryBookCovers[book.id]}
                            variant="thumb"
                          />
                          <span className="student-featured-copy">
                            <strong>{book.title}</strong>
                            <small>{book.author}</small>
                            <em className={book.available ? "is-available" : "is-unavailable"}>
                              {book.available ? `Available (${book.availableQuantity})` : "Unavailable"}
                            </em>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="student-side-panel">
                  <div className="student-side-panel-heading">
                    <div>
                      <h3>Recent Borrowing Requests</h3>
                      <p>Your latest request activity</p>
                    </div>
                    <span className="student-side-panel-icon"><i className="bi bi-clock-history"></i></span>
                  </div>

                  {isHistoryLoading ? (
                    <div className="student-side-empty">Loading your activity…</div>
                  ) : recentStudentRequests.length === 0 ? (
                    <div className="student-side-empty">
                      <i className="bi bi-journal-check"></i>
                      <strong>No requests yet</strong>
                      <span>Your borrowing requests will appear here.</span>
                    </div>
                  ) : (
                    <div className="student-request-list">
                      {recentStudentRequests.map((request) => (
                        <div className="student-request-row" key={request.id}>
                          <div className="student-request-copy">
                            <strong>{request.book_title || `Book #${request.book_id}`}</strong>
                            <span>{formatActivityDate(request.requested_at)}</span>
                          </div>
                          <span className={`student-request-status status-${String(request.status || "pending").toLowerCase().replace(/[^a-z]/g, "")}`}>
                            {String(request.status || "pending").replace(/_/g, " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </aside>
            </section>
          )}

          {activeMenu === "categories" && (
            <section>
              <div className="student-section-heading">
                <h2>Browse Categories</h2>
                <p>Select a category to narrow down the catalogue.</p>
              </div>
              <div className="student-category-grid">
                <button type="button" className={`student-category-card ${selectedCategory === "all" ? "active" : ""}`} onClick={() => setSelectedCategory("all")}>
                  <span className="student-category-icon"><i className="bi bi-grid"></i></span>
                  <span className="student-category-copy"><strong>All Categories</strong><small>{books.length} titles</small></span>
                  <i className="bi bi-arrow-up-right student-category-arrow"></i>
                </button>
                {categories.map((category, index) => {
                  const count = books.filter((book) => book.category === category).length;
                  return (
                    <button type="button" key={category} className={`student-category-card ${selectedCategory === category ? "active" : ""}`} onClick={() => setSelectedCategory(category)}>
                      <span className={`student-category-icon tone-${index % 5}`}><i className="bi bi-bookmark"></i></span>
                      <span className="student-category-copy"><strong>{category}</strong><small>{count} {count === 1 ? "title" : "titles"}</small></span>
                      <i className="bi bi-arrow-up-right student-category-arrow"></i>
                    </button>
                  );
                })}
              </div>

              <div className="student-catalog-heading-row student-category-results-heading">
                <div className="student-section-heading">
                  <h2>{selectedCategory === "all" ? "All Books" : selectedCategory}</h2>
                  <p>{visibleBooks.length} matching {visibleBooks.length === 1 ? "title" : "titles"}</p>
                </div>
                <label className="student-sort-control">
                  <i className="bi bi-sort-alpha-down"></i>
                  <span>Sort</span>
                  <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} aria-label="Sort books">
                    <option value="az">Title: A–Z</option>
                    <option value="za">Title: Z–A</option>
                  </select>
                </label>
              </div>
              {renderBookGrid(visibleBooks)}
            </section>
          )}

          {activeMenu === "selected" && (
            <section>
              <div className="student-section-heading">
                <h2>Selected Books</h2>
                <p>Review your selected books before submitting.</p>
              </div>
              {selectedBooks.length === 0 ? (
                <div className="student-empty-state">
                  <i className="bi bi-cart-x"></i>
                  <h3>No books selected</h3>
                  <p>Go to Books and select a book first.</p>
                  <button type="button" className="go-books-button" onClick={() => navigateTo("books")}>Browse Books</button>
                </div>
              ) : (
                <>
                  <div className="selected-books-list">
                    {selectedBooks.map((book) => (
                      <div className="selected-book-row" key={book.id}>
                        <BookCover
                          key={`thumb-${book.id}-${storedCoverKey(book, googleBookCovers[book.id], openLibraryBookCovers[book.id])}`}
                          book={book}
                          googleCover={googleBookCovers[book.id]}
                          openLibraryCover={openLibraryBookCovers[book.id]}
                          variant="thumb"
                        />
                        <div className="selected-book-details"><h3>{book.title}</h3><p>{book.author}</p><span>{book.category}</span></div>
                        <button type="button" className="remove-book-button" onClick={() => removeBook(book.id)}><i className="bi bi-trash"></i> Remove</button>
                      </div>
                    ))}
                  </div>

                  <div className="student-loan-duration-control">
                    <div className="student-loan-duration-copy">
                      <i className="bi bi-calendar-check"></i>
                      <div>
                        <label htmlFor="student-loan-days">Choose return period</label>
                        <p>Choose between 1 and 5 days. The due date starts when the librarian approves your borrowing request.</p>
                      </div>
                    </div>
                    <select
                      id="student-loan-days"
                      value={loanDays}
                      onChange={(event) => setLoanDays(Number(event.target.value))}
                      aria-label="Choose a return period from one to five days"
                    >
                      <option value={1}>1 day after approval</option>
                      <option value={2}>2 days after approval</option>
                      <option value={3}>3 days after approval</option>
                      <option value={4}>4 days after approval</option>
                      <option value={5}>5 days after approval</option>
                    </select>
                  </div>

                  <button type="button" className="generate-qr-button" disabled={isGenerating} onClick={handleGenerateQR}>
                    <i className="bi bi-qr-code"></i>{isGenerating ? "Submitting Request..." : "Submit Request & Generate QR"}
                  </button>
                </>
              )}
            </section>
          )}

          {activeMenu === "qr" && (
            <section>
              <div className="student-section-heading">
                <h2>Borrowing &amp; Return QR</h2>
                <p>Your borrowing QR and separate return QR are shown here.</p>
              </div>

              {batchStatusError && <div className="form-error" role="alert">{batchStatusError}</div>}

              {!activeQrBatch ? (
                <div className="student-empty-state">
                  <i className="bi bi-qr-code"></i>
                  <h3>No borrowing QR yet</h3>
                  <p>Select books, choose a return period of up to 5 days, and submit your borrowing request.</p>
                  <button type="button" className="go-books-button" onClick={() => navigateTo("books")}>Browse Books</button>
                  <button type="button" className="qr-refresh-button" disabled={isBatchesLoading} onClick={() => setBatchRefreshVersion((value) => value + 1)}>
                    <i className="bi bi-arrow-clockwise"></i> {isBatchesLoading ? "Refreshing..." : "Refresh borrowing status"}
                  </button>
                </div>
              ) : (
                <div className="qr-dual-grid">
                  <article className="qr-card qr-card--borrow">
                    <div className="qr-card-banner">
                      <div className="qr-card-banner-icon"><i className="bi bi-book-half"></i></div>
                      <h2>Borrowing QR</h2>
                      <p>Present this QR to the librarian for checkout.</p>
                    </div>

                    <p className="qr-student-name">Student: <strong>{user?.name || "Student"}</strong></p>
                    {activeQrBatch.batchId && <p className="qr-batch-id">Batch ID: {activeQrBatch.batchId}</p>}
                    <span className={`qr-status-pill qr-status-pill--${activeQrBatch.status || "pending"}`}>
                      {activeQrBatch.status === "approved" ? "Approved" : activeQrBatch.status === "partially_returned" ? "Partially returned" : activeQrBatch.status === "returned" ? "Returned" : activeQrBatch.status === "declined" ? "Declined" : "Pending librarian approval"}
                    </span>

                    {activeQrBatch.qrPayload ? (
                      <div className="qr-real-container">
                        <QRCodeCanvas value={activeQrBatch.qrPayload} size={220} level="H" includeMargin />
                      </div>
                    ) : (
                      <div className="qr-placeholder"><i className="bi bi-qr-code"></i><span>Borrowing QR not available</span></div>
                    )}

                    <div className="qr-details-panel qr-details-panel--borrow">
                      <div className="qr-details-heading">
                        <span className="qr-details-heading-icon"><i className="bi bi-calendar2-check"></i></span>
                        <strong>Borrowing Details</strong>
                      </div>
                      <div className="qr-details-row">
                        <i className="bi bi-calendar3"></i>
                        <div><span>Borrowed on</span><strong>{activeQrBatch.approvedAt ? formatDueDate(activeQrBatch.approvedAt) : "Not checked out yet"}</strong></div>
                      </div>
                      <div className="qr-details-row">
                        <i className="bi bi-hourglass-split"></i>
                        <div><span>Return period</span><strong>{activeQrBatch.loanDays} {activeQrBatch.loanDays === 1 ? "day" : "days"} (chosen by you)</strong></div>
                      </div>
                      <div className="qr-details-row">
                        <i className="bi bi-calendar-check"></i>
                        <div><span>Expected due date</span><strong>{activeQrBatch.dueDate ? formatDueDate(activeQrBatch.dueDate) : "Set after librarian approval"}</strong></div>
                      </div>
                      {!activeQrBatch.approvedAt && activeQrBatch.status !== "returned" && (
                        <div className="qr-info-note"><i className="bi bi-info-circle"></i><span>The return period starts when the librarian approves/checks out the request.</span></div>
                      )}
                    </div>

                    <div className="qr-book-summary">
                      <h3>Books in this request</h3>
                      {activeQrBatch.books.map((book) => (
                        <div className="qr-book-item" key={book.request_id || book.id}>
                          <i className={`bi ${book.status === "returned" ? "bi-check-circle-fill" : book.status === "declined" ? "bi-x-circle" : "bi-book"}`}></i>
                          <span>{book.title}{book.status === "returned" ? " · Returned" : book.status === "declined" ? " · Declined" : ""}</span>
                        </div>
                      ))}
                    </div>
                    <p className="qr-total-books">Total books: {activeQrBatch.books.length}</p>
                  </article>

                  <article className="qr-card qr-card--return">
                    <div className="qr-card-banner">
                      <div className="qr-card-banner-icon"><i className="bi bi-arrow-return-left"></i></div>
                      <h2>Return QR</h2>
                      <p>Present this separate QR to the librarian when returning books.</p>
                    </div>

                    <p className="qr-student-name">Student: <strong>{user?.name || "Student"}</strong></p>
                    {activeQrBatch.batchId && <p className="qr-batch-id">Batch ID: {activeQrBatch.batchId}</p>}
                    <span className={`qr-status-pill qr-status-pill--${activeQrBatch.status || "pending"}`}>
                      {activeQrBatch.status === "returned" ? "All books returned" : activeQrBatch.status === "partially_returned" ? "Books still to return" : activeQrBatch.status === "approved" ? "Ready to return" : activeQrBatch.status === "declined" ? "Not available" : "Available after approval"}
                    </span>

                    {showReturnQr && activeQrBatch.returnQrPayload && ["approved", "partially_returned"].includes(activeQrBatch.status) ? (
                      <>
                        <div className="qr-real-container qr-real-container--return">
                          <QRCodeCanvas value={activeQrBatch.returnQrPayload} size={220} level="H" includeMargin />
                        </div>
                        <p className="qr-return-ready-note">
                          <i className="bi bi-check-circle-fill" aria-hidden="true"></i>
                          This is your separate Return QR. Show it to the librarian when returning your book(s).
                        </p>
                        <button
                          type="button"
                          className="qr-generate-return-button qr-generate-return-button--secondary"
                          onClick={() => setShowReturnQr(false)}
                        >
                          <i className="bi bi-eye-slash" aria-hidden="true"></i> Hide Return QR
                        </button>
                      </>
                    ) : activeQrBatch.status === "returned" ? (
                      <div className="qr-return-unavailable">
                        <i className="bi bi-check-circle-fill" aria-hidden="true"></i>
                        <strong>Return completed</strong>
                        <span>All approved books in this batch have been returned.</span>
                      </div>
                    ) : activeQrBatch.status === "declined" ? (
                      <div className="qr-return-unavailable">
                        <i className="bi bi-x-circle" aria-hidden="true"></i>
                        <strong>Return QR unavailable</strong>
                        <span>This borrowing request was declined.</span>
                      </div>
                    ) : (
                      <div className="qr-return-cta">
                        <div className="qr-return-cta-icon">
                          <i className="bi bi-qr-code" aria-hidden="true"></i>
                        </div>
                        <strong>{activeQrBatch.returnQrPayload ? "Ready to return your books?" : "Generate your Return QR"}</strong>
                        <span>
                          {activeQrBatch.returnQrPayload
                            ? "Press the button when you're ready. Your Return QR will appear here and will be different from your Borrowing QR."
                            : "A separate Return QR will appear when the backend has issued a return token for this checked-out batch."}
                        </span>
                        <button
                          type="button"
                          className="qr-generate-return-button"
                          disabled={!(["approved", "partially_returned"].includes(activeQrBatch.status))}
                          onClick={() => {
                            if (!activeQrBatch.returnQrPayload) {
                              setReturnQrMessage("Return QR is not available from the backend yet. Refresh borrowing status after the librarian checks out your books.");
                              setBatchRefreshVersion((value) => value + 1);
                              return;
                            }
                            setReturnQrMessage("");
                            setShowReturnQr(true);
                          }}
                        >
                          <i className="bi bi-qr-code-scan" aria-hidden="true"></i>
                          Generate Return QR
                        </button>
                        {returnQrMessage && (
                          <p className="qr-return-action-message" role="status">{returnQrMessage}</p>
                        )}
                      </div>
                    )}

                    <div className="qr-return-date-panel">
                      <div className="qr-return-date-header">
                        <span className="qr-return-date-icon"><i className="bi bi-calendar3"></i></span>
                        <div><span>RETURN BY</span><strong>{activeQrBatch.dueDate ? formatDueDate(activeQrBatch.dueDate) : "Date pending"}</strong></div>
                      </div>
                      <div className="qr-return-date-footer">
                        <div className="qr-return-borrowed-date"><i className="bi bi-calendar-check"></i><span>Borrowed on<br /><strong>{activeQrBatch.approvedAt ? formatDueDate(activeQrBatch.approvedAt) : "Not checked out yet"}</strong></span></div>
                        {activeQrBatch.dueDate && ["approved", "partially_returned"].includes(activeQrBatch.status) && (
                          <span className={`qr-days-remaining ${getDaysRemaining(activeQrBatch.dueDate) < 0 ? "is-overdue" : ""}`}>
                            <i className="bi bi-clock"></i>
                            {getDaysRemaining(activeQrBatch.dueDate) < 0
                              ? `${Math.abs(getDaysRemaining(activeQrBatch.dueDate))} day(s) overdue`
                              : getDaysRemaining(activeQrBatch.dueDate) === 0
                              ? "Due today"
                              : `${getDaysRemaining(activeQrBatch.dueDate)} day(s) remaining`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="qr-book-summary">
                      <h3>Books to return</h3>
                      {activeQrBatch.books.filter((book) => book.status !== "declined").map((book) => (
                        <div className="qr-book-item" key={book.request_id || book.id}>
                          <i className={`bi ${book.status === "returned" ? "bi-check-circle-fill" : "bi-book"}`}></i>
                          <span>{book.title}{book.status === "returned" ? " · Returned" : ""}</span>
                        </div>
                      ))}
                    </div>
                    <p className="qr-total-books">Total books: {activeQrBatch.books.filter((book) => book.status !== "declined").length}</p>
                    <button type="button" className="qr-refresh-button" disabled={isBatchesLoading} onClick={() => setBatchRefreshVersion((value) => value + 1)}>
                      <i className="bi bi-arrow-clockwise"></i> {isBatchesLoading ? "Refreshing status..." : "Refresh status"}
                    </button>
                  </article>
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {previewBook && (
        <div className="student-preview-backdrop" onClick={() => setPreviewBook(null)}>
          <section className="student-preview-modal" role="dialog" aria-modal="true" aria-labelledby="student-preview-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="student-preview-close" onClick={() => setPreviewBook(null)} aria-label="Close book preview"><i className="bi bi-x-lg"></i></button>
            <div className="student-preview-content">
              <div className="student-preview-art"><BookCover
                    key={`preview-${previewBook.id}-${storedCoverKey(previewBook, googleBookCovers[previewBook.id], openLibraryBookCovers[previewBook.id])}`}
                    book={previewBook}
                    googleCover={googleBookCovers[previewBook.id]}
                    openLibraryCover={openLibraryBookCovers[previewBook.id]}
                    variant="preview"
                  /></div>
              <div className="student-preview-details">
                <span className="student-book-category-tag">{previewBook.isOnline ? "Online Catalog" : previewBook.category}</span>
                <h2 id="student-preview-title">{previewBook.title}</h2>
                <p className="student-preview-author">by {previewBook.author}</p>
                {previewBook.isOnline ? (
                  <div className="student-online-notice">
                    <i className="bi bi-info-circle"></i>
                    This title is listed online but is not yet part of the LibSync library inventory, so it cannot be borrowed here.
                  </div>
                ) : (
                  <span className={`book-status ${previewBook.available ? "available" : "unavailable"}`}>
                    {previewBook.available ? `Available (${previewBook.availableQuantity} ${previewBook.availableQuantity === 1 ? "copy" : "copies"})` : "Currently unavailable"}
                  </span>
                )}
                <div className="student-preview-metadata">
                  {previewBook.isbn && <div><span>ISBN</span><strong>{previewBook.isbn}</strong></div>}
                  {previewBook.publisher && <div><span>Publisher</span><strong>{previewBook.publisher}</strong></div>}
                  {previewBook.yearPublished && <div><span>Year published</span><strong>{previewBook.yearPublished}</strong></div>}
                  {previewBook.isOnline ? <div><span>Source</span><strong>Google Books</strong></div> : <div><span>Book ID</span><strong>{previewBook.id}</strong></div>}
                </div>
                {previewBook.isOnline && previewBook.description ? (
                  <div className="student-preview-description">
                    <strong>About this book</strong>
                    <p>{previewBook.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}</p>
                  </div>
                ) : null}
                <p className="student-preview-help">
                  {previewBook.isOnline ? "You can view the online listing. To borrow this title, ask the librarian whether the library can add it to inventory." : "Review the book details before adding it to your borrowing request."}
                </p>
                <div className="student-preview-actions">
                  <button type="button" className="student-preview-secondary" onClick={() => setPreviewBook(null)}>Close Preview</button>
                  {previewBook.isOnline ? (
                    previewBook.previewLink ? (
                      <a className="select-book-button student-preview-select student-preview-online-link" href={previewBook.previewLink} target="_blank" rel="noreferrer">
                        <i className="bi bi-box-arrow-up-right"></i> View Online Book
                      </a>
                    ) : null
                  ) : (
                    <button
                      type="button"
                      className="select-book-button student-preview-select"
                      disabled={!previewBook.available || selectedBooks.some((item) => item.id === previewBook.id)}
                      onClick={() => {
                        addBook(previewBook);
                        setPreviewBook(null);
                      }}
                    >
                      {selectedBooks.some((item) => item.id === previewBook.id) ? "Already Selected" : previewBook.available ? "Select Book" : "Unavailable"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default StudentDashboard;
