"""
convertir_autos.py — Importador completo de autos para Zona Autos

Flujo por cada carpeta nueva en Drive:
  1. Descarga fotos y las convierte a WebP
  2. Te pide los datos del auto por consola
  3. Inserta la entrada al tope de autos.json
  4. Genera unidades/{slug}.html listo para publicar
"""

import io
import os
import re
import json
import unicodedata
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

import pillow_heif
from PIL import Image

pillow_heif.register_heif_opener()

# ── Configuración ────────────────────────────────────────────────
CARPETA_RAIZ_DRIVE = "15tCPVmOT2W2WgdtHDECiF9i72yO488VM"
REPO_ROOT          = Path(r"D:\Desarrollo\Estudio 2026\Zona-autos")
CARPETA_IMG        = REPO_ROOT / "img"
CARPETA_UNIDADES   = REPO_ROOT / "unidades"
AUTOS_JSON         = REPO_ROOT / "autos.json"
CALIDAD_WEBP       = 85
MAX_PX             = 1200  # lado máximo en píxeles

SCOPES             = ["https://www.googleapis.com/auth/drive.readonly"]
TOKEN_FILE         = "token.json"
CREDENTIALS_FILE   = "credentials.json"
# ────────────────────────────────────────────────────────────────


# ── Google Drive ─────────────────────────────────────────────────

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
        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())
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
    extensiones = (".heic", ".heif", ".jpg", ".jpeg", ".png", ".webp")
    return [
        f for f in archivos
        if f["name"].lower().endswith(extensiones)
        or f.get("mimeType", "") in ("image/heic", "image/heif")
    ]


def descargar_y_convertir(service, archivo_id, nombre_original, destino: Path):
    print(f"    ↓ {nombre_original} → {destino.name}")
    request = service.files().get_media(fileId=archivo_id)
    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    buffer.seek(0)
    img = Image.open(buffer)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    if img.width > MAX_PX or img.height > MAX_PX:
        img.thumbnail((MAX_PX, MAX_PX), Image.LANCZOS)
    img.save(destino, "WEBP", quality=CALIDAD_WEBP)


def siguiente_numero_auto(img_dir: Path) -> int:
    numeros = set()
    for archivo in img_dir.glob("auto-*-*.webp"):
        match = re.match(r"auto-(\d+)-\d+\.webp", archivo.name)
        if match:
            numeros.add(int(match.group(1)))
    return max(numeros, default=0) + 1


def carpeta_ya_procesada(img_dir: Path, carpeta_id: str) -> bool:
    return (img_dir / f".procesado_{carpeta_id}").exists()


def marcar_como_procesada(img_dir: Path, carpeta_id: str):
    (img_dir / f".procesado_{carpeta_id}").write_text("ok")


# ── Helpers ──────────────────────────────────────────────────────

def slugify(texto: str) -> str:
    """'Toyota Rav4 VX 4x4' → 'toyota-rav4-vx-4x4'"""
    texto = unicodedata.normalize("NFD", texto.lower())
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    texto = re.sub(r"[^a-z0-9\s-]", "", texto)
    texto = re.sub(r"\s+", "-", texto.strip())
    return texto


def formatear_miles(n: int) -> str:
    """1900000 → '1.900.000'"""
    return f"{n:,}".replace(",", ".")


def pedir(prompt: str, default: str = "") -> str:
    sufijo = f" [{default}]" if default else ""
    valor = input(f"  {prompt}{sufijo}: ").strip()
    return valor if valor else default


def pedir_opcion(prompt: str, opciones: dict) -> str:
    """opciones = {'M': 'Manual', 'A': 'Automática'}"""
    claves = "/".join(opciones.keys())
    while True:
        r = input(f"  {prompt} [{claves}]: ").strip().upper()
        if r in opciones:
            return opciones[r]
        print(f"  ⚠  Opción inválida. Ingresá {claves}.")


# ── Consola: pedir datos del auto ────────────────────────────────

def pedir_datos() -> dict:
    print("\n  ── Datos del auto ──────────────────────────")

    marca  = pedir("Marca (ej: Toyota)")
    modelo = pedir("Modelo (ej: Rav4 VX 4x4)")
    anio   = int(pedir("Año"))
    km     = int(pedir("KM (0 = 0km)"))

    moneda = pedir_opcion("Moneda", {"ARS": "ARS", "USD": "USD"})

    precio_raw = pedir("Precio (0 = Consultar)", "0")
    precio = int(precio_raw.replace(".", "").replace(",", ""))

    transmision = pedir_opcion("Transmisión", {"M": "Manual", "A": "Automática"})
    combustible = pedir_opcion("Combustible",  {"N": "Nafta",  "D": "Diesel"})

    print("  Descripción (Enter vacío para terminar):")
    lineas = []
    while True:
        linea = input("    > ").strip()
        if not linea:
            break
        lineas.append(linea)
    descripcion = "\n ".join(lineas)

    return {
        "marca":       marca,
        "modelo":      modelo,
        "anio":        anio,
        "km":          km,
        "precio":      precio,
        "moneda":      moneda,
        "transmision": transmision,
        "combustible": combustible,
        "descripcion": descripcion,
    }


