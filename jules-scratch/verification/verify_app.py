import re
from playwright.sync_api import sync_playwright, Page, expect

def verify_application_state(page: Page):
    """
    Navigates to the application, switches to the carte list,
    and takes a screenshot to verify the UI.
    """
    # 1. Arrange: Go to the application's homepage.
    # The dev server runs on port 5173.
    page.goto("http://localhost:5173/")

    # 2. Act: Click on the "Carte List" tab.
    list_tab = page.get_by_role("tab", name="カルテ一覧")
    expect(list_tab).to_be_visible()
    list_tab.click()

    # 3. Assert: Wait for the content to be loaded.
    # We can wait for the header of the card to be visible.
    expect(page.get_by_role("heading", name="カルテ一覧")).to_be_visible()

    # Also wait for the search and filter controls to be present
    expect(page.get_by_placeholder("顧客名で検索...")).to_be_visible()
    expect(page.get_by_role("button", name="RefreshCw")).to_be_visible()

    # 4. Screenshot: Capture the final result for visual verification.
    page.screenshot(path="jules-scratch/verification/verification.png")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        verify_application_state(page)
        browser.close()

if __name__ == "__main__":
    main()
