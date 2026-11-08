// OKURKEN — İngilizce hikâye oku, kelimeye dokun, Türkçesini gör.
"use strict";

const $ = (id) => document.getElementById(id);
const ekran = $("ekran");
const KELIME = /[A-Za-zÀ-ÿĀ-ſ]+(?:'[A-Za-zÀ-ÿĀ-ſ]+)?/g;   // uret.py ile aynı kural

let sozluk = {};        // { "walked": ["yürümek", "walk"], ... }
let liste = [];         // hikâye listesi
const hikayeOnbellek = {};

// ---------- Küçük kayıt yardımcıları (telefonda kalır) ----------
function oku(anahtar, varsayilan) {
  try { const v = localStorage.getItem(anahtar); return v ? JSON.parse(v) : varsayilan; }
  catch { return varsayilan; }
}
function yaz(anahtar, deger) {
  try { localStorage.setItem(anahtar, JSON.stringify(deger)); } catch { /* özel sekme vs. */ }
}

let kayitlilar = oku("okurken.kelimeler", {});   // { "walk": {kelime, anlam, cumle, tarih} }
let ayarlar = oku("okurken.ayarlar", { boyut: 20 });
let ilerleme = oku("okurken.ilerleme", {});      // { hikayeId: kaydirmaOrani }

// ---------- Yazı boyutu ----------
function boyutUygula() {
  document.documentElement.style.setProperty("--boyut", ayarlar.boyut + "px");
}
$("kucult").onclick = () => { ayarlar.boyut = Math.max(15, ayarlar.boyut - 2); boyutUygula(); yaz("okurken.ayarlar", ayarlar); };
$("buyut").onclick  = () => { ayarlar.boyut = Math.min(32, ayarlar.boyut + 2); boyutUygula(); yaz("okurken.ayarlar", ayarlar); };
boyutUygula();

// ---------- Sayfa yönlendirme (#/, #/h/<id>, #/kelimeler) ----------
$("geri").onclick = () => { location.hash = "#/"; };
$("kelimelerBtn").onclick = () => { location.hash = "#/kelimeler"; };
window.addEventListener("hashchange", yonlendir);

function yonlendir() {
  kutuyuKapat();
  const h = location.hash;
  if (h.startsWith("#/h/")) return hikayeEkrani(decodeURIComponent(h.slice(4)));
  if (h === "#/kelimeler") return kelimelerEkrani();
  listeEkrani();
}

function ustBar(baslik, geriVar) {
  $("baslik").textContent = baslik;
  $("geri").hidden = !geriVar;
  const okumada = location.hash.startsWith("#/h/");
  $("kucult").hidden = $("buyut").hidden = !okumada;
}

function sayaciGuncelle() {
  const n = Object.keys(kayitlilar).length;
  $("sayac").textContent = n ? n : "";
}

// ---------- 1) Hikâye listesi ----------
function listeEkrani() {
  ustBar("Okurken", false);
  ekran.innerHTML = "";
  const giris = el("p", "giris", "Bir hikâye seç. Bilmediğin kelimeye dokun, Türkçesi alttan çıksın.");

  // Seviye sekmeleri (A1 · A2 · B1 ...)
  const seviyeler = [...new Set(liste.map((h) => h.seviye))].sort();
  if (!seviyeler.includes(ayarlar.seviye)) ayarlar.seviye = seviyeler[0];
  const sekmeler = el("div", "sekmeler");
  for (const s of seviyeler) {
    const hik = liste.filter((h) => h.seviye === s);
    const biten = hik.filter((h) => sonuclar[h.id]).length;
    const b = el("button", "sekme" + (s === ayarlar.seviye ? " aktif" : ""));
    b.append(el("span", "sekme-ad", s), el("span", "sekme-sayi", `${biten}/${hik.length}`));
    b.onclick = () => { ayarlar.seviye = s; yaz("okurken.ayarlar", ayarlar); listeEkrani(); };
    sekmeler.appendChild(b);
  }

  const kutu = el("div", "liste");
  for (const h of liste.filter((x) => x.seviye === ayarlar.seviye)) {
    const kart = el("button", "kart");
    kart.appendChild(el("h2", "", h.baslik));
    const bilgi = el("div", "bilgi");
    bilgi.appendChild(el("span", "rozet", h.seviye));
    bilgi.appendChild(el("span", "", `${h.kelime} kelime · ~${Math.max(1, Math.round(h.kelime / 150))} dk`));
    const sonuc = sonuclar[h.id];
    if (sonuc) bilgi.appendChild(el("span", "devam", `✓ ${sonuc.puan}/${sonuc.toplam}`));
    else if (ilerleme[h.id] > 0.02 && ilerleme[h.id] < 0.97) bilgi.appendChild(el("span", "devam", "devam et"));
    kart.appendChild(bilgi);
    kart.onclick = () => { location.hash = "#/h/" + encodeURIComponent(h.id); };
    kutu.appendChild(kart);
  }
  ekran.append(giris, sekmeler, kutu,
    el("p", "alt-not", "Sözlük: elle hazırlanmış anlamlar + FreeDict İngilizce–Türkçe (GPL)"));
  window.scrollTo(0, 0);
}

// ---------- 2) Okuma ekranı ----------
async function hikayeEkrani(id) {
  const h = liste.find((x) => x.id === id);
  if (!h) return listeEkrani();
  ustBar(h.baslik, true);
  ekran.innerHTML = "";

  let metin = hikayeOnbellek[id];
  if (!metin) {
    try { metin = await (await fetch(h.dosya)).text(); }
    catch { ekran.appendChild(el("p", "bos-mesaj", "Hikâye açılamadı. İnternet bağlantını kontrol et.")); return; }
    hikayeOnbellek[id] = metin;
  }

  const satirlar = metin.replace(/\r/g, "").replace(/’/g, "'").trim().split("\n");
  const govde = satirlar.slice(2).join("\n");
  const paragraflar = govde.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  const kap = el("article", "hikaye");
  const sev = el("div", "seviye"); sev.appendChild(el("span", "rozet", h.seviye));
  kap.appendChild(sev);

  for (const p of paragraflar) {
    const pEl = document.createElement("p");
    let son = 0;
    for (const m of p.matchAll(KELIME)) {
      if (m.index > son) pEl.appendChild(document.createTextNode(p.slice(son, m.index)));
      const span = el("span", "k", m[0]);
      const anahtar = m[0].toLowerCase();
      const kayit = sozluk[anahtar];
      if (kayitlilar[kok(anahtar, kayit)]) span.classList.add("kayitli");
      pEl.appendChild(span);
      son = m.index + m[0].length;
    }
    if (son < p.length) pEl.appendChild(document.createTextNode(p.slice(son)));
    kap.appendChild(pEl);
  }
  // Tek dinleyici: hangi kelimeye dokunulduysa onu bul
  kap.addEventListener("click", (e) => {
    const span = e.target.closest(".k");
    if (span) kelimeGoster(span);
  });
  ekran.appendChild(kap);
  if (h.sorular) ekran.appendChild(soruBolumu(h));

  // Kaldığın yere dön
  requestAnimationFrame(() => {
    const oran = ilerleme[id] || 0;
    window.scrollTo(0, oran * (document.documentElement.scrollHeight - innerHeight));
  });
  aktifHikaye = id;
}

let aktifHikaye = null;
let kaydirmaZamani;
window.addEventListener("scroll", () => {
  if (!aktifHikaye || !location.hash.startsWith("#/h/")) return;
  clearTimeout(kaydirmaZamani);
  kaydirmaZamani = setTimeout(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    ilerleme[aktifHikaye] = max > 0 ? +(scrollY / max).toFixed(3) : 1;
    yaz("okurken.ilerleme", ilerleme);
  }, 300);
}, { passive: true });

