import base64
import os
from datetime import datetime, timedelta, timezone

import bcrypt
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from jose import jwt

from app.core.config import settings

_BCRYPT_ROUNDS = 12


# ─── Password hashing (bcrypt direct) ────────────────────────────────────────


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ─── JWT ─────────────────────────────────────────────────────────────────────


def create_access_token(data: dict) -> str:
    payload = {
        **data,
        "exp": datetime.now(timezone.utc)
        + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def create_refresh_token(data: dict) -> str:
    payload = {
        **data,
        "exp": datetime.now(timezone.utc)
        + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, settings.JWT_REFRESH_SECRET, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])


def decode_refresh_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_REFRESH_SECRET, algorithms=["HS256"])


# ─── AES-256-CBC encryption ───────────────────────────────────────────────────


def encrypt_aes(plaintext: str) -> str:
    key = bytes.fromhex(settings.ENCRYPTION_KEY)
    iv = os.urandom(16)
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    # PKCS7 padding
    data = plaintext.encode("utf-8")
    pad_len = 16 - len(data) % 16
    data += bytes([pad_len] * pad_len)
    ct = encryptor.update(data) + encryptor.finalize()
    return base64.b64encode(iv + ct).decode("utf-8")


def decrypt_aes(ciphertext: str) -> str:
    key = bytes.fromhex(settings.ENCRYPTION_KEY)
    raw = base64.b64decode(ciphertext)
    iv, ct = raw[:16], raw[16:]
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    decryptor = cipher.decryptor()
    data = decryptor.update(ct) + decryptor.finalize()
    pad_len = data[-1]
    return data[:-pad_len].decode("utf-8")
