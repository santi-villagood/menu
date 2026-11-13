"""Genera un QR por mesa.

Uso:
  pip install "qrcode[pil]"
  python qr.py https://santi-villagood.github.io/menus/arquestrato/ 12

Crea la carpeta qr_mesas/ con mesa-1.png, mesa-2.png, ...
Con la cantidad en 0 genera un solo QR general (sin mesa).
"""
import sys
from pathlib import Path
import qrcode

if len(sys.argv) < 3:
    sys.exit("Uso: python qr.py <url-del-menu> <cantidad-de-mesas>")

url = sys.argv[1].rstrip("/") + "/"
mesas = int(sys.argv[2])
salida = Path("qr_mesas")
salida.mkdir(exist_ok=True)

def crear(texto, archivo):
    img = qrcode.make(texto, box_size=12, border=3)
    img.save(salida / archivo)
    print("Listo:", archivo, "->", texto)

if mesas == 0:
    crear(url, "qr-general.png")
else:
    for n in range(1, mesas + 1):
        crear(f"{url}?mesa={n}", f"mesa-{n}.png")