// ---------- Sorular: "Ne kadar anladın?" ----------
let sonuclar = oku("okurken.sonuclar", {});   // { hikayeId: { puan, toplam } }  (en iyi sonuç)

function karistir(dizi) {
  const a = dizi.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function soruBolumu(h) {
  const bolum = el("section", "sorular");
  bolum.appendChild(el("h2", "", "Ne kadar anladın?"));
  const govde = el("div");
  bolum.appendChild(govde);

  (async () => {
    let sorular;
    try { sorular = await (await fetch(h.sorular)).json(); }
    catch { govde.appendChild(el("p", "bos-mesaj", "Sorular yüklenemedi.")); return; }
    ciz();

    function ciz() {
      govde.innerHTML = "";
      let cevaplanan = 0, dogruSayisi = 0;
      const sonucEl = el("div", "sonuc");

      sorular.forEach((s, no) => {
        const kart = el("div", "soru");
        const ust = el("div", "soru-ust");
        ust.appendChild(el("div", "soru-metin", `${no + 1}. ${s.soru}`));
        const trBtn = el("button", "tr-btn", "TR");
        trBtn.setAttribute("aria-label", "Türkçesini göster");
        const trEl = el("div", "soru-tr", s.tr || "");
        trEl.hidden = true;
        trBtn.onclick = () => { trEl.hidden = !trEl.hidden; trBtn.classList.toggle("aktif", !trEl.hidden); };
        if (s.tr) ust.appendChild(trBtn);
        kart.append(ust, trEl);

        const secenekler = el("div", "secenekler");
        const aciklama = el("div", "aciklama");
        aciklama.hidden = true;
        const sirali = karistir(s.secenekler.map((metin, i) => ({ metin, dogru: i === s.dogru })));
        for (const sec of sirali) {
          const b = el("button", "secenek", sec.metin);
          b.onclick = () => {
            secenekler.querySelectorAll("button").forEach((x) => { x.disabled = true; });
            secenekler.querySelectorAll("button").forEach((x, i) => { if (sirali[i].dogru) x.classList.add("dogru"); });
            if (!sec.dogru) {
              b.classList.add("yanlis");
              if (s.kanit) {
                aciklama.textContent = "";
                aciklama.append(el("b", "", "Hikâyede: "), document.createTextNode(s.kanit));
                aciklama.hidden = false;
              }
            } else dogruSayisi++;
            cevaplanan++;
            if (cevaplanan === sorular.length) bitir();
          };
          secenekler.appendChild(b);
        }
        kart.append(secenekler, aciklama);
        govde.appendChild(kart);
      });
      govde.appendChild(sonucEl);

      function bitir() {
        const onceki = sonuclar[h.id];
        if (!onceki || dogruSayisi >= onceki.puan) {
          sonuclar[h.id] = { puan: dogruSayisi, toplam: sorular.length };
          yaz("okurken.sonuclar", sonuclar);
        }
        const oran = dogruSayisi / sorular.length;
        const mesaj = oran === 1 ? "Mükemmel! 🎉" : oran >= 0.6 ? "Güzel! 👍" : "Hikâyeyi bir daha okuyup tekrar dene 💪";
        sonucEl.textContent = "";
        sonucEl.append(el("div", "puan", `${dogruSayisi} / ${sorular.length}`), el("div", "", mesaj));
        const tekrar = el("button", "tekrar", "Tekrar dene");
        tekrar.onclick = ciz;
        sonucEl.appendChild(tekrar);
        sonucEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  })();
  return bolum;
}

// ---------- 3) Kelime kutusu ----------
let secili = null;   // { span, kelime, kok, anlam, cumle }

function kok(anahtar, kayit) { return kayit && kayit[1] ? kayit[1] : anahtar; }

function cumleBul(span) {
  // Dokunulan kelimenin içinde geçtiği cümleyi bul (kaydederken örnek olsun)
  const p = span.parentElement.textContent;
  let bas = 0, i = 0;
  for (const n of span.parentElement.childNodes) { if (n === span) break; i += n.textContent.length; }
  const parcalar = p.split(/(?<=[.!?"])\s+/);
  for (const c of parcalar) {
    if (i < bas + c.length + 1) return c.trim();
    bas += c.length + 1;
  }
  return p.trim();
}

function kelimeGoster(span) {
  if (secili) secili.span.classList.remove("secili");
  const ham = span.textContent;
  const anahtar = ham.toLowerCase();
  const kayit = sozluk[anahtar];
  const k = kok(anahtar, kayit);
  secili = { span, kelime: ham, kok: k, anlam: kayit ? kayit[0] : null, cumle: cumleBul(span) };
  span.classList.add("secili");

  $("kKelime").textContent = ham;
  $("kKok").textContent = k !== anahtar ? `→ ${k}` : "";
  const anlamEl = $("kAnlam");
  anlamEl.textContent = "";
  if (secili.anlam) anlamEl.textContent = secili.anlam;
  else anlamEl.appendChild(el("span", "bos", "Bu kelime sözlükte yok."));
  kaydetDugmesi();
  $("kutu").hidden = false;
  $("perde").hidden = false;
}

function kaydetDugmesi() {
  const var_ = secili && kayitlilar[secili.kok];
  $("kKaydet").textContent = var_ ? "★" : "☆";
  $("kKaydet").classList.toggle("aktif", !!var_);
  $("kKaydet").disabled = !(secili && secili.anlam);
}

function kutuyuKapat() {
  $("kutu").hidden = true;
  $("perde").hidden = true;
  if (secili) secili.span.classList.remove("secili");
  secili = null;
}
$("perde").onclick = kutuyuKapat;

$("kKaydet").onclick = () => {
  if (!secili || !secili.anlam) return;
  if (kayitlilar[secili.kok]) delete kayitlilar[secili.kok];
  else kayitlilar[secili.kok] = { kelime: secili.kok, anlam: secili.anlam, cumle: secili.cumle, tarih: Date.now() };
  yaz("okurken.kelimeler", kayitlilar);
  // Aynı köke sahip bütün kelimelerin altını çiz / kaldır
  document.querySelectorAll(".k").forEach((s) => {
    const a = s.textContent.toLowerCase();
    if (kok(a, sozluk[a]) === secili.kok) s.classList.toggle("kayitli", !!kayitlilar[secili.kok]);
  });
  kaydetDugmesi();
  sayaciGuncelle();
};

// ---------- Sesli okuma (telefonun kendi sesi, internet gerekmez) ----------
function seslendir(metin) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const s = new SpeechSynthesisUtterance(metin);
  s.lang = "en-US";
  s.rate = 0.85;
  const ses = speechSynthesis.getVoices().find((v) => v.lang.startsWith("en"));
  if (ses) s.voice = ses;
  speechSynthesis.speak(s);
}
$("kDinle").onclick = () => { if (secili) seslendir(secili.kelime); };

// ---------- 4) Kelimelerim ----------
function kelimelerEkrani() {
  ustBar("Kelimelerim", true);
  ekran.innerHTML = "";
  const hepsi = Object.values(kayitlilar).sort((a, b) => b.tarih - a.tarih);
  if (!hepsi.length) {
    ekran.appendChild(el("p", "bos-mesaj", "Henüz kelime kaydetmedin.\nOkurken bir kelimeye dokun, ☆ ile kaydet."));
    return;
  }
  for (const k of hepsi) {
    const satir = el("div", "kelime-satir");
    const ic = el("div", "ic");
    ic.appendChild(el("b", "", k.kelime));
    ic.appendChild(el("div", "anlam", k.anlam));
    if (k.cumle) ic.appendChild(el("div", "cumle", k.cumle));
    const dinle = el("button", "yuvarlak", "🔊");
    dinle.setAttribute("aria-label", "Dinle");
    dinle.onclick = () => seslendir(k.kelime);
    const sil = el("button", "sil", "×");
    sil.setAttribute("aria-label", "Sil");
    sil.onclick = () => { delete kayitlilar[k.kelime]; yaz("okurken.kelimeler", kayitlilar); sayaciGuncelle(); kelimelerEkrani(); };
    satir.append(ic, dinle, sil);
    ekran.appendChild(satir);
  }
  window.scrollTo(0, 0);
}

// ---------- Yardımcı ----------
function el(etiket, sinif, yazi) {
  const e = document.createElement(etiket);
  if (sinif) e.className = sinif;
  if (yazi != null) e.textContent = yazi;
  return e;
}

// ---------- Başlat ----------
(async function baslat() {
  try {
    [sozluk, liste] = await Promise.all([
      fetch("sozluk.json").then((r) => r.json()),
      fetch("hikayeler/liste.json").then((r) => r.json()),
    ]);
  } catch {
    ekran.appendChild(el("p", "bos-mesaj",
      "Dosyalar yüklenemedi.\nBilgisayarda denerken dosyaya çift tıklamak yerine yerel sunucu kullan (README'ye bak)."));
    return;
  }
  sayaciGuncelle();
  yonlendir();
})();

// İnternetsiz çalışma (service worker)
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  // Yeni sürüm yüklendiyse sayfayı bir kez yenile (ilk kurulumda değil, sadece güncellemede)
  const guncellemeMi = !!navigator.serviceWorker.controller;
  let yenilendi = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (guncellemeMi && !yenilendi) { yenilendi = true; location.reload(); }
  });
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
