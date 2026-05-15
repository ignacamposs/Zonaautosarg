import io
import os
import re
import json
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

import pillow_heif
from PIL import Image

pillow_heif.register_heif_opener()

CARPETA_RAIZ_DRIVE = "1Kldd-Srn9PrgdL_NAlNtKww-9aHWywO9"
CARPETA_IMG_REPO = r"D:\Desarrollo\Estudio 2026\Zona-autos\img"
CALIDAD_WEBP = 85

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
TOKEN_FILE = "token.json"
CREDENTIALS_FILE = "credentials.json"


def autenticar():
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, "w") as token:
            token.write(creds.to_json())
    return build("drive", "v3", credentials=creds)


def listar_carpetas(service, parent_id):
    query = (
        f"'{parent_id}' in parents "
        f"and mimeType='application/vnd.google-apps.folder' "
        f"and trashed=false"
    )
    result = service.files().list(q=query, fields="files(id, name)").execute()
    return result.get("files", [])


def listar_imagenes(service, folder_id):
    query = f"'{folder_id}' in parents and trashed=false"
    result = service.files().list(q=query, fields="files(id, name, mimeType)").execute()
    archivos = result.get("files", [])
    extensiones = (".heic", ".heif", ".jpg", ".jpeg", ".png")
    return [
        f for f in archivos
        if f["name"].lower().endswith(extensiones)
        or f.get("mimeType", "") in ("image/heic", "image/heif")
    ]


def siguiente_numero_auto(img_dir: Path) -> int:
    numeros = set()
    for archivo in img_dir.glob("auto-*-*.webp"):
        match = re.match(r"auto-(\d+)-\d+\.webp", archivo.name)
        if match:
            numeros.add(int(match.group(1)))
    return max(numeros, default=0) + 1


def carpeta_ya_procesada(img_dir: Path, carpeta_drive_id: str) -> bool:
    return (img_dir / f".procesado_{carpeta_drive_id}").exists()


def marcar_como_procesada(img_dir: Path, carpeta_drive_id: str):
    (img_dir / f".procesado_{carpeta_drive_id}").write_text("ok")


def descargar_y_convertir(service, archivo_id, nombre_original, destino: Path):
    print(f"    ↓ Descargando {nombre_original}...")
    request = service.files().get_media(fileId=archivo_id)
    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    buffer.seek(0)

    print(f"    → Convirtiendo a WebP: {destino.name}")
    img = Image.open(buffer)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    img.save(destino, "WEBP", quality=CALIDAD_WEBP)


def generar_json_preview(nombre_auto: str, cantidad_fotos: int) -> str:
    imagenes = [f"img/{nombre_auto}-{i}.webp" for i in range(1, cantidad_fotos + 1)]
    bloque = {
        "id": "← COMPLETAR (número único)",
        "marca": "← COMPLETAR",
        "modelo": "← COMPLETAR",
        "anio": "← COMPLETAR",
        "km": 0,
        "precio": 0,
        "transmision": "← Manual / Automática",
        "combustible": "← Nafta / Diesel",
        "imagenes": imagenes,
        "descripcion": "← COMPLETAR"
    }
    return json.dumps(bloque, ensure_ascii=False, indent=2)


def procesar():
    img_dir = Path(CARPETA_IMG_REPO)
    img_dir.mkdir(parents=True, exist_ok=True)

    print("Conectando con Google Drive...")
    service = autenticar()

    carpetas = listar_carpetas(service, CARPETA_RAIZ_DRIVE)
    if not carpetas:
        print("Marcando todas las carpetas existentes como procesadas...")
        return

    print(f"Marcando {len(carpetas)} carpeta(s) como ya procesadas...\n")

    for carpeta in carpetas:
        marcar_como_procesada(img_dir, carpeta["id"])
        print(f"✓ Marcada: {carpeta['name']}")

    print("\nListo. De ahora en adelante solo se procesarán carpetas nuevas.")


if __name__ == "__main__":
    procesar()