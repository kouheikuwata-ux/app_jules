import os
from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv
import base64

# Load environment variables
load_dotenv()

# Load the secret key from environment
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("No SECRET_KEY set for encryption. Please run generate_key.py and set it in your .env file.")

# Ensure the key is properly encoded
try:
    key = base64.urlsafe_b64decode(SECRET_KEY.encode())
    if len(key) != 32:
        # Fernet keys must be 32 bytes long.
        raise ValueError("SECRET_KEY is not a valid Fernet key.")
    fernet = Fernet(SECRET_KEY.encode())
except (ValueError, TypeError) as e:
    raise ValueError(f"Invalid SECRET_KEY: {e}. Please ensure it is a valid URL-safe base64-encoded 32-byte key.")


def encrypt(data: str) -> str:
    """Encrypts a string."""
    if not data:
        return data
    return fernet.encrypt(data.encode()).decode()

def decrypt(token: str) -> str:
    """Decrypts a token."""
    if not token:
        return token
    try:
        return fernet.decrypt(token.encode()).decode()
    except InvalidToken:
        # Handle cases where the data might not be encrypted (e.g., legacy data)
        # Or if the token is corrupted.
        # For this app, we'll assume if it fails, it might be unencrypted plaintext.
        # A more robust system might log this as an error or handle it differently.
        return token
    except Exception:
        # Broad exception to catch other potential cryptography errors
        # and return the original token to prevent crashes.
        return token
