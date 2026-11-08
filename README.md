# Okurken

İngilizce hikâye oku, kelimeye dokun, Türkçesini gör. İnternetsiz çalışan web uygulaması (PWA); sunucu ve SQL yok.

## Dosyalar
| Dosya | Görevi |
|---|---|
| `index.html` | Sayfanın iskeleti |
| `style.css` | Görünüş (gece modu dahil) |
| `app.js` | Hikâye listesi, kelimeye dokunma, kaydetme, sesli okuma |
| `sozluk.json` | Sadece hikâyelerde geçen kelimeler (otomatik üretilir) |
| `hikayeler/*.txt` | Hikâyeler |
| `hikayeler/liste.json` | Hikâye listesi (otomatik üretilir) |
| `sw.js` | İnternetsiz çalışma |
| `manifest.json`, `ikonlar/` | Ana ekran simgesi ve adı |
| `araclar/` | Bilgisayarda çalışan üretici script'ler (telefona gitmez) |

## Yeni hikâye eklemek
1. `hikayeler/` klasörüne `04-baslik.txt` gibi bir dosya koy:
   ```
   Başlık
   A2
   Hikâyenin ilk paragrafı...

   İkinci paragraf...
   ```
2. Çalıştır: `python araclar/uret.py`
3. `araclar/eksik.txt` → sözlükte bulunamayan kelimeler.
   `araclar/kontrol_et.txt` → FreeDict'ten gelen (kontrol edilmesi iyi olur) kelimeler.
   Düzeltmeleri `araclar/ozel_sozluk.json` dosyasına yaz, script'i tekrar çalıştır.

## Bilgisayarda denemek
Dosyaya çift tıklamak çalışmaz (tarayıcı güvenlik kuralı). Klasörde şunu çalıştır:
```
python -m http.server 8000
```
Sonra tarayıcıda `http://localhost:8000` aç.

## Kaynaklar
- Hikâyeler: özgün metinler.
- Yedek sözlük: FreeDict English–Turkish 0.3 (GPL-2.0+), https://freedict.org
