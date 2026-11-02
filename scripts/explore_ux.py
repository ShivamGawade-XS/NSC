"""
EarthSift — Playwright Real-Browser Exploration & Journey Diagnostics
Executes real browser runs on Chromium, captures console messages, failed requests,
DOM states, and verifies first-time user journey through to evidence inspection.
"""
import sys
import json
import time
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")

def run_exploration():
    print("=== STARTING PLAYWRIGHT REAL-BROWSER AUDIT ===")
    results = {
        "console_errors": [],
        "console_warnings": [],
        "failed_requests": [],
        "first_time_ux": {},
        "dashboard_initial_state": {},
        "analysis_execution": {},
        "cell_selection": {},
        "evidence_panel": {},
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # Listeners for console and network issues
        page.on("console", lambda msg: (
            results["console_errors"].append(msg.text) if msg.type == "error"
            else (results["console_warnings"].append(msg.text) if msg.type == "warning" else None)
        ))
        page.on("requestfailed", lambda req: results["failed_requests"].append({
            "url": req.url,
            "failure": req.failure
        }))

        # Step 1: Open landing page
        print("[1] Navigating to http://127.0.0.1:8000/ ...")
        t0 = time.time()
        res = page.goto("http://127.0.0.1:8000/", wait_until="load")
        t_load = time.time() - t0
        print(f"Landing page loaded in {t_load:.2f}s with status {res.status if res else 'N/A'}")

        # Check landing page elements
        title = page.title()
        h1 = page.locator("h1").inner_text()
        print(f"Page Title: {title}")
        print(f"H1: {h1}")

        results["first_time_ux"]["title"] = title
        results["first_time_ux"]["h1"] = h1
        results["first_time_ux"]["load_time_seconds"] = round(t_load, 2)

        # Check cookie consent banner
        cookie_banner = page.locator("aside[aria-label='Cookie and Storage Preferences']")
        # Wait for banner entrance timer (1200ms)
        page.wait_for_timeout(1500)
        cookie_visible_after = cookie_banner.is_visible()
        print(f"Cookie banner visible after 1.5s: {cookie_visible_after}")
        results["first_time_ux"]["cookie_banner_appeared"] = cookie_visible_after

        if cookie_visible_after:
            page.locator("button:has-text('Accept Preferences')").click()
            page.wait_for_timeout(300)
            print(f"Cookie banner dismissed: {not cookie_banner.is_visible()}")

        # Check Launch Workspace button
        launch_btn = page.locator("button:has-text('Launch Analysis Workspace')")
        print(f"Launch Analysis Workspace button count: {launch_btn.count()}")

        # Step 2: Navigate to Dashboard
        print("[2] Clicking 'Launch Analysis Workspace'...")
        t0 = time.time()
        launch_btn.first.click()
        page.wait_for_url("**/dashboard", wait_until="load")
        t_nav = time.time() - t0
        print(f"Navigated to /dashboard in {t_nav:.2f}s")

        # Wait for dashboard initial analysis to complete
        print("[3] Waiting for dashboard initial analysis to complete...")
        # In DashboardPage, executeAnalysis() runs on boot.
        # Wait until loading spinner disappears or analysis result card appears
        try:
            page.wait_for_selector(".interface-card", timeout=15000)
            print("Interface cards present!")
            # Wait for 'Computing Trends...' button to detach if it is running
            if page.locator("button:has-text('Computing Trends...')").count() > 0:
                print("Waiting for 'Computing Trends...' to finish...")
                page.wait_for_selector("button:has-text('Computing Trends...')", state="detached", timeout=25000)
            print("Default analysis completed!")
        except Exception as e:
            print(f"Warning waiting for analysis completion: {e}")

        page.wait_for_timeout(2000)

        # Inspect dashboard elements
        dash_title = page.title()
        print(f"Dashboard Title: {dash_title}")

        # Check Leaflet map container
        map_el = page.locator("#map, .leaflet-container")
        print(f"Leaflet container count: {map_el.count()}")

        # Check signals list
        signals = page.locator("button:has-text('#1'), button:has-text('#2')")
        sig_count = signals.count()
        print(f"Candidate signals count in list: {sig_count}")

        # Check Evidence Panel initial text
        ev_header = page.locator("h3:has-text('Evidence Record'), h3:has-text('Scientific Evidence Record')")
        print(f"Evidence Record header found: {ev_header.count() > 0}")

        # Step 3: Click a candidate signal to select cell
        if sig_count > 0:
            print("[4] Clicking first candidate signal (#1)...")
            signals.first.click()
            page.wait_for_timeout(1500)

            # Check if EvidencePanel updated
            hotspot_badge = page.locator(".badge-hotspot, .badge-nominal")
            print(f"Cell badge visible: {hotspot_badge.count() > 0} ({hotspot_badge.first.inner_text() if hotspot_badge.count() > 0 else 'None'})")

            # Check metric scale
            metric_row = page.locator("text=Metric Scale")
            print(f"Metric Scale row present in EvidencePanel: {metric_row.count() > 0}")
            if metric_row.count() > 0:
                print(f"Metric Scale text: {metric_row.locator('xpath=..').inner_text()}")

            # Check Provenance badge
            prov_badge = page.locator("text=Verified NASA CF-1.8 Observations, text=Synthetic test data")
            print(f"Provenance badge count: {prov_badge.count()}")
            if prov_badge.count() > 0:
                print(f"Provenance text: {prov_badge.first.inner_text()}")

            # Check Literature Mechanism & Drivers button
            ai_explain_btn = page.locator("button:has-text('Literature Mechanism & Drivers')")
            print(f"Literature Mechanism button count: {ai_explain_btn.count()}")

        # Step 4: Test a Preset (e.g. Texas Basin)
        print("[5] Testing Preset: Texas Basin...")
        tx_btn = page.locator("button:has-text('Texas Basin')")
        if tx_btn.count() > 0:
            tx_btn.first.click()
            page.wait_for_timeout(1000)
            if page.locator("button:has-text('Computing Trends...')").count() > 0:
                print("Waiting for Texas Basin analysis to complete...")
                page.wait_for_selector("button:has-text('Computing Trends...')", state="detached", timeout=25000)
            print("Texas Basin analysis completed!")
            page.wait_for_timeout(1000)
            signals_tx = page.locator("button:has-text('#1')")
            print(f"Signals count after Texas Basin: {signals_tx.count()}")

        # Print all errors and warnings captured
        print("\n--- CONSOLE ERRORS ---")
        for err in results["console_errors"]:
            print(f"ERROR: {err}")
        if not results["console_errors"]:
            print("None!")

        print("\n--- CONSOLE WARNINGS ---")
        for warn in results["console_warnings"]:
            print(f"WARN: {warn}")

        print("\n--- FAILED REQUESTS ---")
        for req in results["failed_requests"]:
            print(f"FAILED: {req['url']} -> {req['failure']}")
        if not results["failed_requests"]:
            print("None!")

        browser.close()
    print("=== EXPLORATION COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    run_exploration()
