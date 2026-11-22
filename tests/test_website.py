
import pytest
from playwright.sync_api import sync_playwright

URL = "http://localhost:8080"


# Browser fixture
@pytest.fixture
def browser_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(URL)
        yield page
        browser.close()


# Test Case 1: Website loading
def test_website_loading(browser_page):
    assert browser_page.title() != ""
    print("Website loaded successfully")


# Test Case 2: Website title
def test_website_title(browser_page):
    assert "StudyBloom" in browser_page.title()
    print("Website title verified")


# Test Case 3: CSS loading
def test_css_loading(browser_page):
    font = browser_page.locator("body").evaluate(
        "(element) => getComputedStyle(element).fontFamily"
    )
    assert font != ""
    print("CSS verified")


# Test Case 4: Navigation
def test_navigation(browser_page):
    assert browser_page.locator("nav").count() > 0
    print("Navigation verified")


# Test Case 5: Page refresh
def test_page_refresh(browser_page):
    browser_page.reload()
    assert browser_page.title() != ""
    print("Page refresh successful")


# Test Case 6: JavaScript errors
def test_javascript_errors(browser_page):
    errors = []

    browser_page.on(
        "pageerror",
        lambda error: errors.append(str(error))
    )

    browser_page.reload()
    browser_page.wait_for_load_state("networkidle")

    assert errors == [], f"JavaScript errors: {errors}"
    print("No JavaScript errors found")
