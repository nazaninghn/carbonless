"""
TOTP-based Two-Factor Authentication helpers.
Uses HMAC-based One-Time Password (RFC 6238).
"""
import hmac
import hashlib
import struct
import time
import base64
import os

from .models import TOTPDevice  # noqa: F401


def generate_secret():
    """Generate a random 20-byte secret, base32 encoded"""
    raw = os.urandom(20)
    return base64.b32encode(raw).decode('ascii')


def generate_backup_codes(count=8):
    """Generate one-time backup codes"""
    codes = []
    for _ in range(count):
        code = base64.b32encode(os.urandom(5)).decode('ascii')[:8]
        codes.append(code)
    return codes


def get_totp_uri(secret, username, issuer='Carbonless'):
    """Generate otpauth:// URI for QR code scanning"""
    return f"otpauth://totp/{issuer}:{username}?secret={secret}&issuer={issuer}&algorithm=SHA1&digits=6&period=30"


def verify_totp(secret, code, window=1):
    """Verify a TOTP code. window=1 means ±30 seconds."""
    if not code or not secret:
        return False
    try:
        code = int(code)
    except (ValueError, TypeError):
        return False
    try:
        key = base64.b32decode(secret, casefold=True)
    except Exception:
        return False

    current_time = int(time.time())
    for offset in range(-window, window + 1):
        time_step = (current_time // 30) + offset
        if _generate_code(key, time_step) == code:
            return True
    return False


def _generate_code(key, time_step):
    """Generate a 6-digit TOTP code"""
    msg = struct.pack('>Q', time_step)
    h = hmac.HMAC(key, msg, hashlib.sha1).digest()
    offset = h[-1] & 0x0F
    truncated = struct.unpack('>I', h[offset:offset + 4])[0] & 0x7FFFFFFF
    return truncated % 1000000
