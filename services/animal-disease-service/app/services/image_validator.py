from io import BytesIO

from PIL import Image

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)


class ImageValidationError(Exception):
    """Raised when an uploaded image fails pre-flight checks."""

    def __init__(self, reason: str, detail: str = "") -> None:
        self.reason = reason
        super().__init__(f"{reason}: {detail}" if detail else reason)


class ImageValidator:
    """Pre-flight checks before sending image to the Vision LLM.

    Catches garbage early so we don't waste OpenRouter tokens on
    corrupted files, non-animal photos, or oversized uploads.
    """

    def __init__(self) -> None:
        self._settings = get_settings()

    def validate(self, image_bytes: bytes, content_type: str) -> Image.Image:
        self._check_content_type(content_type)
        self._check_file_size(image_bytes)

        pil_image = self._open_image(image_bytes)
        self._check_dimensions(pil_image)

        return pil_image.convert("RGB")

    def _check_content_type(self, content_type: str) -> None:
        allowed = self._settings.allowed_content_types
        if content_type not in allowed:
            raise ImageValidationError(
                "unsupported_format",
                f"Expected one of {allowed}, got {content_type}",
            )

    def _check_file_size(self, image_bytes: bytes) -> None:
        max_bytes = self._settings.max_image_bytes
        if len(image_bytes) > max_bytes:
            raise ImageValidationError(
                "file_too_large",
                f"Max {self._settings.max_image_size_mb}MB, got {len(image_bytes) / 1_048_576:.1f}MB",
            )
        if len(image_bytes) == 0:
            raise ImageValidationError("empty_file", "Uploaded file contains no data")

    def _open_image(self, image_bytes: bytes) -> Image.Image:
        try:
            return Image.open(BytesIO(image_bytes))
        except Exception as exc:
            raise ImageValidationError(
                "corrupt_image", "PIL could not decode the uploaded file"
            ) from exc

    def _check_dimensions(self, image: Image.Image) -> None:
        w, h = image.size
        min_w = self._settings.min_image_width
        min_h = self._settings.min_image_height
        if w < min_w or h < min_h:
            raise ImageValidationError(
                "too_small",
                f"Minimum {min_w}x{min_h}px required, got {w}x{h}px",
            )
