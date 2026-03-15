# 3D__PrintHub - Static App (GitHub Pages)

## 1) Struttura Attuale (come funziona adesso)

Questa versione e' **solo frontend**: nessun backend, nessun database server.

### Flusso dati
- I contenuti arrivano da file JSON locali:
  - `static_app/data/site.json`
  - `static_app/data/catalog.json`
  - `static_app/data/materials.json`
  - `static_app/data/reviews.json`
- La logica UI e' in `static_app/app/static/js/site.js`.
- Lo stile e' in `static_app/app/static/css/site.css`.

### Pagine
- Home: `static_app/index.html`
- Prodotti: `static_app/products.html`
- Scheda prodotto: `static_app/product.html`
- Materiali e colori: `static_app/materials.html`
- FAQ/Spedizioni: `static_app/faq.html`
- Chi sono: `static_app/about.html`

### Funzionalita principali attive
- Catalogo per categorie con carousel.
- Filtri rapidi in `Prodotti` (categoria/materiale/colore).
- Scheda prodotto con:
  - selezione colore/materiale,
  - cambio immagini,
  - prezzi variante/sconto,
  - mini-gallery,
  - swipe immagini,
  - sticky CTA in basso.
- Sezione "Prodotti simili" sotto ogni scheda prodotto.
- Materiali e colori con anteprima provini + link "Vedi prodotti" filtrati.
- Form richieste (email + Instagram con testo copiato in clipboard).

## 2) Guida Approfondita di Personalizzazione

### A. Dati sito, contatti e campi obbligatori
File: `static_app/data/site.json`

Campi chiave:
- `site_name`: nome brand in header/footer.
- `tagline`: sottotitolo footer.
- `contact_email`: email usata dai `mailto:`.
- `instagram_url`: link profilo.
- `instagram_dm_url`: link diretto chat.
- `required_fields`:
  - `custom_request`: campi obbligatori form personalizzato.
  - `availability_request`: campi obbligatori richiesta disponibilita.

Esempio:
```json
"required_fields": {
  "custom_request": ["name", "contact", "description"],
  "availability_request": ["name", "email"]
}
```

### B. Aggiungere/modificare prodotti
File: `static_app/data/catalog.json`

Ogni prodotto ha questa struttura:
```json
{
  "slug": "moon-lamp",
  "title": "Moon Lamp",
  "category": "Casa e Ufficio",
  "base_price": 28.0,
  "base_discount_price": null,
  "short_description": "Lampada decorativa effetto luna.",
  "description": "Descrizione completa...",
  "availability": "Su ordinazione",
  "dimensions": "14 x 14 x 16 cm",
  "shipping_time": "4-7 giorni lavorativi",
  "shipping_note": "Nota: tempi da concordare...",
  "colors": ["Bianco"],
  "materials": ["PLA"],
  "images": [
    { "file": "MoonLamp_PLA_Bianco_1.jpg", "color": "Bianco", "material": "PLA" }
  ],
  "price_variants": [],
  "featured": false,
  "best_seller": false,
  "is_new": true
}
```

Campi da usare sempre:
- `slug`: univoco, senza spazi (usa minuscolo + trattini).
- `category`: crea la sezione nella pagina Prodotti.
- `best_seller` e `is_new`:
  - `best_seller=true` -> compare in Home "Best seller".
  - `is_new=true` -> compare in Home "Nuovi arrivi".

Prezzi variante:
```json
"price_variants": [
  { "price": 22.0, "discount_price": 19.0, "color": "Rosso", "material": "PLA" }
]
```

### C. Immagini prodotto: dove metterle e naming
Cartella: `static_app/app/static/catalog/`

Formato consigliato:
- `.jpg` / `.jpeg` / `.png` (evita `.HEIC` sul web)
- naming coerente (gia' allineato al tuo standard), es:
  - `IronMan_PLA_RossoNero_1.jpg`
  - `Litofania_PLA_BiancoNero_3.jpg`

Regole importanti:
- Il nome in `images[].file` deve combaciare **esattamente** col file in cartella.
- `images[].color` e `images[].material` devono essere coerenti con `colors[]` e `materials[]`.
- Se vuoi usare WebP opzionale:
  - aggiungi `webp_file` nello stesso oggetto immagine.
  - esempio:
```json
{ "file": "moon.jpg", "webp_file": "moon.webp", "color": "Bianco", "material": "PLA" }
```

### D. Materiali e colori (provini)
File: `static_app/data/materials.json`
Cartella immagini: `static_app/app/static/materials/`

Ogni colore ha:
- `name`
- `sample_image`
- opzionale: `sample_webp_image`

Se il nome colore/materiale coincide con quello usato nel catalogo, il bottone "Vedi prodotti" filtra automaticamente i prodotti giusti.

### E. Recensioni (inserimento manuale)
File: `static_app/data/reviews.json`

Le recensioni visibili stanno in `approved`.
Il sito statico **non** salva recensioni su file da browser.

### F. Modificare testi/layout pagine
- Home: `static_app/index.html`
- Prodotti: `static_app/products.html`
- Scheda prodotto: `static_app/product.html`
- Stile: `static_app/app/static/css/site.css`
- Logica JS: `static_app/app/static/js/site.js`

### G. Avvio locale e deploy
Avvio locale:
```bash
py static_app/run.py
```
Apri:
- `http://127.0.0.1:8000/index.html`

Deploy GitHub Pages:
- fai commit + push del contenuto di `static_app/`.
- verifica cache browser con hard refresh (`Ctrl+F5`).
