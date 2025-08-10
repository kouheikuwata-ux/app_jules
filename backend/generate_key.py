from cryptography.fernet import Fernet

def generate_key():
    """Generates a new Fernet key for encryption."""
    key = Fernet.generate_key()
    print("Generated Fernet Key:")
    print(key.decode())
    print("\nCopy this key and paste it into your .env file as the value for SECRET_KEY.")

if __name__ == "__main__":
    generate_key()
