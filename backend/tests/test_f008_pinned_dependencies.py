"""
Tests for F-008: Pinned Dependencies with Cryptographic Hashes.
Verifies supply-chain security (OWASP Top 10:2025 A03) by ensuring production dependencies
are strictly pinned with SHA256 hashes and Dockerfile specifies --require-hashes.
"""
from pathlib import Path


def test_requirements_in_and_txt_exist():
    """Verify requirements.in and compiled requirements.txt exist in backend."""
    base_dir = Path(__file__).resolve().parent.parent
    req_in = base_dir / "requirements.in"
    req_txt = base_dir / "requirements.txt"

    assert req_in.exists(), "requirements.in must exist"
    assert req_txt.exists(), "requirements.txt must exist"


def test_requirements_txt_is_strictly_pinned_with_hashes():
    """Verify requirements.txt has no unpinned >= dependencies and contains sha256 hashes."""
    base_dir = Path(__file__).resolve().parent.parent
    req_txt = base_dir / "requirements.txt"

    content = req_txt.read_text(encoding="utf-8")
    lines = content.splitlines()

    # Filter non-comment, non-empty package lines
    package_lines = [
        line.strip() for line in lines
        if line.strip() and not line.strip().startswith("#") and not line.strip().startswith("--hash")
    ]

    assert len(package_lines) > 0, "requirements.txt must contain packages"
    for line in package_lines:
        assert ">=" not in line, f"Unpinned `>=` found in requirements.txt: {line}"
        assert "==" in line, f"Expected pinned `==` version in requirements.txt: {line}"

    assert "--hash=sha256:" in content, "requirements.txt must contain sha256 distribution hashes"


def test_dockerfile_enforces_require_hashes():
    """Verify Dockerfile enforces pip install with --require-hashes."""
    dockerfile = Path(__file__).resolve().parent.parent.parent / "Dockerfile"
    assert dockerfile.exists(), "Dockerfile must exist in repo root"

    content = dockerfile.read_text(encoding="utf-8")
    assert "--require-hashes" in content, "Dockerfile must use --require-hashes when installing requirements"
