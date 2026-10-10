"""
EarthSift — Host Multi-Core Process Scaling Manager
Scales the EarthSift scientific API directly across local host CPU cores
without requiring Kubernetes or container orchestrators.
"""

import os
import sys
import argparse
import multiprocessing
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(backend_dir))


def main():
    parser = argparse.ArgumentParser(description="Scale EarthSift API on local host hardware.")
    parser.add_argument("--host", default="127.0.0.1", help="Binding host address (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind (default: 8000)")
    parser.add_argument(
        "--workers",
        type=int,
        default=min(4, max(1, os.cpu_count() or 2)),
        help="Number of host worker processes (default: min(4, CPU count))"
    )
    parser.add_argument("--log-level", default="info", help="Logging verbosity (default: info)")
    args = parser.parse_args()

    cpu_total = os.cpu_count() or 1
    print("=" * 65)
    print("  EARTHSIFT — LOCAL HOST MULTI-CORE SCALE ORCHESTRATOR")
    print(f"  Target Host:          {args.host}:{args.port}")
    print(f"  Available Host CPUs:  {cpu_total} Logical Cores")
    print(f"  Active Host Workers:  {args.workers} Worker Processes")
    print(f"  Architecture:         Bare-Metal / Host Native (No Kubernetes)")
    print("=" * 65)

    import uvicorn

    # Change working directory to backend so relative paths resolve cleanly
    os.chdir(str(backend_dir))

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        workers=args.workers,
        log_level=args.log_level,
        access_log=True,
        timeout_keep_alive=30
    )


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
