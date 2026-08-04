import os
import uuid
import logging
from fastapi import UploadFile

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


async def save_evidence_file(file: UploadFile) -> str:
    """Save evidence file locally or to Cloudinary if CLOUDINARY_URL is present."""
    cloudinary_url = os.getenv("CLOUDINARY_URL")

    if cloudinary_url:
        try:
            import cloudinary
            import cloudinary.uploader
            cloudinary.config(cloudinary_url=cloudinary_url)
            res = cloudinary.uploader.upload(file.file)
            return res.get("secure_url", "")
        except Exception as e:
            logger.warning(f"Cloudinary upload failed: {e}. Falling back to local storage.")

    # Local storage fallback
    file_ext = os.path.splitext(file.filename or "file")[1]
    filename = f"{uuid.uuid4()}{file_ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    return f"/static/uploads/{filename}"
