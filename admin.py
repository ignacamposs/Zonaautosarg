"""
admin.py — Panel de administración de Zona Autos

Local:   python admin.py  →  http://localhost:5000
Railway: detectado automáticamente por GITHUB_TOKEN env var.
         Publica directo al repo de GitHub → Vercel auto-despliega.
"""

import os
import re
import base64
import json as json_module
import tempfile
import threading
import webbrowser
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

import anthropic
from flask import Flask, render_template, request, redirect, url_for, session, flash, send_from_directory

from convertir_autos import (
    autenticar,
    listar_carpetas,
    listar_imagenes,
    descargar_y_convertir,
    siguiente_numero_auto,
    carpeta_ya_procesada,
    marcar_como_procesada,
    slugify,
    formatear_miles,
    actualizar_json,
    generar_html,
    insertar_auto,
    CARPETA_RAIZ_DRIVE,
    CARPETA_IMG as _CARPETA_IMG_LOCAL,
    CARPETA_UNIDADES,
)

# ── Detección de entorno ─────────────────────────────────────────
IS_RAILWAY    = bool(os.getenv("GITHUB_TOKEN"))
GITHUB_REPO   = os.getenv("GITHUB_REPO", "ignacamposs/Zonaautosarg")
GITHUB_BRANCH = os.getenv("GITHUB_BRANCH", "main")

if IS_RAILWAY:
    import convertir_autos as _ca

    # Credenciales Google desde env vars → archivos temporales
    _creds_dir = Path(tempfile.gettempdir()) / "za-creds"
    _creds_dir.mkdir(exist_ok=True)
    (_creds_dir / "credentials.json").write_text(os.getenv("GOOGLE_CREDENTIALS") or "{}")
    (_creds_dir / "token.json").write_text(os.getenv("GOOGLE_TOKEN") or "{}")
    _ca.TOKEN_FILE       = str(_creds_dir / "token.json")
    _ca.CREDENTIALS_FILE = str(_creds_dir / "credentials.json")

    # Fotos van a un directorio temporal
    CARPETA_IMG = Path(tempfile.gettempdir()) / "za-img"
    CARPETA_IMG.mkdir(exist_ok=True)
else:
    CARPETA_IMG = _CARPETA_IMG_LOCAL

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "zonautos-admin-2026")


# ── GitHub helpers (solo Railway) ────────────────────────────────

def _gh_repo():
    from github import Github
    return Github(os.getenv("GITHUB_TOKEN")).get_repo(GITHUB_REPO)


def _gh_get_file(path):
    """Devuelve (contenido_str, sha) o (None, None)."""
    try:
        f = _gh_repo().get_contents(path, ref=GITHUB_BRANCH)
        return f.decoded_content.decode("utf-8-sig"), f.sha
    except Exception:
        return None, None


def _get_procesados():
    content, _ = _gh_get_file(".procesados.json")
    return set(json_module.loads(content)) if content else set()


def _marcar_procesada_gh(folder_id):
    procesados = list(_get_procesados() | {folder_id})
    content = json_module.dumps(procesados)
    _, sha = _gh_get_file(".procesados.json")
    repo = _gh_repo()
    if sha:
        repo.update_file(".procesados.json", "Update procesados", content, sha, branch=GITHUB_BRANCH)
    else:
        repo.create_file(".procesados.json", "Add procesados", content, branch=GITHUB_BRANCH)


def _siguiente_numero_auto_gh():
    """Escanea img/ del repo para determinar el próximo número de auto."""
    try:
        contents = _gh_repo().get_contents("img", ref=GITHUB_BRANCH)
        numeros = set()
        for f in contents:
            m = re.match(r"auto-(\d+)-\d+\.webp", f.name)
            if m:
                numeros.add(int(m.group(1)))
        return max(numeros, default=0) + 1
    except Exception:
        return 1