# ── autos.json ───────────────────────────────────────────────────

def insertar_auto(autos_list: list, datos: dict, imagenes: list) -> tuple:
    """Inserta un auto al tope de la lista. Devuelve (lista_actualizada, nuevo_id)."""
    nuevo_id = max((a.get("id", 0) for a in autos_list), default=0) + 1
    nuevo = {
        "id":          nuevo_id,
        "marca":       datos["marca"],
        "modelo":      datos["modelo"],
        "anio":        datos["anio"],
        "km":          datos["km"],
        "precio":      datos["precio"],
        "moneda":      datos["moneda"],
        "transmision": datos["transmision"],
        "combustible": datos["combustible"],
        "imagenes":    imagenes,
        "descripcion": datos["descripcion"],
    }
    autos_list.insert(0, nuevo)
    return autos_list, nuevo_id


def actualizar_json(datos: dict, imagenes: list) -> int:
    with open(AUTOS_JSON, encoding="utf-8-sig") as f:
        autos = json.load(f)
    updated, nuevo_id = insertar_auto(autos, datos, imagenes)
    with open(AUTOS_JSON, "w", encoding="utf-8") as f:
        json.dump(updated, f, ensure_ascii=False, indent=2)
    return nuevo_id


# ── HTML de unidad ───────────────────────────────────────────────

def generar_html(datos: dict, imagenes: list) -> str:
    marca        = datos["marca"]
    modelo       = datos["modelo"]
    anio         = datos["anio"]
    km           = datos["km"]
    transmision  = datos["transmision"]
    precio       = datos["precio"]
    moneda       = datos["moneda"]
    descripcion  = datos["descripcion"].replace("\n ", "\n")

    nombre_completo = f"{marca} {modelo}"
    slug            = slugify(nombre_completo)
    km_display      = formatear_miles(km) if km > 0 else "0"

    currency_label = "u$s" if moneda == "USD" else "$"

    if precio == 0:
        currency_style = ' style="display: none;"'
        precio_display = "Consultar"
    else:
        currency_style = ""
        precio_display = formatear_miles(precio)

    primera_img = imagenes[0]  # ej: "img/auto-41-3.webp"
    imagenes_js = "\n".join(
        f'                "../{img}",'
        for img in imagenes
    )

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Zona Autos | {nombre_completo}</title>
    <meta name="description" content="Comprá el {nombre_completo} en Zona Autos Bariloche. Fotos, precio y financiación disponible. Consultá por WhatsApp.">
    <link rel="canonical" href="https://zonaautosarg.com/unidades/{slug}.html">
    <meta property="og:title" content="{nombre_completo} {anio} - Zona Autos">
    <meta property="og:image" content="https://zonaautosarg.com/{primera_img}">

    <link rel="stylesheet" href="../style.css">
    <link rel="icon" type="image/svg+xml" href="../favicon.svg">
    <link rel="icon" type="image/x-icon" href="../prueba1.ico">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="../unidad-schema.js" defer></script>
    <script src="../unidad.js" defer></script>
