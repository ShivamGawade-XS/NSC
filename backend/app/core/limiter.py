"""
EarthSift — Rate Limiting Configuration (SlowAPI)
Provides enterprise rate limiting across compute-heavy and export endpoints.
"""

import os
import sys
from slowapi import Limiter
from slowapi.util import get_remote_address

# Disable rate limiting during automated test execution to prevent 429 in rapid test suites
is_test_env = (
    os.getenv("TESTING", "").lower() in ("true", "1", "yes")
    or "pytest" in sys.modules
    or any("pytest" in arg for arg in sys.argv)
)

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["120/minute"],
    headers_enabled=False,
    enabled=not is_test_env,
)
