import base64

import cloudinary.uploader
from cloudinary import CloudinaryImage

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)


class CloudinaryStorage:
    """Uploads scan images to Cloudinary and returns the public URL.

    Uses the synchronous Cloudinary SDK — it's fast enough for single
    image uploads. If this becomes a bottleneck, wrap in run_in_executor.
    """

    def __init__(self) -> None:
        settings = get_settings()
        cloudinary.config(
            cloud_name=settings.cloudinary_cloud_name,
            api_key=settings.cloudinary_api_key,
            api_secret=settings.cloudinary_api_secret,
        )
        self._folder = settings.cloudinary_folder

    def upload(self, image_bytes: bytes, public_id: str | None = None) -> str:
        """Upload raw bytes and return the secure URL."""
        result = cloudinary.uploader.upload(
            image_bytes,
            folder=self._folder,
            public_id=public_id,
            resource_type="image",
            format="jpg",
        )
        url: str = result["secure_url"]
        log.info("image_uploaded", url=url, public_id=result.get("public_id"))
        return url
