import os
import smtplib
from email.message import EmailMessage



MAIL_USERNAME = os.getenv("MAIL_USERNAME")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")

SYSTEM_NAME = "LibSync"
SYSTEM_DESCRIPTION = "Library Borrowing and Monitoring System"


def send_borrow_status_email(
    student_email,
    student_name,
    status,
    book_titles=None,
    due_date=None,
):
    if not MAIL_USERNAME or not MAIL_PASSWORD:
        print("Email notification skipped: MAIL_USERNAME or MAIL_PASSWORD is missing.")
        return False

    if not student_email:
        print("Email notification skipped: student email is missing.")
        return False

    book_titles = book_titles or []

    status_key = str(status).lower()

    subjects = {
        "pending": "Borrow Request Submitted",
        "approved": "Borrow Request Approved",
        "declined": "Borrow Request Declined",
        "returned": "Book Return Confirmed",
        "partially_returned": "Partial Book Return Confirmed",
        "borrowed": "Books Released",
        "overdue": "Borrowing Overdue Reminder",
    }

    subject_status = subjects.get(
        status_key,
        "Borrowing Status Updated",
    )

    books_text = "\n".join(
        f"- {title}" for title in book_titles
    )

    if not books_text:
        books_text = "- No book information available"

    message_lines = [
        f"Hello {student_name},",
        "",
        f"Your LibSync borrowing status has been updated.",
        "",
        f"Status: {status_key.replace('_', ' ').title()}",
        "",
        "Book(s):",
        books_text,
    ]

    if due_date:
        message_lines.extend([
            "",
            f"Due Date: {due_date}",
        ])

    message_lines.extend([
        "",
        "Please open LibSync for more details.",
        "",
        "LibSync",
        SYSTEM_DESCRIPTION,
    ])

    email = EmailMessage()
    email["Subject"] = f"LibSync - {subject_status}"
    email["From"] = MAIL_USERNAME
    email["To"] = student_email
    email.set_content("\n".join(message_lines))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=20) as smtp:
            smtp.starttls()
            smtp.login(
                MAIL_USERNAME,
                MAIL_PASSWORD,
            )
            smtp.send_message(email)

        print(
            f"Email sent to {student_email}: {subject_status}"
        )

        return True

    except Exception as error:
        print("Email notification error:", error)
        return False