"""
EarthSift — Runtime & NASA Earthdata Configuration
Manages NASA Earthdata Login (EDL) credentials, netrc generation,
cache policies, and runtime environment settings.
"""

import os
import sys
from pathlib import Path
from typing import Any

try:
    from dotenv import load_dotenv
    # Look for .env in project root and parent directories
    for candidate in [
        Path(__file__).resolve().parents[3] / ".env",
        Path(__file__).resolve().parents[2] / ".env",
        Path.cwd() / ".env"
    ]:
        if candidate.exists():
            load_dotenv(candidate, override=False)
            break

except ImportError:
    pass


class Settings:
    """Core application settings with NASA Earthdata integration."""

    # Application Info
    APP_NAME: str = "EarthSift Scientific API"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")

    # NASA Earthdata Login (EDL)
    EARTHDATA_USERNAME: str | None = os.getenv("EARTHDATA_USERNAME")
    EARTHDATA_PASSWORD: str | None = os.getenv("EARTHDATA_PASSWORD")
    EARTHDATA_TOKEN: str | None = os.getenv("EARTHDATA_TOKEN")

    # Caching
    CACHE_MAX_SIZE: int = int(os.getenv("CACHE_MAX_SIZE", "256"))

    # Security & Cryptography
    @staticmethod
    def _init_secret_key(env: str, _is_pytest: bool | None = None) -> str:
        explicit_key = os.getenv("SECRET_KEY")
        if explicit_key:
            return explicit_key
        if _is_pytest is None:
            _is_pytest = "pytest" in sys.modules or "PYTEST_CURRENT_TEST" in os.environ
        if env == "production" and not _is_pytest:
            import logging
            import secrets
            logging.getLogger("earthsift.config").warning(
                "SECRET_KEY not set in production environment; generated ephemeral cryptographic key."
            )
            return secrets.token_hex(32)
        return "earthsift-scientific-hmac-sha256-production-token-2026"

    SECRET_KEY: str = _init_secret_key(ENVIRONMENT)
    MAX_BBOX_DEGREES: float = float(os.getenv("MAX_BBOX_DEGREES", "180.0"))
    DEFAULT_FDR_ALPHA: float = float(os.getenv("DEFAULT_FDR_ALPHA", "0.05"))

    def get_earthdata_auth_status(self) -> dict[str, Any]:
        """Check if NASA Earthdata credentials are configured."""
        token = getattr(self, "EARTHDATA_TOKEN", None)
        username = getattr(self, "EARTHDATA_USERNAME", None)
        password = getattr(self, "EARTHDATA_PASSWORD", None)
        if token:
            return {"authenticated": True, "auth_type": "bearer_token", "message": "NASA Earthdata Bearer Token active."}
        if username and password:
            return {"authenticated": True, "auth_type": "user_pass", "message": f"NASA Earthdata credentials configured for user '{username}'."}
        
        # Check if local netrc already exists
        netrc_file = Path.home() / ("_netrc" if sys.platform.startswith("win") else ".netrc")
        if netrc_file.exists():
            try:
                content = netrc_file.read_text(encoding="utf-8")
                if "urs.earthdata.nasa.gov" in content:
                    return {"authenticated": True, "auth_type": "existing_netrc", "message": "NASA Earthdata configured via local netrc."}
            except Exception:  # noqa: S110
                pass

        return {
            "authenticated": False,
            "auth_type": "anonymous_fixture",
            "message": "Running in Verified Local Fixture Mode. Set EARTHDATA_USERNAME/EARTHDATA_PASSWORD to stream directly from NASA Earthdata Cloud."
        }

    def setup_netrc(self) -> bool:
        """
        Safely generate or update user's netrc file for NASA Earthdata
        if credentials are provided in environment variables.
        """
        username = getattr(self, "EARTHDATA_USERNAME", None)
        password = getattr(self, "EARTHDATA_PASSWORD", None)
        if not (username and password):
            return False

        # Validate that credentials do not contain newlines or whitespace characters
        # to prevent netrc command/line injection attacks
        if any(c.isspace() for c in username) or any(c.isspace() for c in password):
            import logging
            logging.getLogger("earthsift.config").error(
                "NASA Earthdata credentials contain illegal whitespace or newline characters."
            )
            return False

        netrc_file = Path.home() / ("_netrc" if sys.platform.startswith("win") else ".netrc")
        entry = f"machine urs.earthdata.nasa.gov login {username} password {password}\n"

        try:
            existing = ""
            if netrc_file.exists():
                existing = netrc_file.read_text(encoding="utf-8")

            if "urs.earthdata.nasa.gov" not in existing:
                fd = os.open(str(netrc_file), os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
                with open(fd, "w", encoding="utf-8", closefd=True) as f:
                    prefix = "\n" if existing and not existing.endswith("\n") else ""
                    f.write(f"{prefix}{entry}")

            if not sys.platform.startswith("win") and netrc_file.exists():
                os.chmod(netrc_file, 0o600)
            return True
        except Exception:
            return False


settings = Settings()