</head>
<body class="bg-[#1a1a1a] text-white selection:bg-red-600">

    <header class="fixed top-0 left-0 w-full z-50 p-4">
        <div class="max-w-6xl mx-auto flex justify-between items-center bg-[#282828]/90 backdrop-blur-md p-4 rounded-full border border-white/5 shadow-2xl">
            <a href="../index.html">
                <img src="../img/logo-zonaautos.avif" alt="Logo" class="h-8 md:h-10">
            </a>
            <a href="../catalogo.html" class="text-[10px] font-bold uppercase tracking-widest bg-red-600 px-4 py-2 rounded-full">Volver al Catálogo</a>
        </div>
    </header>

    <main class="pt-32 pb-20 px-6 max-w-6xl mx-auto">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

            <div class="space-y-4">
                <div class="relative group overflow-hidden rounded-[40px] border border-white/5 shadow-2xl bg-[#282828]">
                    <button onclick="nextPrev(-1)" class="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                    </button>

                    <img id="main-img" src="../{primera_img}" class="w-full aspect-square object-cover transition-all duration-500" alt="{nombre_completo}">

                    <button onclick="nextPrev(1)" class="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                    </button>
                </div>

                <div id="contenedor-thumbs" class="flex gap-3 overflow-x-auto pb-2 thumbnails-container"></div>
            </div>

            <div class="flex flex-col">
                <h1 id="car-name" class="text-6xl font-black text-white italic tracking-tighter uppercase">{nombre_completo}</h1>
                <p id="car-transmision-text" class="text-orange-500 font-bold text-2xl mt-2 italic uppercase">Detalle de unidad</p>

                <div class="mt-10 grid grid-cols-3 gap-4 py-6 border-y border-white/10">
                    <div class="text-center">
                        <span class="block text-gray-500 text-[10px] uppercase font-bold tracking-widest">Año</span>
                        <span id="car-year" class="text-white font-bold text-lg">{anio}</span>
                    </div>
                    <div class="text-center border-x border-white/10">
                        <span class="block text-gray-500 text-[10px] uppercase font-bold tracking-widest">KM</span>
                        <span id="car-km" class="text-white font-bold text-lg">{km_display}</span>
                    </div>
                    <div class="text-center">
                        <span class="block text-gray-500 text-[10px] uppercase font-bold tracking-widest">Caja</span>
                        <span id="car-transmision" class="text-white font-bold text-lg">{transmision}</span>
                    </div>
                </div>

                <div class="mt-8 pt-6">
                    <h3 class="text-sm font-bold text-white uppercase tracking-widest mb-3 italic">Descripción</h3>
                    <p id="car-description" class="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{descripcion}</p>
                </div>

                <div class="mt-10 bg-[#222222] p-8 rounded-3xl border border-white/5">
                    <div class="text-gray-400 text-xs uppercase font-bold mb-2 tracking-widest">Precio Final</div>
                    <div class="text-white mb-8 flex items-baseline">
                        <span id="currency-label" class="text-3xl font-light opacity-50"{currency_style}>{currency_label}</span>
                        <span id="car-price" class="text-3xl sm:text-5xl md:text-6xl font-black ml-3 tracking-tighter">{precio_display}</span>
                    </div>

                    <button onclick="sendWhatsApp()" class="w-full bg-[#25D366] hover:bg-[#128C7E] text-white py-5 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-xl shadow-green-900/20 active:scale-[0.98]">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"></path></svg>
                        Consultar por WhatsApp
                    </button>
                </div>
            </div>
        </div>
    </main>

    <footer class="bg-[#1a1a1a] text-white pt-16 pb-6 px-[5%] border-t-4 border-[#ff6600]">
        <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
            <div class="flex flex-col items-center md:items-start">
                <img src="../img/logo-zonaautos.avif" alt="Logo Zona Autos" class="w-48 mb-6" />
                <p class="text-gray-400 leading-relaxed text-center md:text-left">
                    Líderes en confianza y calidad automotriz desde 2015. 🏎️
                </p>
            </div>

            <div class="text-center md:text-left">
                <h3 class="text-lg font-bold mb-6 uppercase tracking-wider italic">Explorar</h3>
                <ul class="space-y-4 text-gray-400">
                    <li><a href="../catalogo.html" class="hover:text-[#ff6600] transition-colors">Usados Seleccionados</a></li>
                    <li><a href="#" class="hover:text-[#ff6600] transition-colors">Financiación</a></li>
                    <li><a href="../contact.html" class="hover:text-[#ff6600] transition-colors">Vende tu Auto</a></li>
                </ul>
            </div>

            <div class="text-center md:text-left">
                <h3 class="text-lg font-bold mb-6 uppercase tracking-wider italic">Contacto</h3>
                <div class="space-y-4 text-gray-400">
                    <p class="flex items-center justify-center md:justify-start gap-3">📍 Vice Almte. O'Connor 820, Bariloche</p>
                    <p class="flex items-center justify-center md:justify-start gap-3">📞 +54 2944 38-8443</p>
                    <p class="flex items-center justify-center md:justify-start gap-3">📧 Zonaautosbrc@gmail.com</p>
                </div>
            </div>
        </div>
        <div class="mt-16 pt-8 border-t border-gray-800 text-center text-gray-500 text-[10px] uppercase tracking-widest">
            <p>&copy; 2026 Ignacio Campos - Todos los derechos reservados.</p>
        </div>
    </footer>

    <script>
        document.addEventListener('DOMContentLoaded', () => {{
            const fotosDeEsteAuto = [
{imagenes_js}
            ];
            if (typeof initSlider === 'function') {{
                initSlider(fotosDeEsteAuto);
            }}
        }});
    </script>

    <a href="https://wa.me/542944388443" target="_blank" aria-label="Consultar por WhatsApp" class="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#128C7E] text-white p-4 rounded-full shadow-2xl shadow-green-900/40 transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center">
        <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
    </a>

    <script>
        function compartirFicha() {{
            const url = window.location.href;
            const title = document.getElementById('car-name')?.textContent.trim() || document.title;
            if (navigator.share) {{
                navigator.share({{ title: `${{title}} - Zona Autos`, url }});
            }} else {{
                navigator.clipboard.writeText(url).then(() => {{
                    alert('Link copiado al portapapeles');
                }});
            }}
        }}
    </script>
