class ApplicationError(Exception):
    """Base error safe to translate at the HTTP boundary."""


class ResourceNotFoundError(ApplicationError):
    pass


class ConflictError(ApplicationError):
    pass


class UpstreamUnavailableError(ApplicationError):
    pass

