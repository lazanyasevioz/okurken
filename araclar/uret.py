"""
OKURKEN — hikâye listesi ve sözlük üretici.

Yeni hikâye eklemek için:
  1) hikayeler/ klasörüne .txt dosyası koy
       1. satır: başlık
       2. satır: seviye (A1, A2, B1, B2...)
       sonrası : hikâye (paragraflar arasında boş satır)
  2) Çalıştır:  python araclar/uret.py

Script şunları yazar:
  hikayeler/liste.json  -> uygulamadaki hikâye listesi
  sozluk.json           -> sadece hikâyelerde geçen kelimeler
  araclar/eksik.txt     -> sözlükte bulunamayan kelimeler
                           (bunları araclar/ozel_sozluk.json'a elle ekle)

Öncelik: ozel_sozluk.json  >  ana_sozluk.json (FreeDict)
"""
import json, re
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
HIKAYE_DIR = KOK / "hikayeler"
ARAC = KOK / "araclar"

ana = json.loads((ARAC / "ana_sozluk.json").read_text(encoding="utf-8"))
ozel = json.loads((ARAC / "ozel_sozluk.json").read_text(encoding="utf-8"))
ozel = {k: v for k, v in ozel.items() if not k.startswith("_")}

# Düzensiz fiiller ve çoğullar: çekimli hal -> kök
DUZENSIZ = {
    "was": "be", "were": "be", "is": "be", "are": "be", "am": "be", "been": "be", "being": "be",
    "has": "have", "had": "have", "having": "have", "does": "do", "did": "do", "done": "do",
    "went": "go", "gone": "go", "goes": "go", "came": "come", "saw": "see", "seen": "see",
    "took": "take", "taken": "take", "gave": "give", "given": "give", "made": "make",
    "knew": "know", "known": "know", "thought": "think", "brought": "bring", "bought": "buy",
    "found": "find", "told": "tell", "said": "say", "got": "get", "gotten": "get",
    "ran": "run", "sat": "sit", "stood": "stand", "held": "hold", "left": "leave",
    "felt": "feel", "kept": "keep", "slept": "sleep", "met": "meet", "lost": "lose",
    "flew": "fly", "flown": "fly", "drew": "draw", "drawn": "draw", "wrote": "write",
    "written": "write", "broke": "break", "broken": "break", "spoke": "speak",
    "spoken": "speak", "woke": "wake", "woken": "wake", "hit": "hit", "put": "put",
    "shut": "shut", "cut": "cut", "let": "let", "read": "read", "began": "begin",
    "begun": "begin", "bent": "bend", "built": "build", "became": "become",
    "learnt": "learn", "taught": "teach", "caught": "catch", "fought": "fight",
    "sent": "send", "spent": "spend", "heard": "hear", "paid": "pay", "sold": "sell",
    "ate": "eat", "eaten": "eat", "drank": "drink", "drunk": "drink", "fell": "fall",
    "fallen": "fall", "forgot": "forget", "forgotten": "forget", "won": "win",
    "threw": "throw", "thrown": "throw", "grew": "grow", "grown": "grow", "rode": "ride",
    "led": "lead", "lay": "lie", "laid": "lay", "hid": "hide", "hidden": "hide",
    "stole": "steal", "stolen": "steal", "swam": "swim", "sang": "sing", "sung": "sing",
    "rang": "ring", "tied": "tie", "lying": "lie", "dying": "die", "tying": "tie",
    "men": "man", "women": "woman", "children": "child", "feet": "foot", "teeth": "tooth",
    "mice": "mouse", "knees": "knee", "lives": "life", "knives": "knife", "wives": "wife",
    "better": "good", "best": "good", "worse": "bad", "worst": "bad",
    "won't": "will", "can't": "can", "don't": "do", "doesn't": "do", "didn't": "do",
    "isn't": "be", "aren't": "be", "wasn't": "be", "weren't": "be", "couldn't": "could",
    "wouldn't": "would", "shouldn't": "should", "haven't": "have", "hasn't": "have",
    "i'm": "i", "you're": "you", "it's": "it", "that's": "that", "let's": "let",
    "i've": "i", "we're": "we", "they're": "they", "he's": "he", "she's": "she",
}


