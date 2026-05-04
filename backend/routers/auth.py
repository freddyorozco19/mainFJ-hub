# -*- coding: utf-8 -*-
"""
backend/routers/auth.py — JWT Authentication + Password Reset
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
import hmac
import secrets
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import jwt
from pydantic import BaseModel

from backend.db import get_conn

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = "MainFJ-Dashboard-SecretKey-2026-FJ"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
RESET_TOKEN_EXPIRE_MINUTES = 60  # 1 hour

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Plain text credentials for reliability across environments
USERS_DB = {
    "freddy.orozco729@gmail.com": {
        "id": "1",
        "email": "freddy.orozco729@gmail.com",
        "name": "Freddy J. Orozco",
        "password": "admin123",
    }
}


class Token(BaseModel):
    access_token: str
    token_type: str


class User(BaseModel):
    id: str
    email: str
    name: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


def verify_password(plain_password: str, stored_password: str) -> bool:
    """Constant-time comparison to prevent timing attacks."""
    return hmac.compare_digest(plain_password, stored_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc).replace(tzinfo=None) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_user(email: str) -> Optional[dict]:
    return USERS_DB.get(email)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    user = get_user(email)
    if user is None:
        raise credentials_exception
    return User(id=user["id"], email=user["email"], name=user["name"])


# ── Password Reset Helpers ───────────────────────────────────────────────────

def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)


def store_reset_token(email: str, token: str) -> None:
    expires = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO reset_tokens (email, token, expires_at) VALUES (?, ?, ?)",
            (email, token, expires.isoformat()),
        )
        conn.commit()


def validate_reset_token(token: str) -> Optional[str]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT email, expires_at, used FROM reset_tokens WHERE token = ?",
            (token,),
        ).fetchone()
        if not row:
            return None
        if row["used"]:
            return None
        expires = datetime.fromisoformat(row["expires_at"])
        if datetime.now(timezone.utc).replace(tzinfo=None) > expires:
            return None
        return row["email"]


def mark_token_used(token: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE reset_tokens SET used = 1 WHERE token = ?",
            (token,),
        )
        conn.commit()


def send_reset_email(to_email: str, reset_token: str) -> bool:
    """Send password reset email via SMTP. Returns True if sent successfully."""
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    app_url = os.getenv("APP_URL", "https://mainfj-hub.vercel.app")

    if not all([smtp_host, smtp_user, smtp_pass]):
        print(f"[EMAIL] SMTP not configured. Token for {to_email}: {reset_token}")
        print(f"[EMAIL] Reset URL: {app_url}/reset-password?token={reset_token}")
        return False

    try:
        reset_url = f"{app_url}/reset-password?token={reset_token}"

        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Recuperación de contraseña - MainFJ Hub"
        msg["From"] = smtp_user
        msg["To"] = to_email

        text_body = f"""Hola,

Has solicitado restablecer tu contraseña de MainFJ Hub.

Haz clic en el siguiente enlace para crear una nueva contraseña:
{reset_url}

Este enlace expirará en 1 hora.

Si no solicitaste este cambio, ignora este correo.

Saludos,
MainFJ Hub
"""

        html_body = f"""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #07070F; color: #fff; padding: 40px;">
  <div style="max-width: 500px; margin: 0 auto; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px;">
    <h2 style="color: #60A5FA; margin-top: 0;">MainFJ Hub</h2>
    <p style="color: #94A3B8;">Hola,</p>
    <p style="color: #94A3B8;">Has solicitado restablecer tu contraseña. Haz clic en el botón de abajo para continuar:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{reset_url}" style="display: inline-block; background: linear-gradient(90deg, #2563EB, #9333EA); color: white; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 600;">Restablecer contraseña</a>
    </div>
    <p style="color: #64748B; font-size: 12px;">O copia y pega este enlace:<br><code style="color: #94A3B8;">{reset_url}</code></p>
    <p style="color: #64748B; font-size: 12px;">Este enlace expirará en 1 hora. Si no solicitaste este cambio, ignora este correo.</p>
  </div>
</body>
</html>"""

        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, to_email, msg.as_string())

        print(f"[EMAIL] Reset email sent to {to_email}")
        return True
    except Exception as e:
        print(f"[EMAIL] Failed to send email: {e}")
        return False


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()) -> Token:
    user = get_user(form_data.username)
    if not user or not verify_password(form_data.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user["email"]})
    return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    """Generate a reset token and send it via email."""
    user = get_user(req.email)
    if not user:
        # Always return success to prevent email enumeration
        return {"message": "Si el correo existe, recibirás instrucciones para restablecer tu contraseña."}

    token = generate_reset_token()
    store_reset_token(req.email, token)
    sent = send_reset_email(req.email, token)

    if sent:
        return {"message": "Si el correo existe, recibirás instrucciones para restablecer tu contraseña."}
    else:
        # If SMTP not configured, return token in response for testing
        return {
            "message": "Modo de prueba: SMTP no configurado. Usa el token de abajo.",
            "token": token,
            "reset_url": f"/reset-password?token={token}",
        }


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    """Validate token and update password."""
    email = validate_reset_token(req.token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido o expirado",
        )

    # Update password in memory DB
    if email in USERS_DB:
        USERS_DB[email]["password"] = req.new_password

    mark_token_used(req.token)

    return {"message": "Contraseña actualizada correctamente. Inicia sesión con tu nueva contraseña."}
