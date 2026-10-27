"""
EarthSift — Runtime & NASA Earthdata Configuration
Manages NASA Earthdata Login (EDL) credentials, netrc generation,
cache policies, and runtime environment settings.
"""

import logging
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
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # NASA Earthdata Login (EDL)
    EARTHDATA_USERNAME: str | None = os.getenv("EARTHDATA_USERNAME")
    EARTHDATA_PASSWORD: str | None = os.getenv("EARTHDATA_PASSWORD")
    EARTHDATA_TOKEN: str | None = os.getenv("EARTHDATA_TOKEN")

    # Caching
    CACHE_MAX_SIZE: int = int(os.getenv("CACHE_MAX_SIZE", "256"))
    CACHE_MAX_BYTES: int = int(os.getenv("CACHE_MAX_BYTES", str(96 * 1024 * 1024)))

    # Security & Cryptography
    @staticmethod
    def _init_secret_key(env: str) -> str:
        explicit_key = os.getenv("SECRET_KEY")
        if env == "production":
            if not explicit_key or len(explicit_key.strip()) < 32 or explicit_key.strip() == "earthsift-scientific-hmac-sha256-production-token-2026":
                logging.getLogger("earthsift.config").critical(
                    "CRITICAL SECURITY CONFIGURATION: In production (ENVIRONMENT='production'), "
                    "SECRET_KEY must be explicitly set to a stable, cryptographically secure key "
                    "of at least 32 characters in the environment or .env file to ensure HMAC cache integrity."
                )
                raise RuntimeError(
                    "Production configuration error: SECRET_KEY environment variable must be set to a secure, stable secret key "
                    "of at least 32 characters in production to guarantee multi-worker HMAC cache integrity and prevent cache corruption."
                )
            return explicit_key.strip()
        if explicit_key and len(explicit_key.strip()) >= 16:
            return explicit_key.strip()
        return "earthsift-scientific-hmac-sha256-development-token-2026"

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
        netrc_dir = Path(os.getenv("NETRC_DIR", str(Path.home())))
        netrc_file = netrc_dir / (".netrc" if ("NETRC_DIR" in os.environ or not sys.platform.startswith("win")) else "_netrc")
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
            logging.getLogger("earthsift.config").error(
                "NASA Earthdata credentials contain illegal whitespace or newline characters."
            )
            return False

        netrc_dir = Path(os.getenv("NETRC_DIR", str(Path.home())))
        netrc_file = netrc_dir / (".netrc" if ("NETRC_DIR" in os.environ or not sys.platform.startswith("win")) else "_netrc")
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

            if sys.platform.startswith("win"):
                # On Windows, enforce DACL file security via icacls restricting access strictly to current user
                cur_user = os.getenv("USERNAME")
                cur_domain = os.getenv("USERDOMAIN")
                account = f"{cur_domain}\\{cur_user}" if cur_domain and cur_user else (cur_user or "")
                if account and netrc_file.exists():
                    try:
                        import subprocess  # noqa: S404
                        system_root = os.environ.get("SystemRoot", "C:\\Windows")
                        icacls_path = Path(system_root) / "System32" / "icacls.exe"
                        icacls_bin = str(icacls_path) if icacls_path.exists() else "icacls"
                        subprocess.run(  # noqa: S603, S607
                            [icacls_bin, str(netrc_file), "/inheritance:r", "/grant:r", f"{account}:(R,W)"],
                            capture_output=True,
                            check=False,
                            timeout=5.0,
                        )
                    except Exception as exc:
                        logging.getLogger("earthsift.config").debug("Failed setting Windows netrc DACL: %s", exc)
            elif netrc_file.exists():
                os.chmod(netrc_file, 0o600)
            return True
        except Exception:
            return False


settings = Settings()
