import sys
import base64

# Windows-only DPAPI import check
try:
    import win32crypt
except ImportError:
    win32crypt = None

def encrypt_data(plain_text: str) -> str:
    """Encrypts plain text using Windows DPAPI.
    
    If not running on Windows, falls back to base64 encoding (for testing/development).
    
    Args:
        plain_text: The string to encrypt.
        
    Returns:
        The base64 encoded encrypted cipher text.
    """
    if not plain_text:
        return ""
    
    data_bytes = plain_text.encode('utf-8')
    
    if win32crypt is not None and sys.platform == 'win32':
        # CryptProtectData(data, description, entropy, reserved, prompt_struct, flags)
        encrypted_bytes = win32crypt.CryptProtectData(data_bytes, None, None, None, None, 0)
        return base64.b64encode(encrypted_bytes).decode('utf-8')
    
    # Fallback for dev environments outside Windows
    return base64.b64encode(data_bytes).decode('utf-8')

def decrypt_data(cipher_text: str) -> str:
    """Decrypts cipher text using Windows DPAPI.
    
    Args:
        cipher_text: The base64 encoded cipher text to decrypt.
        
    Returns:
        The decrypted plain text string.
    """
    if not cipher_text:
        return ""
    
    encrypted_bytes = base64.b64decode(cipher_text.encode('utf-8'))
    
    if win32crypt is not None and sys.platform == 'win32':
        # CryptUnprotectData(data, entropy, reserved, prompt_struct, flags)
        _, decrypted_bytes = win32crypt.CryptUnprotectData(encrypted_bytes, None, None, None, 0)
        return decrypted_bytes.decode('utf-8')
    
    # Fallback decryption
    return encrypted_bytes.decode('utf-8')