</body>
</html>
"""


# ── Main ─────────────────────────────────────────────────────────

def procesar():
    CARPETA_IMG.mkdir(parents=True, exist_ok=True)
    CARPETA_UNIDADES.mkdir(parents=True, exist_ok=True)

    print("\n═══════════════════════════════════════════")
    print("   Zona Autos — Importador de Autos")
    print("═══════════════════════════════════════════")

    print("\nConectando con Google Drive...")
    service = autenticar()

    carpetas = listar_carpetas(service, CARPETA_RAIZ_DRIVE)
    carpetas_nuevas = [c for c in carpetas if not carpeta_ya_procesada(CARPETA_IMG, c["id"])]

    if not carpetas_nuevas:
        print("\n✓ No hay carpetas nuevas en Drive. Nada que hacer.\n")
        return

    print(f"\nCarpetas nuevas encontradas ({len(carpetas_nuevas)}):")
    for c in carpetas_nuevas:
        print(f"  • {c['name']}")

    for carpeta in carpetas_nuevas:
        print(f"\n{'═'*45}")
        print(f"  {carpeta['name']}")
        print(f"{'═'*45}")

        imagenes_drive = listar_imagenes(service, carpeta["id"])
        if not imagenes_drive:
            print("  ⚠  Sin imágenes. Saltando.")
            marcar_como_procesada(CARPETA_IMG, carpeta["id"])
            continue

        # Ordenar por nombre para que los índices sean correctos
        imagenes_drive.sort(key=lambda x: x["name"].lower())

        num_auto     = siguiente_numero_auto(CARPETA_IMG)
        nombre_auto  = f"auto-{num_auto}"
        cant_fotos   = len(imagenes_drive)

        print(f"\n  Número: {num_auto}  |  Fotos: {cant_fotos}\n")

        for i, img in enumerate(imagenes_drive, 1):
            destino = CARPETA_IMG / f"{nombre_auto}-{i}.webp"
            descargar_y_convertir(service, img["id"], img["name"], destino)

        print(f"\n  ✓ {cant_fotos} fotos convertidas a WebP")

        # Pedir datos
        datos = pedir_datos()

        # Mostrar resumen
        nombre_completo = f"{datos['marca']} {datos['modelo']}"
        slug            = slugify(nombre_completo)
        precio_str      = f"{datos['moneda']} {formatear_miles(datos['precio'])}" if datos['precio'] else "Consultar"

        print(f"\n  ── Resumen ─────────────────────────────────")
        print(f"  Auto    : {nombre_completo} {datos['anio']}")
        print(f"  KM      : {formatear_miles(datos['km'])}")
        print(f"  Precio  : {precio_str}")
        print(f"  Caja    : {datos['transmision']}  |  {datos['combustible']}")
        print(f"  Fotos   : {nombre_auto}-1 … {nombre_auto}-{cant_fotos}")
        print(f"  JSON    : autos.json (tope)")
        print(f"  HTML    : unidades/{slug}.html")
        print(f"  ────────────────────────────────────────────")

        ok = input("  ¿Confirmar y guardar? [S/n]: ").strip().lower()
        if ok == "n":
            print("  ✗ Cancelado. Las fotos WebP ya quedaron en /img.")
            continue

        # Escribir
        imagenes  = [f"img/{nombre_auto}-{i}.webp" for i in range(1, cant_fotos + 1)]
        nuevo_id  = actualizar_json(datos, imagenes)
        print(f"  ✓ autos.json actualizado  (id: {nuevo_id})")

        html_path = CARPETA_UNIDADES / f"{slug}.html"
        html_path.write_text(generar_html(datos, imagenes), encoding="utf-8")
        print(f"  ✓ {html_path.name} creado")

        marcar_como_procesada(CARPETA_IMG, carpeta["id"])
        print(f"\n  ✅  {nombre_completo} publicado correctamente")

    print("\n═══════════════════════════════════════════")
    print("   Proceso terminado.")
    print("═══════════════════════════════════════════\n")


if __name__ == "__main__":
    procesar()
