
import json
import os
import urllib.error
import urllib.request


BREVO_API_KEY = os.getenv("BREVO_API_KEY")
BREVO_SENDER_EMAIL = os.getenv(
    "BREVO_SENDER_EMAIL",
    "libsync.notifications@gmail.com",
)
BREVO_SENDER_NAME = os.getenv(
    "BREVO_SENDER_NAME",
    "LibSync",
)

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"

SYSTEM_NAME = "LibSync"
SYSTEM_DESCRIPTION = "Library Borrowing and Monitoring System"


def send_borrow_status_email(
    student_email,
    student_name,
    status,
    book_titles=None,
    due_date=None,
):
    if not BREVO_API_KEY:
        print(
            "Email notification skipped: "
            "BREVO_API_KEY is missing."
        )
        return False

    if not BREVO_SENDER_EMAIL:
        print(
            "Email notification skipped: "
            "BREVO_SENDER_EMAIL is missing."
        )
        return False

    if not student_email:
        print(
            "Email notification skipped: "
            "student email is missing."
        )
        return False

    book_titles = book_titles or []
    status_key = str(status).lower()

    subjects = {
        "pending": "Borrow Request Submitted",
        "approved": "Borrow Request Approved",
        "declined": "Borrow Request Declined",
        "returned": "Book Return Confirmed",
        "partially_returned": (
            "Partial Book Return Confirmed"
        ),
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
        "Your LibSync borrowing status has been updated.",
        "",
        (
            "Status: "
            f"{status_key.replace('_', ' ').title()}"
        ),
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
        SYSTEM_NAME,
        SYSTEM_DESCRIPTION,
    ])

    recipient = {
        "email": student_email,
    }

    if student_name:
        recipient["name"] = student_name

    payload = {
        "sender": {
            "name": BREVO_SENDER_NAME,
            "email": BREVO_SENDER_EMAIL,
        },
        "to": [
            recipient,
        ],
        "subject": f"LibSync - {subject_status}",
        "textContent": "\n".join(message_lines),
    }

    request = urllib.request.Request(
        BREVO_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "accept": "application/json",
            "api-key": BREVO_API_KEY,
            "content-type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=20,
        ) as response:
            response_body = response.read().decode(
                "utf-8"
            )

            if 200 <= response.status < 300:
                print(
                    f"Email sent to {student_email}: "
                    f"{subject_status}"
                )

                if response_body:
                    print(
                        "Brevo response:",
                        response_body,
                    )

                return True

            print(
                "Email notification error: "
                f"Brevo returned HTTP "
                f"{response.status}"
            )
            return False

    except urllib.error.HTTPError as error:
        try:
            error_body = error.read().decode("utf-8")
        except Exception:
            error_body = ""

        print(
            "Email notification error: "
            f"Brevo HTTP {error.code} "
            f"{error_body}"
        )
        return False

    except urllib.error.URLError as error:
        print(
            "Email notification network error:",
            error.reason,
        )
        return False

    except Exception as error:
        print(
            "Email notification error:",
            error,
        )
        return False