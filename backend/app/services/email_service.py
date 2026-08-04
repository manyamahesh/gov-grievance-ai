import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "noreply@gov-grievance.gov")


def send_email_notification(to_email: str, subject: str, body: str) -> bool:
    """Send email notification via SMTP or log if unconfigured."""
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.info(f"📧 [MOCK EMAIL] To: {to_email} | Subject: {subject} | Body: {body}")
        return True

    try:
        msg = MIMEMultipart()
        msg["From"] = DEFAULT_FROM_EMAIL
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(DEFAULT_FROM_EMAIL, to_email, msg.as_string())
        server.quit()
        logger.info(f"📧 Email successfully sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to send email to {to_email}: {e}")
        return False
