"""
Tek seferlik: FreeDict eng-tur.tei dosyasını sade bir JSON'a çevirir.
Kullanım:  python araclar/freedict_donustur.py yol/eng-tur.tei
Çıktı:     araclar/ana_sozluk.json   { "kelime": ["anlam 1", "anlam 2", ...] }

Kaynak: FreeDict English-Turkish 0.3 (GPL-2.0+), https://freedict.org
"""
import json, re, sys
import xml.etree.ElementTree as ET
from pathlib import Path

NS = "{http://www.tei-c.org/ns/1.0}"
tei = Path(sys.argv[1])
cikti = Path(__file__).with_name("ana_sozluk.json")


def temizle(s: str) -> str:
    s = re.sub(r"\([^)]*\)?", "", s)        # (müz.), (A.B.D.) gibi etiketler
    s = re.sub(r"^[^()]*\)", "", s)          # bölünmüş parantezin kalan ucu: "ging) sis"
    s = s.replace('"', "")
    s = re.sub(r"\s+", " ", s)
    return s.strip(" .;:,-'\"")


sozluk: dict[str, list[str]] = {}
for _, el in ET.iterparse(tei, events=("end",)):
    if el.tag != NS + "entry":
        continue
    orth = el.find(f"{NS}form/{NS}orth")
    if orth is None or not orth.text:
        el.clear(); continue
    kelime = orth.text.strip().lower()
    anlamlar = sozluk.setdefault(kelime, [])
    for sense in el.findall(f"{NS}sense"):
        parcalar = []
        for q in sense.iter(NS + "quote"):
            t = temizle(q.text or "")
            if t and len(t) <= 40 and t not in parcalar:
                parcalar.append(t)
        if parcalar:
            anlam = ", ".join(parcalar[:3])
            if anlam not in anlamlar:
                anlamlar.append(anlam)
    if not anlamlar:
        del sozluk[kelime]
    el.clear()

cikti.write_text(json.dumps(sozluk, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{len(sozluk)} kelime -> {cikti} ({cikti.stat().st_size // 1024} KB)")