def adaylar(k: str):
    """Kelimenin olası kök hallerini sırayla üretir."""
    yield k
    if k in DUZENSIZ:
        yield DUZENSIZ[k]
    if k.endswith("'s") or k.endswith("s'"):
        k = k[:-2]; yield k
    kural = [
        ("ies", "y"), ("ied", "y"), ("ves", "f"), ("ves", "fe"), ("es", ""), ("s", ""),
        ("ed", ""), ("ed", "e"), ("d", ""), ("ing", ""), ("ing", "e"),
        ("ier", "y"), ("iest", "y"), ("er", ""), ("est", ""), ("er", "e"), ("est", "e"),
        ("ily", "y"), ("ly", ""), ("ly", "le"), ("ness", ""),
    ]
    for son, yeni in kural:
        if k.endswith(son) and len(k) - len(son) >= 2:
            g = k[: -len(son)] + yeni
            yield g
            if len(g) > 2 and g[-1] == g[-2] and son in ("ed", "ing", "er", "est"):
                yield g[:-1]                      # stopped -> stopp -> stop
    # İngiliz yazımı -> Amerikan yazımı
    for a, b in (("ise", "ize"), ("our", "or"), ("tre", "ter"), ("ised", "ized")):
        if a in k:
            yield from adaylar(k.replace(a, b)) if k.replace(a, b) != k else ()


def bul(k: str):
    for a in adaylar(k):
        if a in ozel:
            return a, ozel[a]
    for a in adaylar(k):
        if a in ana:
            anlamlar = ana[a]
            # FreeDict bazen "became" -> "become" gibi sadece köke yönlendiriyor
            if len(anlamlar) == 1 and anlamlar[0] in ana and anlamlar[0] != a:
                hedef = anlamlar[0]
                return hedef, ozel.get(hedef) or " • ".join(ana[hedef][:3])
            return a, " • ".join(anlamlar[:3])
    return None, None


ana_kullanilan = []   # FreeDict'ten gelen kelimeler (elle kontrol etmek için)


KELIME = re.compile(r"[A-Za-zÀ-ÿ]+(?:'[A-Za-zÀ-ÿ]+)?")

liste, butun = [], set()
for dosya in sorted(HIKAYE_DIR.glob("*.txt")):
    satirlar = dosya.read_text(encoding="utf-8").strip().splitlines()
    baslik, seviye = satirlar[0].strip(), satirlar[1].strip()
    govde = "\n".join(satirlar[2:]).replace("’", "'")   # ’ -> '
    kelimeler = [w.lower() for w in KELIME.findall(govde)]
    butun.update(kelimeler)
    kayit = {"id": dosya.stem, "baslik": baslik, "seviye": seviye,
             "dosya": f"hikayeler/{dosya.name}", "kelime": len(kelimeler)}

    # Sorular: hikayeler/<ad>.sorular.json (isteğe bağlı)
    soru_dosya = dosya.with_name(dosya.stem + ".sorular.json")
    if soru_dosya.exists():
        sorular = json.loads(soru_dosya.read_text(encoding="utf-8"))
        tek_satir = " ".join(govde.split())
        for i, s in enumerate(sorular, 1):
            assert 0 <= s["dogru"] < len(s["secenekler"]), f"{soru_dosya.name} soru {i}: 'dogru' hatalı"
            if s.get("kanit") and " ".join(s["kanit"].split()) not in tek_satir:
                print(f"  UYARI {soru_dosya.name} soru {i}: kanıt cümlesi hikâyede birebir yok")
        kayit["sorular"] = f"hikayeler/{soru_dosya.name}"
        kayit["soruSayisi"] = len(sorular)
    liste.append(kayit)

liste.sort(key=lambda h: (h["seviye"], h["id"]))   # A1 -> B2 sırası

sozluk, eksik = {}, []
for k in sorted(butun):
    kok, anlam = bul(k)
    if anlam is None:
        eksik.append(k); continue
    sozluk[k] = [anlam] if kok == k else [anlam, kok]
    if not any(a in ozel for a in adaylar(k)):
        ana_kullanilan.append(f"{k} => {anlam}")

(HIKAYE_DIR / "liste.json").write_text(json.dumps(liste, ensure_ascii=False, indent=1), encoding="utf-8")
(KOK / "sozluk.json").write_text(json.dumps(sozluk, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
(ARAC / "eksik.txt").write_text("\n".join(eksik), encoding="utf-8")
(ARAC / "kontrol_et.txt").write_text("\n".join(ana_kullanilan), encoding="utf-8")

# Telefondaki kayıtlı sürüm yenilensin diye sw.js'deki sürüm adını güncelle
import time
sw = KOK / "sw.js"
sw.write_text(re.sub(r'okurken-v[\w-]+', f'okurken-v{time.strftime("%Y%m%d-%H%M%S")}',
                     sw.read_text(encoding="utf-8"), count=1), encoding="utf-8")

boyut = (KOK / "sozluk.json").stat().st_size
print(f"{len(liste)} hikâye, {len(butun)} farklı kelime")
print(f"sozluk.json: {len(sozluk)} kelime, {boyut / 1024:.1f} KB")
print(f"eksik: {len(eksik)} kelime -> araclar/eksik.txt")
print(f"FreeDict'ten gelen: {len(ana_kullanilan)} kelime -> araclar/kontrol_et.txt")
