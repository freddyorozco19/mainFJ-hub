# -*- coding: utf-8 -*-
"""Módulo de conexión a Google Drive para extractos bancarios."""
from __future__ import annotations
import os
import io
import json
from pathlib import Path
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

CREDS_PATH = Path(__file__).parent / "credentials.json"
SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets",
]

DRIVE_FOLDER_ID = os.getenv("DRIVE_EXTRACTOS_FOLDER_ID", "")


def _get_creds() -> Credentials:
    creds_json = os.getenv("GOOGLE_CREDENTIALS_JSON", "")
    if creds_json:
        creds_info = json.loads(creds_json)
        return Credentials.from_service_account_info(creds_info, scopes=SCOPES)
    return Credentials.from_service_account_file(str(CREDS_PATH), scopes=SCOPES)


def get_service_account_email() -> str:
    creds_json = os.getenv("GOOGLE_CREDENTIALS_JSON", "")
    if creds_json:
        return json.loads(creds_json).get("client_email", "")
    try:
        with open(CREDS_PATH) as f:
            return json.load(f).get("client_email", "")
    except FileNotFoundError:
        return ""


def get_drive_service():
    creds = _get_creds()
    return build("drive", "v3", credentials=creds)


def list_pdfs(folder_id: str | None = None) -> list[dict]:
    """Lista archivos PDF en una carpeta de Drive."""
    fid = folder_id or DRIVE_FOLDER_ID
    if not fid:
        return []

    service = get_drive_service()
    query = f"'{fid}' in parents and mimeType='application/pdf' and trashed=false"
    results = service.files().list(
        q=query,
        fields="files(id, name, size, createdTime, modifiedTime)",
        orderBy="modifiedTime desc",
        pageSize=100,
    ).execute()

    return results.get("files", [])


def list_subfolders(folder_id: str | None = None) -> list[dict]:
    """Lista subcarpetas dentro de una carpeta de Drive."""
    fid = folder_id or DRIVE_FOLDER_ID
    if not fid:
        return []

    service = get_drive_service()
    query = f"'{fid}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
    results = service.files().list(
        q=query,
        fields="files(id, name)",
        orderBy="name",
        pageSize=50,
    ).execute()

    return results.get("files", [])


def download_pdf(file_id: str) -> bytes:
    """Descarga un archivo PDF de Drive y retorna los bytes."""
    service = get_drive_service()
    request = service.files().get_media(fileId=file_id)
    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return buffer.getvalue()
