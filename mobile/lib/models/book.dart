
class Book {
  final int id;
  final String title;
  final String author;
  final String? description;
  final String? isbn;
  final String? category;
  final String? publisher;
  final int? yearPublished;
  final int quantity;
  final int availableQuantity;
  final String status;

  // Shared online book cover from the backend
  final String? coverImageUrl;

  const Book({
    required this.id,
    required this.title,
    required this.author,
    this.description,
    this.isbn,
    this.category,
    this.publisher,
    this.yearPublished,
    required this.quantity,
    required this.availableQuantity,
    required this.status,
    this.coverImageUrl,
  });

  factory Book.fromJson(Map<String, dynamic> json) {
    final rawCover = json['cover_image_url']?.toString().trim();

    return Book(
      id: int.tryParse('${json['id']}') ?? 0,
      title: '${json['title'] ?? 'Untitled'}',
      author: '${json['author'] ?? 'Unknown Author'}',
      description: json['description']?.toString(),
      isbn: json['isbn']?.toString(),
      category: json['category']?.toString(),
      publisher: json['publisher']?.toString(),
      yearPublished:
          int.tryParse('${json['year_published'] ?? ''}'),
      quantity:
          int.tryParse('${json['quantity'] ?? 0}') ?? 0,
      availableQuantity:
          int.tryParse('${json['available_quantity'] ?? 0}') ?? 0,
      status: '${json['status'] ?? 'unavailable'}',

      // Accept only HTTP(S) image URLs
      coverImageUrl: rawCover != null &&
              (Uri.tryParse(rawCover)?.isScheme('https') == true ||
                  Uri.tryParse(rawCover)?.isScheme('http') == true)
          ? rawCover
          : null,
    );
  }

  bool get isAvailable => availableQuantity > 0;
}
