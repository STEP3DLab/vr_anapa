"""Run after photo-side.mjs. Green crosses = observed, amber = camera fit, cyan = model."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

folder = Path(__file__).resolve().parent
archive = folder.parents[3] / "mobot-assets/archive"
results = json.loads((folder / "photo-side-v21.json").read_text())
for view in json.loads((folder / "photo-side.json").read_text())["views"]:
    image = Image.open(archive / ("1987-" + view["file"] + ".jpg"))
    scale = 1200 / view["width"]
    image = image.resize((1200, round(view["height"] * scale)), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(image)
    for name, observed in view["centres"].items():
        circle = results[view["id"]]["circles"][name]
        x, y = (v * scale for v in circle["centre"])
        r = circle["radius"] * scale
        draw.ellipse((x-r, y-r, x+r, y+r), outline="#38ceff", width=2)
        u, v = (c * scale for c in observed)
        draw.line((x,y,u,v), fill="white", width=2)
        color = "#ffbd32" if name in view["fit"] else "#60ff60"
        draw.line((u-5,v,u+5,v), fill=color, width=2)
        draw.line((u,v-5,u,v+5), fill=color, width=2)
        draw.text((u-10,v-26),name,fill="white",stroke_width=1,stroke_fill="black")
    draw.rectangle((0,0,670,32), fill="black")
    draw.text((9,9),view["id"]+"  |  v21 projected discs (cyan)   fit (+ amber)   held out (+ green)",fill="white")
    image.save(folder / (view["id"]+"-v21.jpg"), quality=90)
