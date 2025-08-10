import re
from playwright.sync_api import sync_playwright, Page, expect

def run_verification(page: Page):
    """
    This script verifies the core functionality of the VoiceInsight app.
    1. Navigates to the app.
    2. Creates a new carte with manual text input.
    3. Verifies the carte appears in the list.
    4. Takes a screenshot of the list.
    5. Deletes the carte to clean up.
    """
    try:
        # 1. Navigate to the app
        print("Navigating to the application...")
        page.goto("http://localhost:5175", timeout=60000)

        # Wait for the main layout to be visible
        expect(page.get_by_role("heading", name="VoiceInsight v3.0 Enhanced")).to_be_visible()
        print("Application loaded.")

        # 2. Create a new carte
        # Go to the "カルテ作成" (Create Carte) tab
        page.get_by_role("tab", name="カルテ作成").click()
        print("Switched to 'Create Carte' tab.")

        # Fill in customer info
        customer_name = "テスト顧客"
        page.get_by_label("お名前 *").fill(customer_name)
        page.get_by_label("フリガナ").fill("テストコキャク")
        page.get_by_label("電話番号").fill("080-9999-8888")
        page.get_by_label("メールアドレス").fill("test.customer@example.com")
        print(f"Filled in customer info for '{customer_name}'.")

        # Fill in counseling content manually
        counseling_text = "カットとカラーをお願いします。色はアッシュ系で、長さはあまり変えずに整える程度でお願いします。"
        page.get_by_placeholder("ここにカウンセリング内容がリアルタイムで文字起こしされます...").fill(counseling_text)
        print("Filled in counseling content.")

        # Click save
        page.get_by_role("button", name="カルテを保存").click()
        print("Save button clicked.")

        # Wait for the success toast message
        expect(page.get_by_text("カルテが正常に保存されました。")).to_be_visible(timeout=15000)
        print("Save success toast appeared.")

        # 3. Verify the carte appears in the list
        # Go to the "カルテ一覧" (Carte List) tab
        page.get_by_role("tab", name="カルテ一覧").click()
        print("Switched to 'Carte List' tab.")

        # Wait for the list to load and find the new carte
        # It might take a moment for the list to refresh
        new_carte_card = page.get_by_role("heading", name=customer_name).first.locator('xpath=./ancestor::div[contains(@class, "card")]')
        expect(new_carte_card).to_be_visible(timeout=10000)
        print(f"Carte for '{customer_name}' found in the list.")

        # Check content of the new carte
        expect(new_carte_card.get_by_text(counseling_text)).to_be_visible()
        print("Counseling content verified in the list item.")

        # 4. Take a screenshot
        screenshot_path = "jules-scratch/verification/verification.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        # 5. Clean up by deleting the carte
        # Use the locator for the new card to find the delete button
        delete_button = new_carte_card.get_by_role("button", name="削除")
        delete_button.click()
        print("Delete button clicked.")

        # Confirm deletion in the dialog
        page.get_by_role("button", name="削除する").click()
        print("Deletion confirmed.")

        # Wait for the success toast message
        expect(page.get_by_text("カルテを削除しました。")).to_be_visible()
        print("Delete success toast appeared.")

        # Verify the card is gone from the list
        expect(new_carte_card).not_to_be_visible()
        print(f"Carte for '{customer_name}' successfully deleted.")

        print("\nVerification successful!")

    except Exception as e:
        print(f"\nAn error occurred during verification: {e}")
        # Take a screenshot on error for debugging
        page.screenshot(path="jules-scratch/verification/error.png")
        raise

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        run_verification(page)
        browser.close()

if __name__ == "__main__":
    main()