def _push_auto_to_github(datos, fotos_paths, html_content):
    """Crea un único commit en GitHub con fotos + autos.json + HTML."""
    from github import InputGitTreeElement

    repo        = _gh_repo()
    ref         = repo.get_git_ref(f"heads/{GITHUB_BRANCH}")
    base_commit = repo.get_git_commit(ref.object.sha)
    base_tree   = base_commit.tree

    blobs = []

    # Fotos
    for p in fotos_paths:
        with open(p, "rb") as f:
            blob = repo.create_git_blob(base64.b64encode(f.read()).decode(), "base64")
        blobs.append(InputGitTreeElement(
            path=f"img/{p.name}", mode="100644", type="blob", sha=blob.sha
        ))

    # autos.json — leer del repo, insertar nuevo auto
    autos_content, _ = _gh_get_file("autos.json")
    current_autos = json_module.loads(autos_content) if autos_content else []

    slug     = slugify(f"{datos['marca']} {datos['modelo']}")
    imagenes = [f"img/{p.name}" for p in fotos_paths]
    updated_autos, nuevo_id = insertar_auto(current_autos, datos, imagenes)

    autos_str  = json_module.dumps(updated_autos, ensure_ascii=False, indent=2)
    autos_blob = repo.create_git_blob(base64.b64encode(autos_str.encode()).decode(), "base64")
    blobs.append(InputGitTreeElement(
        path="autos.json", mode="100644", type="blob", sha=autos_blob.sha
    ))

    # HTML de la unidad
    html_blob = repo.create_git_blob(base64.b64encode(html_content.encode()).decode(), "base64")
    blobs.append(InputGitTreeElement(
        path=f"unidades/{slug}.html", mode="100644", type="blob", sha=html_blob.sha
    ))

    # Commit único
    new_tree   = repo.create_git_tree(blobs, base_tree)
    new_commit = repo.create_git_commit(
        f"Agregar {datos['marca']} {datos['modelo']} {datos['anio']}",
        new_tree,
        [base_commit],
    )
    ref.edit(new_commit.sha)

    return nuevo_id, slug


# ── Rutas ────────────────────────────────────────────────────────

@app.route("/")
def home():
    try:
        service  = autenticar()
        carpetas = listar_carpetas(service, CARPETA_RAIZ_DRIVE)
    except Exception as e:
        flash(f"No se pudo conectar con Drive: {e}")
        carpetas = []

    if IS_RAILWAY:
        procesados = _get_procesados()
        nuevas     = [c for c in carpetas if c["id"] not in procesados]
        procesadas = [c for c in carpetas if c["id"] in procesados]
    else:
        nuevas     = [c for c in carpetas if not carpeta_ya_procesada(CARPETA_IMG, c["id"])]
        procesadas = [c for c in carpetas if     carpeta_ya_procesada(CARPETA_IMG, c["id"])]

    return render_template("home.html", nuevas=nuevas, procesadas=procesadas)


@app.route("/saltear/<folder_id>")
def saltear(folder_id):
    if IS_RAILWAY:
        _marcar_procesada_gh(folder_id)
    else:
        marcar_como_procesada(CARPETA_IMG, folder_id)
    return redirect(url_for("home"))


@app.route("/cargar/<folder_id>")
def cargar(folder_id):
    try:
        service  = autenticar()
        carpetas = listar_carpetas(service, CARPETA_RAIZ_DRIVE)
        carpeta  = next((c for c in carpetas if c["id"] == folder_id), None)

        if not carpeta:
            flash("Carpeta no encontrada en Drive.")
            return redirect(url_for("home"))

        imagenes_drive = listar_imagenes(service, folder_id)
        if not imagenes_drive:
            flash(f"La carpeta '{carpeta['name']}' no tiene imágenes.")
            return redirect(url_for("home"))

        imagenes_drive.sort(key=lambda x: x["name"].lower())

        num_auto    = _siguiente_numero_auto_gh() if IS_RAILWAY else siguiente_numero_auto(CARPETA_IMG)
        nombre_auto = f"auto-{num_auto}"
        cant_fotos  = len(imagenes_drive)

        for i, img in enumerate(imagenes_drive, 1):
            destino = CARPETA_IMG / f"{nombre_auto}-{i}.webp"
            if not destino.exists():
                descargar_y_convertir(service, img["id"], img["name"], destino)

        fotos = [f"{nombre_auto}-{i}.webp" for i in range(1, cant_fotos + 1)]

        session["nombre_auto"]    = nombre_auto
        session["cant_fotos"]     = cant_fotos
        session["carpeta_id"]     = folder_id
        session["carpeta_nombre"] = carpeta["name"]

    except Exception as e:
        flash(f"Error al descargar fotos: {e}")
        return redirect(url_for("home"))

    return render_template("form.html",
        carpeta_nombre = carpeta["name"],
        nombre_auto    = nombre_auto,
        cant_fotos     = cant_fotos,
        fotos          = fotos,
    )


