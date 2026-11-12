import { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { apiRequest, getStoredUser } from "../services/api";
import "./student_dashboard.css";

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

function mapApiBook(book) {
  const availableQuantity = Number(book.available_quantity ?? 0);
  return {
    id: Number(book.id),
    title: book.title || "Untitled Book",
    author: book.author || "Unknown Author",
    category: book.category || "Uncategorized",
    isbn: book.isbn || "",
    publisher: book.publisher || "",
    yearPublished: book.year_published || book.yearPublished || "",
    description: book.description || book.book_description || book.summary || "",
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

function cleanBookDescription(value) {
  return String(value || "")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<\/p\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function getPreviewBookKey(book) {
  if (!book) return "";
  return JSON.stringify([
    book.id ?? "",
    book.isbn ?? "",
    book.title ?? "",
    book.author ?? "",
  ]);
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

async function findGoogleBookDescription(book, signal) {
  if (!book?.title) return "";

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
  const items = Array.isArray(data.items) ? data.items : [];
  const normalizedTitle = normalizeBookText(book.title);
  const normalizedAuthor = normalizeBookText(book.author);
  const hasSpecificAuthor = Boolean(normalizedAuthor) &&
    !/unknown author|n a|none/.test(normalizedAuthor);

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

  // Never display a description from an unrelated search result.
  for (const item of [exactIsbnMatch, titleMatch].filter(Boolean)) {
    const description = cleanBookDescription(item.volumeInfo?.description);
    if (description) return description;
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
  const user = getStoredUser();
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
  const [requestSuccess, setRequestSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("az");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [previewBook, setPreviewBook] = useState(null);
  const [previewDescriptionResult, setPreviewDescriptionResult] = useState(null);
  const [googleBookCovers, setGoogleBookCovers] = useState({});
  const [openLibraryBookCovers, setOpenLibraryBookCovers] = useState({});
  const [studentRequests, setStudentRequests] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  // Each active borrowing batch has an independent Return QR visibility state.
  const [qrListTab, setQrListTab] = useState("all");
  const [expandedQrBatch, setExpandedQrBatch] = useState(null);
  const [studentBatches, setStudentBatches] = useState([]);
  const [isBatchesLoading, setIsBatchesLoading] = useState(false);
  const [batchStatusError, setBatchStatusError] = useState("");
  const [batchRefreshVersion, setBatchRefreshVersion] = useState(0);
  const [inventoryRefreshVersion, setInventoryRefreshVersion] = useState(0);
  const [borrowingRisk, setBorrowingRisk] = useState(null);
  const [isRiskLoading, setIsRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState("");

  // Load the authenticated student's personal borrowing risk score.
  // This endpoint uses the same rule-based scoring model as the Admin dashboard.
  useEffect(() => {
    if (!userId) return undefined;

    const controller = new AbortController();

    const loadBorrowingRisk = async () => {
      setIsRiskLoading(true);
      setRiskError("");

      try {
        const data = await apiRequest("/api/student/borrowing-risk", {
          method: "GET",
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          if (data?.status !== "success" || !data.risk) {
            throw new Error(data?.message || "Unable to load your borrowing risk score.");
          }
          setBorrowingRisk(data.risk);
        }
      } catch (error) {
        if (error.name !== "AbortError" && !controller.signal.aborted) {
          console.error("Load student borrowing risk error:", error);
          setRiskError(error.message || "Unable to load your borrowing risk score.");
        }
      } finally {
        if (!controller.signal.aborted) setIsRiskLoading(false);
      }
    };

    loadBorrowingRisk();
    return () => controller.abort();
  }, [userId, batchRefreshVersion]);

  // Load the real book catalogue from the existing backend.
  useEffect(() => {
    const controller = new AbortController();

    const loadBooks = async () => {
      setIsLoading(true);
      setPageError("");

      try {
        const data = await apiRequest("/api/books", {
          method: "GET",
          signal: controller.signal,
        });
        if (!Array.isArray(data)) {
          throw new Error("The books API returned an unexpected response.");
        }

        setBooks(data.map(mapApiBook));
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

  // Re-fetch the catalogue after the student checks QR status or returns to the
  // catalogue from the QR page. This makes available_quantity reflect confirmed
  // returns processed by the librarian without requiring a full page reload.
  useEffect(() => {
    if (inventoryRefreshVersion === 0) return undefined;

    const controller = new AbortController();

    const refreshBookInventory = async () => {
      setIsLoading(true);
      try {
        const data = await apiRequest("/api/books", {
          method: "GET",
          signal: controller.signal,
        });
        if (!Array.isArray(data)) {
          throw new Error("The books API returned an unexpected response.");
        }

        if (!controller.signal.aborted) {
          setBooks(data.map(mapApiBook));
        }
      } catch (error) {
        if (error.name !== "AbortError" && !controller.signal.aborted) {
          console.error("Refresh book availability error:", error);
          setPageError(error.message || "Unable to refresh book availability.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    refreshBookInventory();
    return () => controller.abort();
  }, [inventoryRefreshVersion]);

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
    const booksNeedingLookup = books.filter(
      (book) =>
        !getStoredCover(book) &&
        !googleBookCovers[book.id] &&
        !openLibraryBookCovers[book.id] &&
        book.title
    );

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
  }, [books, googleBookCovers, openLibraryBookCovers]);

  // Load a matching Google Books description only when the selected book
  // does not already contain a saved description. The effect does not update
  // React state synchronously; the result is stored after the async lookup.
  useEffect(() => {
    if (!previewBook || cleanBookDescription(previewBook.description)) {
      return undefined;
    }

    const controller = new AbortController();
    const bookKey = getPreviewBookKey(previewBook);

    const loadPreviewDescription = async () => {
      let description = "";

      try {
        description = await findGoogleBookDescription(previewBook, controller.signal);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.warn("Load book description error:", error);
        }
      }

      if (!controller.signal.aborted) {
        setPreviewDescriptionResult({ bookKey, description });
      }
    };

    loadPreviewDescription();
    return () => controller.abort();
  }, [previewBook]);

  // Load only the signed-in student's own borrowing requests for the dashboard activity panel.
  useEffect(() => {
    // State starts as an empty list and not loading, so no synchronous
    // state updates are needed when there is no signed-in student ID.
    if (!userId) return undefined;

    const controller = new AbortController();
    const loadStudentRequests = async () => {
      setIsHistoryLoading(true);
      try {
        const data = await apiRequest(
          `/api/student/borrow-requests/${encodeURIComponent(userId)}`,
          {
            method: "GET",
            signal: controller.signal,
          }
        );
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

  // Refresh individual request decisions whenever the student opens the QR page
  // or manually refreshes borrowing status. This keeps declined notices current
  // even when the dashboard component stayed mounted while the librarian decided.
  useEffect(() => {
    if (activeMenu !== "qr" || !userId) return undefined;

    const controller = new AbortController();

    const refreshStudentRequests = async () => {
      try {
        const data = await apiRequest(
          `/api/student/borrow-requests/${encodeURIComponent(userId)}`,
          {
            method: "GET",
            signal: controller.signal,
          }
        );

        if (!controller.signal.aborted) {
          setStudentRequests(Array.isArray(data.requests) ? data.requests : []);
        }
      } catch (error) {
        if (error.name !== "AbortError" && !controller.signal.aborted) {
          console.warn("Refresh student borrowing decisions error:", error);
        }
      }
    };

    refreshStudentRequests();
    return () => controller.abort();
  }, [activeMenu, userId, batchRefreshVersion]);

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
        const data = await apiRequest(
          `/api/student/borrow-batches/${encodeURIComponent(userId)}`,
          {
            method: "GET",
            headers: {
              "X-User-ID": String(userId),
            },
            signal: controller.signal,
          }
        );
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
        const titleA = String(a.title || "").trim();
        const titleB = String(b.title || "").trim();
        const comparison = titleA.localeCompare(titleB, undefined, {
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

  const parseApiDateTime = (value) => {
    if (!value) return null;

    const raw = String(value).trim();
    const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      return new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3])
      );
    }

    // API values for batch release/deadline timestamps include a trailing Z
    // because the backend stores them in UTC. Date parses those as UTC.
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatDueDate = (value) => {
    if (!value) return "Not set yet";
    const parsed = parseApiDateTime(value);
    if (!parsed) return String(value);
    return parsed.toLocaleString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getReturnCountdown = (borrowedAt, dueDate) => {
    if (!borrowedAt) {
      return { label: "Starts after librarian release", isOverdue: false };
    }

    const due = parseApiDateTime(dueDate);
    if (!due) {
      return { label: "Return deadline is being prepared", isOverdue: false };
    }

    const differenceMs = due.getTime() - countdownNow;
    const isOverdue = differenceMs <= 0;
    const totalSeconds = Math.floor(Math.abs(differenceMs) / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const clock = [hours, minutes, seconds]
      .map((part) => String(part).padStart(2, "0"))
      .join(":");
    const duration = days > 0 ? `${days}d ${clock}` : clock;

    return {
      label: isOverdue ? `Overdue by ${duration}` : `${duration} remaining`,
      isOverdue,
    };
  };

  const qrBatches = useMemo(() => {
    const normalizeBooks = (batchBooks, fallbackBooks = []) => {
      const source =
        Array.isArray(batchBooks) && batchBooks.length
          ? batchBooks
          : fallbackBooks;

      return (source || []).map((book) => ({
        ...book,
        id: book.id ?? book.book_id,
        title: book.title || book.book_title || "Untitled Book",
      }));
    };

    const normalizedBatches = studentBatches.map((batch) => ({
      batchId: batch.id,
      borrowQrPayload: batch.borrow_qr_token || null,
      returnQrPayload: batch.return_qr_token || null,
      borrowQrUsedAt: batch.borrow_qr_used_at || null,
      returnQrUsedAt: batch.return_qr_used_at || null,
      status: String(batch.status || "pending").toLowerCase(),
      loanDays: 1,
      dueDate: batch.due_date || null,
      requestedAt: batch.requested_at || null,
      approvedAt: batch.approved_at || null,
      borrowedAt: batch.borrow_qr_used_at || null,
      books: normalizeBooks(batch.books),
    }));

    // Keep a just-submitted request visible while the first batch refresh is
    // still in flight. Replace it with the authoritative API batch when loaded.
    if (
      qrRequest?.batchId &&
      !normalizedBatches.some(
        (batch) => Number(batch.batchId) === Number(qrRequest.batchId)
      )
    ) {
      normalizedBatches.push({
        ...qrRequest,
        batchId: qrRequest.batchId,
        borrowQrPayload: qrRequest.borrowQrPayload || null,
        returnQrPayload: qrRequest.returnQrPayload || null,
        borrowQrUsedAt: qrRequest.borrowQrUsedAt || null,
        returnQrUsedAt: qrRequest.returnQrUsedAt || null,
        status: String(qrRequest.status || "pending").toLowerCase(),
        loanDays: 1,
        dueDate: qrRequest.dueDate || null,
        requestedAt: qrRequest.requestedAt || new Date().toISOString(),
        approvedAt: qrRequest.approvedAt || null,
        borrowedAt: qrRequest.borrowedAt || null,
        books: normalizeBooks(qrRequest.books),
      });
    }

    return normalizedBatches.sort((a, b) => {
      const dateA = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
      const dateB = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;
      return Number(b.batchId || 0) - Number(a.batchId || 0);
    });
  }, [qrRequest, studentBatches]);

  const pendingQrBatches = qrBatches.filter(
    (batch) => batch.status === "pending"
  );

  const activeQrBatches = qrBatches.filter((batch) => {
    const hasOutstandingBooks = (batch.books || []).some(
      (book) => !["returned", "declined"].includes(String(book.status || "").toLowerCase())
    );
    return (
      ["approved", "partially_returned"].includes(batch.status) &&
      hasOutstandingBooks
    );
  });

  const returnedQrBatches = qrBatches.filter(
    (batch) => batch.status === "returned"
  );

  const historyQrBatches = qrBatches.filter(
    (batch) => ["returned", "declined"].includes(batch.status)
  );

  const allRequestQrBatches = qrBatches.filter(
    (batch) =>
      batch.status === "pending" ||
      ["approved", "partially_returned"].includes(batch.status)
  );

  const visibleQrTab =
    pendingQrBatches.length > 0
      ? qrListTab
      : ["all", "pending"].includes(qrListTab)
      ? "active"
      : qrListTab;

  const displayedQrBatches =
    visibleQrTab === "all"
      ? allRequestQrBatches
      : visibleQrTab === "pending"
      ? pendingQrBatches
      : visibleQrTab === "active"
      ? activeQrBatches
      : visibleQrTab === "returned"
      ? returnedQrBatches
      : visibleQrTab === "history"
      ? historyQrBatches
      : activeQrBatches;

  const hasReleasedQrBatch = activeQrBatches.some(
    (batch) => Boolean(batch.borrowedAt)
  );

  // One clock updates all visible batch countdowns, each based on its own
  // librarian release timestamp and 24-hour deadline from the backend.
  useEffect(() => {
    if (activeMenu !== "qr" || !hasReleasedQrBatch) return undefined;

    const timerId = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [activeMenu, hasReleasedQrBatch]);

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

  const handleSubmitBorrowRequest = async () => {
    setPageError("");
    setRequestSuccess("");

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
      const data = await apiRequest("/api/borrow-requests", {
        method: "POST",
        body: {
          user_id: Number(user.id),
          book_ids: selectedBooks.map((book) => book.id),
        },
      });

      // Pending requests intentionally have no QR yet.
      // The Borrow QR appears only after librarian approval.
      setQrRequest({
        batchId: data.batch_id,
        requestIds: data.request_ids || [],
        status: "pending",
        borrowQrPayload: data.borrow_qr_token || null,
        returnQrPayload: data.return_qr_token || null,
        borrowQrUsedAt: null,
        returnQrUsedAt: null,
        loanDays: 1,
        dueDate: data.due_date || null,
        requestedAt: data.requested_at || null,
        approvedAt: null,
        borrowedAt: null,
        books: [...selectedBooks],
      });

      setSelectedBooks([]);
      setRequestSuccess(
        data.message ||
          "Borrow request submitted successfully. Wait for librarian approval before the Borrow QR becomes available."
      );
      setQrListTab("all");
      setActiveMenu("qr");
      setBatchRefreshVersion((value) => value + 1);
    } catch (error) {
      console.error("Submit borrow request error:", error);
      setPageError(error.message || "Unable to submit the borrowing request.");
    } finally {
      setIsGenerating(false);
    }
  };

  const navigateTo = (menu) => {
    const leavingQrPage = activeMenu === "qr";
    setActiveMenu(menu);
    setPageError("");
    setRequestSuccess("");
    setSearchTerm("");
    if (menu === "books") setSelectedCategory("all");
    if (menu === "categories") setSelectedCategory("all");

    if (leavingQrPage && ["books", "categories"].includes(menu)) {
      setInventoryRefreshVersion((version) => version + 1);
    }
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
      return <div className="student-catalog-message"><i className="bi bi-cloud-download"></i> Loading books from Google Books...</div>;
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
  const previewBookKey = getPreviewBookKey(previewBook);
  const savedPreviewDescription = cleanBookDescription(previewBook?.description);
  const previewDescriptionResultMatches =
    previewDescriptionResult?.bookKey === previewBookKey;
  const previewDescription =
    savedPreviewDescription ||
    (previewDescriptionResultMatches ? previewDescriptionResult.description : "");
  const isPreviewDescriptionLoading = Boolean(
    previewBook && !savedPreviewDescription && !previewDescriptionResultMatches
  );

  return (
    <div className="student-dashboard">
      <aside className="student-sidebar">
        <div className="student-brand">
          <img
            className="student-brand-logo"
            src="/libsync-logo.svg"
            alt="LibSync"
            draggable="false"
            style={{ width: "205px", maxWidth: "100%", height: "68px", objectFit: "contain", objectPosition: "center" }}
          />
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
            <i className="bi bi-box-arrow-left"></i><span>Logout</span>
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

        {activeMenu !== "qr" && (
          <header className="student-header libsync-page-hero libsync-page-hero--compact">
            <div className="student-header-copy libsync-page-hero-copy">
              <span className="student-header-label">YOUR LIBRARY SPACE</span>
              <h1>{activeMenu === "books" ? `Hello ${firstName}, what will you read today?` : activeMenu === "categories" ? "Explore book categories" : activeMenu === "selected" ? "Your selected books" : "Your borrowing QR code"}</h1>
              <p>{activeMenu === "books" ? "Discover your next favorite book from the library catalogue." : activeMenu === "categories" ? "Browse the collection by subject or genre." : activeMenu === "selected" ? "Review your book choices before submitting a request." : "Show this QR code to the librarian when it is ready."}</p>
            </div>
          </header>
        )}

        <main className="student-main">
          {pageError && <div className="form-error" role="alert">{pageError}</div>}
          {requestSuccess && <div className="form-success" role="status">{requestSuccess}</div>}

          {activeMenu === "books" && (
            <section className="student-home-grid">
              <div className="student-home-primary">
                <section className="student-risk-card" aria-labelledby="student-risk-title">
                  <div className="student-risk-card-heading">
                    <h2 id="student-risk-title">My Borrowing Risk</h2>
                    {!isRiskLoading && borrowingRisk && (
                      <span className={`student-risk-badge student-risk-badge--${String(borrowingRisk.risk_level || "low").toLowerCase()}`}>
                        {borrowingRisk.risk_level || "Low"} Risk
                      </span>
                    )}
                  </div>

                  {isRiskLoading && !borrowingRisk ? (
                    <div className="student-risk-message"><i className="bi bi-arrow-repeat"></i> Calculating your borrowing risk...</div>
                  ) : riskError && !borrowingRisk ? (
                    <div className="student-risk-message student-risk-message--error" role="alert">{riskError}</div>
                  ) : borrowingRisk ? (
                    <>
                      <div className="student-risk-score-block">
                        <span className="student-risk-label">Your current risk score</span>
                        <div className="student-risk-score-line">
                          <strong>{Number(borrowingRisk.risk_score || 0)}</strong>
                          <span>/ 100</span>
                        </div>
                        <div
                          className="student-risk-progress"
                          role="progressbar"
                          aria-label="Borrowing risk score"
                          aria-valuemin="0"
                          aria-valuemax="100"
                          aria-valuenow={Number(borrowingRisk.risk_score || 0)}
                        >
                          <span
                            className={`student-risk-progress-fill student-risk-progress-fill--${String(borrowingRisk.risk_level || "low").toLowerCase()}`}
                            style={{ width: `${Math.max(0, Math.min(100, Number(borrowingRisk.risk_score || 0)))}%` }}
                          ></span>
                        </div>
                        <small>Calculated from your LibSync borrowing and return records.</small>
                      </div>

                      <div className="student-risk-factors">
                        <h3>What affects your score?</h3>
                        <div className="student-risk-factor-row">
                          <span>Previous late returns</span>
                          <strong className={Number(borrowingRisk.past_late_returns || 0) > 0 ? "is-contributing" : "is-clear"}>
                            {Number(borrowingRisk.past_late_returns || 0) > 0
                              ? `${borrowingRisk.past_late_returns} late ${Number(borrowingRisk.past_late_returns) === 1 ? "return" : "returns"}`
                              : "None"}
                          </strong>
                        </div>
                        <div className="student-risk-factor-row">
                          <span>Current overdue books</span>
                          <strong className={Number(borrowingRisk.current_overdue_books || 0) > 0 ? "is-contributing" : "is-clear"}>
                            {Number(borrowingRisk.current_overdue_books || 0) > 0
                              ? `${borrowingRisk.current_overdue_books} overdue ${Number(borrowingRisk.current_overdue_books) === 1 ? "book" : "books"}`
                              : "None"}
                          </strong>
                        </div>
                      </div>

                      <div className="student-risk-improve">
                        <h3><i className="bi bi-lightbulb"></i> How to improve your score</h3>
                        <p>
                          Return borrowed books on or before their due dates to maintain a good borrowing record.
                          {Number(borrowingRisk.current_overdue_books || 0) > 0
                            ? " Please return your overdue books as soon as possible."
                            : ""}
                        </p>
                      </div>

                      <div className="student-risk-updated">
                        Last updated: {borrowingRisk.calculated_at
                          ? new Date(borrowingRisk.calculated_at).toLocaleString("en-PH", {
                              dateStyle: "long",
                              timeStyle: "short",
                            })
                          : "Just now"}
                        {riskError && <span className="student-risk-refresh-note"> · Latest refresh unavailable</span>}
                      </div>
                    </>
                  ) : (
                    <div className="student-risk-message">Your borrowing risk information will appear here.</div>
                  )}
                </section>

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
                    <i className={`bi ${sortOrder === "az" ? "bi-sort-alpha-down" : "bi-sort-alpha-up"}`}></i>
                    <span>Sort</span>
                    <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} aria-label="Sort books">
                      <option value="az">Title: A to Z</option>
                      <option value="za">Title: Z to A</option>
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
                    <span className="student-online-count"><i className="bi bi-cloud-check"></i> {isOnlineLoading ? "Loading..." : `${visibleOnlineBooks.length} titles`}</span>
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
                    <div className="student-side-empty">Loading your activity...</div>
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
                  <i className={`bi ${sortOrder === "az" ? "bi-sort-alpha-down" : "bi-sort-alpha-up"}`}></i>
                  <span>Sort</span>
                  <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} aria-label="Sort books">
                    <option value="az">Title: A to Z</option>
                    <option value="za">Title: Z to A</option>
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

                  <div className="student-loan-duration-control student-loan-duration-fixed">
                    <div className="student-loan-duration-copy">
                      <i className="bi bi-calendar-check"></i>
                      <div>
                        <label>Fixed return period</label>
                        <p>All approved books must be returned within 24 hours after the librarian releases them. Your countdown starts when the Borrow QR is scanned.</p>
                      </div>
                    </div>
                    <div className="student-fixed-loan-badge" aria-label="Fixed return period: 24 hours after release">
                      <strong>24 HOURS</strong>
                      <span>after release</span>
                    </div>
                  </div>

                  <button type="button" className="generate-qr-button" disabled={isGenerating} onClick={handleSubmitBorrowRequest}>
                    <i className="bi bi-qr-code"></i>{isGenerating ? "Submitting Request..." : "Submit Borrow Request"}
                  </button>
                </>
              )}
            </section>
          )}

          {activeMenu === "qr" && (
            <section>
              {batchStatusError && <div className="form-error" role="alert">{batchStatusError}</div>}

              <section className="libsync-qr-page">
                <header className="libsync-qr-hero">
                  <div className="libsync-qr-hero-copy">
                    <span>YOUR LIBRARY SPACE</span>
                    <h2>Borrowing &amp; Return QR</h2>
                    <p>Manage your active borrowings and return them using their respective QR codes.</p>
                  </div>
                </header>

                <nav className="libsync-qr-tabs" aria-label="Borrowing request filters">
                  {pendingQrBatches.length > 0 && (
                    <>
                      <button type="button" className={`libsync-qr-tab ${visibleQrTab === "all" ? "active" : ""}`} onClick={() => setQrListTab("all")}>
                        <i className="bi bi-list-ul"></i><span>All Requests ({allRequestQrBatches.length})</span>
                      </button>
                      <button type="button" className={`libsync-qr-tab ${visibleQrTab === "pending" ? "active" : ""}`} onClick={() => setQrListTab("pending")}>
                        <i className="bi bi-hourglass-split"></i><span>Pending Approval ({pendingQrBatches.length})</span>
                      </button>
                    </>
                  )}
                  <button type="button" className={`libsync-qr-tab ${visibleQrTab === "active" ? "active" : ""}`} onClick={() => setQrListTab("active")}>
                    <i className="bi bi-check-circle"></i><span>Active Borrowings ({activeQrBatches.length})</span>
                  </button>
                  <button type="button" className={`libsync-qr-tab ${visibleQrTab === "returned" ? "active" : ""}`} onClick={() => setQrListTab("returned")}>
                    <i className="bi bi-calendar-check"></i><span>Returned ({returnedQrBatches.length})</span>
                  </button>
                  <button type="button" className={`libsync-qr-tab ${visibleQrTab === "history" ? "active" : ""}`} onClick={() => setQrListTab("history")}>
                    <i className="bi bi-clock-history"></i><span>History</span>
                  </button>
                </nav>

                {isBatchesLoading && qrBatches.length === 0 ? (
                  <div className="libsync-qr-empty"><i className="bi bi-arrow-repeat"></i><strong>Loading your borrowing activity...</strong></div>
                ) : displayedQrBatches.length === 0 ? (
                  <div className="libsync-qr-empty">
                    <i className={visibleQrTab === "pending" ? "bi bi-hourglass" : visibleQrTab === "returned" ? "bi bi-check-circle" : visibleQrTab === "history" ? "bi bi-clock-history" : "bi bi-qr-code"}></i>
                    <strong>
                      {visibleQrTab === "pending" ? "No pending approval"
                        : visibleQrTab === "returned" ? "No returned books yet"
                        : visibleQrTab === "history" ? "No borrowing history yet"
                        : "No active borrowing yet"}
                    </strong>
                    <p>
                      {visibleQrTab === "active"
                        ? "When your approved books are ready for checkout or have been released, they will appear here."
                        : visibleQrTab === "pending"
                        ? "New borrowing requests waiting for librarian approval will appear here."
                        : "Your borrowing transactions will appear here as you use the library."}
                    </p>
                    {visibleQrTab === "active" && <button type="button" onClick={() => navigateTo("books")}>Browse Books</button>}
                  </div>
                ) : (
                  <div className="libsync-qr-list">
                    {displayedQrBatches.map((batch) => {
                      const books = batch.books || [];
                      const returnCountdown = batch.borrowedAt
                        ? getReturnCountdown(batch.borrowedAt, batch.dueDate)
                        : null;
                      const isPending = batch.status === "pending";
                      const isReturned = batch.status === "returned";
                      const isDeclined = batch.status === "declined";
                      const isReleased = Boolean(batch.borrowQrUsedAt);
                      const qrType = isReleased ? "return" : "borrow";
                      const qrPayload = isReleased ? batch.returnQrPayload : batch.borrowQrPayload;
                      const qrHeading = isReleased ? `Return QR (Batch ${batch.batchId})` : `Borrow QR (Batch ${batch.batchId})`;
                      const qrCanBeShown = Boolean(qrPayload) && !isPending && !isReturned && !isDeclined;
                      const cardBooks = isPending
                        ? books
                        : books.filter(book => String(book.status || "").toLowerCase() !== "declined");

                      if (isPending) {
                        return (
                          <article className="libsync-pending-card" key={batch.batchId}>
                            <div className="libsync-batch-identity libsync-batch-identity--pending">
                              <span className="libsync-batch-icon"><i className="bi bi-book-half"></i></span>
                              <small>Batch ID</small><strong>{batch.batchId}</strong>
                              <span className="libsync-state-pill libsync-state-pill--pending"><i className="bi bi-hourglass-split"></i> Pending</span>
                            </div>
                            <div className="libsync-request-details">
                              <h3><i className="bi bi-calendar2-check"></i> Borrowing Request</h3>
                              <div className="libsync-request-detail">
                                <i className="bi bi-calendar-check"></i>
                                <div><span>Requested on</span><strong>{formatDueDate(batch.requestedAt)}</strong></div>
                              </div>
                              <div className="libsync-request-detail">
                                <i className="bi bi-layers"></i>
                                <div><span>Total books</span><strong>{cardBooks.length}</strong></div>
                              </div>
                              <div className="libsync-request-books">
                                <i className="bi bi-book"></i>
                                <div><span>Books Requested</span><ul>{cardBooks.map(book => <li key={book.request_id || book.id}>{book.title}</li>)}</ul></div>
                              </div>
                            </div>
                            <div className="libsync-waiting-panel">
                              <span className="libsync-waiting-icon"><i className="bi bi-hourglass-split"></i></span>
                              <h3>Waiting for Approval</h3>
                              <p>Your borrowing request is currently under review by the librarian. Once approved, your Borrowing QR will be generated here.</p>
                            </div>
                          </article>
                        );
                      }

                      if (visibleQrTab === "history" || isReturned || isDeclined) {
                        return (
                          <article className={`libsync-history-card ${isDeclined ? "is-declined" : ""}`} key={batch.batchId}>
                            <div className="libsync-batch-identity">
                              <span className="libsync-batch-icon"><i className="bi bi-book-half"></i></span>
                              <small>Batch ID</small><strong>{batch.batchId}</strong>
                              <span className={`libsync-state-pill ${isDeclined ? "libsync-state-pill--declined" : "libsync-state-pill--returned"}`}>{isDeclined ? "Declined" : "Returned"}</span>
                            </div>
                            <div className="libsync-history-details">
                              <h3>{isDeclined ? "Borrowing Request Declined" : "Borrowing Details"}</h3>
                              <p><i className="bi bi-calendar3"></i>{isDeclined ? "Reviewed on" : "Borrowed on"}: <strong>{formatDueDate(batch.approvedAt || batch.requestedAt)}</strong></p>
                              <p><i className="bi bi-book"></i>{books.length} {books.length === 1 ? "book" : "books"}</p>
                              <ul>{books.map(book => <li key={book.request_id || book.id}>{book.title}</li>)}</ul>
                            </div>
                          </article>
                        );
                      }

                      const statusLabel = batch.status === "partially_returned" ? "Partially returned" : "Approved";
                      return (
                        <article className="libsync-active-card" key={batch.batchId}>
                          <div className="libsync-batch-identity">
                            <span className="libsync-batch-icon"><i className="bi bi-book-half"></i></span>
                            <small>Batch ID</small><strong>{batch.batchId}</strong>
                            <span className={`libsync-state-pill ${batch.status === "partially_returned" ? "libsync-state-pill--partial" : "libsync-state-pill--active"}`}>
                              <i className="bi bi-check-circle-fill"></i> {statusLabel}
                            </span>
                          </div>

                          <div className="libsync-borrowing-details">
                            <h3><i className="bi bi-calendar-event"></i> Borrowing Details</h3>
                            <div className="libsync-request-detail">
                              <i className="bi bi-calendar-check"></i>
                              <div><span>Borrowed on</span><strong>{batch.borrowedAt ? formatDueDate(batch.borrowedAt) : "Awaiting checkout"}</strong></div>
                            </div>
                            <div className="libsync-request-detail">
                              <i className="bi bi-hourglass-split"></i>
                              <div><span>Return period</span><strong>24 hours</strong></div>
                            </div>
                            <div className="libsync-request-detail">
                              <i className="bi bi-calendar2-check"></i>
                              <div><span>Due on</span><strong>{batch.dueDate ? formatDueDate(batch.dueDate) : "Set after librarian release"}</strong></div>
                            </div>
                          </div>

                          <div className="libsync-active-books">
                            <h3><i className="bi bi-book"></i> Books ({cardBooks.length})</h3>
                            <ul>{cardBooks.map(book => <li key={book.request_id || book.id}>{book.title}{String(book.status || "").toLowerCase() === "returned" ? " — Returned" : ""}</li>)}</ul>
                          </div>

                          <div className="libsync-qr-panel">
                            <h3><i className="bi bi-arrow-repeat"></i> {qrHeading}</h3>
                            <div className="libsync-qr-panel-body">
                              <div className="libsync-qr-thumb">
                                {qrCanBeShown ? <QRCodeCanvas value={qrPayload} size={100} level="H" includeMargin /> : <i className="bi bi-qr-code"></i>}
                              </div>
                              <div className="libsync-qr-panel-action">
                                {isReleased && returnCountdown && (
                                  <span className={`libsync-countdown ${returnCountdown.isOverdue ? "is-overdue" : ""}`}>
                                    <i className="bi bi-clock"></i> {returnCountdown.label}
                                  </span>
                                )}
                                {!isReleased && <span className="libsync-qr-panel-hint">Borrow QR ready after librarian approval.</span>}
                                {isReleased && <span className="libsync-qr-panel-hint">Show this QR when returning these books.</span>}
                                <button
                                  type="button"
                                  disabled={!qrCanBeShown}
                                  onClick={() => setExpandedQrBatch({ batchId: batch.batchId, type: qrType, payload: qrPayload })}
                                >
                                  <i className="bi bi-qr-code-scan"></i>{qrType === "return" ? "Show Return QR" : "Show Borrow QR"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>            </section>
          )}
        </main>
      </div>

      {expandedQrBatch && (
        <div className="libsync-qr-modal-backdrop" onClick={() => setExpandedQrBatch(null)}>
          <section className="libsync-qr-modal" role="dialog" aria-modal="true" aria-labelledby="libsync-qr-modal-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="libsync-qr-modal-close" aria-label="Close QR code" onClick={() => setExpandedQrBatch(null)}>
              <i className="bi bi-x-lg"></i>
            </button>
            <span className="libsync-qr-modal-eyebrow">LIBSYNC • {expandedQrBatch.type === "return" ? "RETURN CODE" : "BORROW CODE"}</span>
            <h2 id="libsync-qr-modal-title">{expandedQrBatch.type === "return" ? "Return QR" : "Borrowing QR"}</h2>
            <p>Batch ID: {expandedQrBatch.batchId}</p>
            <div className="libsync-qr-modal-code"><QRCodeCanvas value={expandedQrBatch.payload} size={260} level="H" includeMargin /></div>
            <p className="libsync-qr-modal-note">{expandedQrBatch.type === "return" ? "Show this separate Return QR to the librarian when returning these books." : "Present this Borrow QR to the librarian for checkout."}</p>
            <button type="button" className="libsync-qr-modal-done" onClick={() => setExpandedQrBatch(null)}>Done</button>
          </section>
        </div>
      )}

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
                <div className="student-preview-description" aria-live="polite">
                  <strong>About this book</strong>
                  {isPreviewDescriptionLoading ? (
                    <p className="student-preview-description-loading">
                      <i className="bi bi-arrow-repeat" aria-hidden="true"></i> Loading book description...
                    </p>
                  ) : previewDescription ? (
                    <p>{previewDescription}</p>
                  ) : (
                    <p className="student-preview-description-empty">
                      No description is available for this title yet. The librarian can add one when updating the book information.
                    </p>
                  )}
                </div>
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
