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
            load_dotenv(candidate, override=True)
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
    SECRET_KEY: str = os.getenv("SECRET_KEY", "earthsift-scientific-hmac-sha256-production-token-2026")
    MAX_BBOX_DEGREES: float = float(os.getenv("MAX_BBOX_DEGREES", "180.0"))
    DEFAULT_FDR_ALPHA: float = float(os.getenv("DEFAULT_FDR_ALPHA", "0.05"))

    @classmethod
    def get_earthdata_auth_status(cls) -> dict[str, Any]:
        """Check if NASA Earthdata credentials are configured."""
        if cls.EARTHDATA_TOKEN:
            return {"authenticated": True, "auth_type": "bearer_token", "message": "NASA Earthdata Bearer Token active."}
        if cls.EARTHDATA_USERNAME and cls.EARTHDATA_PASSWORD:
            return {"authenticated": True, "auth_type": "user_pass", "message": f"NASA Earthdata credentials configured for user '{cls.EARTHDATA_USERNAME}'."}
        
        # Check if local netrc already exists
        netrc_file = Path.home() / ("_netrc" if sys.platform.startswith("win") else ".netrc")
        if netrc_file.exists():
            try:
                content = netrc_file.read_text(encoding="utf-8")
                if "urs.earthdata.nasa.gov" in content:
                    return {"authenticated": True, "auth_type": "existing_netrc", "message": "NASA Earthdata configured via local netrc."}
            except Exception:
                pass

        return {
            "authenticated": False,
            "auth_type": "anonymous_fixture",
            "message": "Running in Verified Local Fixture Mode. Set EARTHDATA_USERNAME/EARTHDATA_PASSWORD to stream directly from NASA Earthdata Cloud."
        }

    @classmethod
    def setup_netrc(cls) -> bool:
        """
        Safely generate or update user's netrc file for NASA Earthdata
        if credentials are provided in environment variables.
        """
        if not (cls.EARTHDATA_USERNAME and cls.EARTHDATA_PASSWORD):
            return False

        netrc_file = Path.home() / ("_netrc" if sys.platform.startswith("win") else ".netrc")
        entry = f"machine urs.earthdata.nasa.gov login {cls.EARTHDATA_USERNAME} password {cls.EARTHDATA_PASSWORD}\n"

        try:
            existing = ""
            if netrc_file.exists():
                existing = netrc_file.read_text(encoding="utf-8")

            if "urs.earthdata.nasa.gov" not in existing:
                with open(netrc_file, "a", encoding="utf-8") as f:
                    f.write(f"\n{entry}")
            if not sys.platform.startswith("win") and netrc_file.exists():
                os.chmod(netrc_file, 0o600)
            return True
        except Exception:
            return False


settings = Settings()