@app.route("/publicar", methods=["POST"])
def publicar():
    try:
        precio_raw = request.form["precio"].replace(".", "").replace(",", "").strip()
        precio     = int(precio_raw) if precio_raw else 0

        datos = {
            "marca":       request.form["marca"].strip(),
            "modelo":      request.form["modelo"].strip(),
            "anio":        int(request.form["anio"]),
            "km":          int(request.form["km"]),
            "precio":      precio,
            "moneda":      request.form["moneda"],
            "transmision": request.form["transmision"],
            "combustible": request.form["combustible"],
            "descripcion": request.form["descripcion"].strip(),
        }

        nombre_auto = session["nombre_auto"]
        carpeta_id  = session["carpeta_id"]

        foto_order_raw = request.form.get("foto_order", "")
        fotos_slider   = [f for f in foto_order_raw.split(",") if f.strip()]
        imagenes       = [f"img/{f}" for f in fotos_slider]
        html_content   = generar_html(datos, imagenes)

        if IS_RAILWAY:
            fotos_paths = [CARPETA_IMG / f for f in fotos_slider]
            nuevo_id, slug = _push_auto_to_github(datos, fotos_paths, html_content)
            _marcar_procesada_gh(carpeta_id)
        else:
            nuevo_id  = actualizar_json(datos, imagenes)
            slug      = slugify(f"{datos['marca']} {datos['modelo']}")
            html_path = CARPETA_UNIDADES / f"{slug}.html"
            html_path.write_text(html_content, encoding="utf-8")
            marcar_como_procesada(CARPETA_IMG, carpeta_id)

        session["ultimo_auto"]       = f"{datos['marca']} {datos['modelo']}"
        session["ultimo_id"]         = nuevo_id
        session["ultimo_html"]       = f"{slug}.html"
        session["ultimo_en_railway"] = IS_RAILWAY

    except Exception as e:
        flash(f"Error al publicar: {e}")
        return redirect(url_for("home"))

    return redirect(url_for("exito"))


@app.route("/exito")
def exito():
    return render_template("exito.html",
        nombre     = session.get("ultimo_auto", "Auto"),
        nuevo_id   = session.get("ultimo_id"),
        html_file  = session.get("ultimo_html"),
        en_railway = session.get("ultimo_en_railway", False),
    )


@app.route("/analizar/<filename>")
def analizar(filename):
    try:
        image_path = CARPETA_IMG / filename
        if not image_path.exists():
            return {"error": "Imagen no encontrada"}, 404

        with open(image_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode("utf-8")

        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

        prompt = """Analizá esta imagen que muestra las características de un auto usado en Argentina.
Extraé los datos y devolvé SOLO un JSON válido con este formato exacto:
{
  "marca": "Toyota",
  "modelo": "Corolla XEI",
  "anio": 2022,
  "km": 45000,
  "precio": 28000000,
  "moneda": "ARS",
  "transmision": "Automática",
  "combustible": "Nafta",
  "descripcion": "Version XEI\\n2.0 - 170CV\\nUnica Mano\\nServicios Oficiales"
}

Reglas estrictas:
- moneda: "ARS" para pesos argentinos, "USD" para dólares
- transmision: exactamente "Manual" o "Automática"
- combustible: exactamente "Nafta" o "Diesel"
- precio: número entero sin puntos ni comas (0 si no se ve o dice Consultar)
- km: número entero sin puntos ni comas (0 si es 0km)
- descripcion: características principales separadas por \\n, máximo 6 líneas
- Si no podés leer algún dato con seguridad, dejá "" para texto o 0 para números
- Devolvé SOLO el JSON, sin texto adicional ni markdown"""

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": "image/webp", "data": image_data},
                    },
                    {"type": "text", "text": prompt},
                ],
            }],
        )

        texto = message.content[0].text.strip()
        if "```" in texto:
            texto = texto.split("```")[1]
            if texto.startswith("json"):
                texto = texto[4:]
        return json_module.loads(texto.strip())

    except Exception as e:
        return {"error": str(e)}, 500


@app.route("/img/<filename>")
def imagen(filename):
    return send_from_directory(str(CARPETA_IMG), filename)


# ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    if not IS_RAILWAY:
        threading.Timer(1.2, lambda: webbrowser.open(f"http://localhost:{port}")).start()
        print(f"\n  Zona Autos Admin → http://localhost:{port}\n")
    app.run(host="0.0.0.0", port=port, debug=False)
