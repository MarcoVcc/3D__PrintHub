import {
  applyRequired,
  confirmInstagram,
  copyToClipboard,
  escapeHtml,
  formatPrice,
  getRequiredList,
  openInstagram,
  openMailto,
  qs,
  setupModal,
  showToast
} from "./core.js";

const STORAGE_KEY = "3dprinthub.inquiry-cart";
let items = loadCart();

function loadCart() {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((item) => item && item.slug && item.title && item.color && item.material)
      .map((item) => ({
        id: String(item.id || `${item.slug}::${item.color || ""}::${item.material || ""}`),
        slug: String(item.slug),
        title: String(item.title),
        color: String(item.color || ""),
        material: String(item.material || ""),
        image: String(item.image || ""),
        price: item.price !== null && item.price !== undefined && Number.isFinite(Number(item.price))
          ? Number(item.price)
          : null,
        quantity: Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1)))
      }));
  } catch {
    return [];
  }
}

function saveCart() {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // The current page can still use the in-memory cart if storage is unavailable.
  }
}

function clearCart() {
  items = [];
  saveCart();
  renderCart();
}

function getModalMarkup() {
  return `
    <div class="modal inquiry-cart-modal" id="inquiry-cart-modal" aria-hidden="true">
      <div class="modal-backdrop" data-close></div>
      <div class="modal-card inquiry-cart-card" role="dialog" aria-modal="true" aria-labelledby="inquiry-cart-title">
        <button class="modal-close" type="button" data-close aria-label="Chiudi">×</button>
        <h2 id="inquiry-cart-title">Il tuo carrello</h2>
        <div class="inquiry-cart-items" id="inquiry-cart-items" aria-live="polite"></div>
        <form class="custom-form inquiry-cart-form" id="inquiry-cart-form">
          <div class="form-grid">
            <label>
              <span>Nome</span>
              <input class="input" type="text" name="name" autocomplete="name" required>
            </label>
            <label>
              <span>Email</span>
              <input class="input" type="email" name="email" autocomplete="email" required>
            </label>
          </div>
          <label>
            <span>Note</span>
            <textarea class="input input-textarea" name="notes" placeholder="Tempi, quantità o altri dettagli"></textarea>
          </label>
          <div class="form-actions">
            <button class="btn btn-primary" type="submit" data-cart-channel="email">Invia via email</button>
            <button class="btn btn-ghost" type="button" data-cart-channel="instagram">Invia via Instagram</button>
          </div>
          <p class="muted inquiry-cart-status" id="inquiry-cart-status" role="status" hidden></p>
        </form>
      </div>
    </div>
  `;
}

function renderCart() {
  const count = items.reduce((total, item) => total + item.quantity, 0);
  const countBadge = qs("#inquiry-cart-count");
  const cartLink = qs("#inquiry-cart-toggle");
  const list = qs("#inquiry-cart-items");
  const submitButtons = document.querySelectorAll("[data-cart-channel]");

  if (countBadge) countBadge.textContent = count > 99 ? "99+" : String(count);
  if (cartLink) {
    const label = `Apri il carrello, ${count} ${count === 1 ? "articolo" : "articoli"}`;
    cartLink.setAttribute("aria-label", label);
    cartLink.title = label;
  }
  submitButtons.forEach((button) => {
    button.disabled = items.length === 0;
  });
  if (!list) return;
  if (!items.length) {
    list.innerHTML = `<p class="inquiry-cart-empty">La richiesta è vuota. Apri un prodotto e aggiungilo per chiedere la disponibilità.</p>`;
    return;
  }

  list.innerHTML = items.map((item) => {
    const details = [
      `Colore: ${item.color}`,
      `Materiale: ${item.material}`
    ].join(" · ");
    const price = item.price === null ? "Prezzo su richiesta" : `Prezzo indicativo: ${formatPrice(item.price)}`;
    const image = item.image
      ? `<img src="app/static/catalog/${escapeHtml(item.image)}" alt="" loading="lazy" decoding="async">`
      : `<span class="inquiry-cart-image-placeholder" aria-hidden="true">3D</span>`;

    return `
      <article class="inquiry-cart-item">
        <div class="inquiry-cart-product-image">${image}</div>
        <div class="inquiry-cart-product-info">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(details)}</p>
          <span class="inquiry-cart-price">${escapeHtml(price)}</span>
        </div>
        <div class="inquiry-cart-item-controls" aria-label="Quantità">
          <button type="button" data-cart-action="decrease" data-item-id="${escapeHtml(item.id)}" aria-label="Riduci quantità di ${escapeHtml(item.title)}">−</button>
          <span>${item.quantity}</span>
          <button type="button" data-cart-action="increase" data-item-id="${escapeHtml(item.id)}" aria-label="Aumenta quantità di ${escapeHtml(item.title)}">+</button>
          <button class="inquiry-cart-remove" type="button" data-cart-action="remove" data-item-id="${escapeHtml(item.id)}">Rimuovi</button>
        </div>
      </article>
    `;
  }).join("");
}

function buildRequestMessage(formData) {
  const lines = [
    "Richiesta di disponibilità",
    "",
    `Nome: ${formData.get("name") || ""}`,
    `Email: ${formData.get("email") || ""}`,
    "",
    "Prodotti richiesti:"
  ];

  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.title}`);
    lines.push(`   Quantità: ${item.quantity}`);
    lines.push(`   Colore: ${item.color}`);
    lines.push(`   Materiale: ${item.material}`);
    lines.push(`   ${item.price === null ? "Prezzo su richiesta" : `Prezzo indicativo: ${formatPrice(item.price)}`}`);
  });

  lines.push("", "Note:", formData.get("notes") || "");
  return lines.join("\n");
}

function setupCartControls(site) {
  const list = qs("#inquiry-cart-items");
  const form = qs("#inquiry-cart-form");
  const status = qs("#inquiry-cart-status");
  if (!list || !form) return;

  applyRequired(form, getRequiredList(site, "availability_request"));
  renderCart();

  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cart-action]");
    if (!button) return;
    const item = items.find((entry) => entry.id === button.dataset.itemId);
    if (!item) return;

    if (button.dataset.cartAction === "remove") {
      items = items.filter((entry) => entry.id !== item.id);
    } else if (button.dataset.cartAction === "increase") {
      item.quantity = Math.min(99, item.quantity + 1);
    } else if (button.dataset.cartAction === "decrease") {
      item.quantity = Math.max(1, item.quantity - 1);
    }
    saveCart();
    renderCart();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!items.length || !form.reportValidity()) return;
    const message = buildRequestMessage(new FormData(form));
    clearCart();
    openMailto(site.contact_email, "Richiesta di disponibilità", message);
    if (status) {
      status.textContent = "Si aprirà il programma email per completare la richiesta.";
      status.hidden = false;
    }
  });

  const instagramButton = form.querySelector('[data-cart-channel="instagram"]');
  if (instagramButton) {
    instagramButton.addEventListener("click", () => {
      if (!items.length || !form.reportValidity()) return;
      const message = buildRequestMessage(new FormData(form));
      copyToClipboard(message);
      if (!confirmInstagram("richiesta di disponibilità")) return;
      clearCart();
      openInstagram(site);
      if (status) {
        status.textContent = "Messaggio copiato negli appunti. Incollalo nella chat Instagram.";
        status.hidden = false;
      }
    });
  }
}

function addInquiryItem(product, selection = {}) {
  if (!product || product.is_custom) return;
  const color = String(selection.color || "");
  const material = String(selection.material || "");
  if (!color || !material) {
    showToast("Seleziona colore e materiale prima di aggiungere il prodotto.");
    return;
  }
  const id = `${product.slug}::${color}::${material}`;
  const existing = items.find((item) => item.id === id);

  if (existing) {
    existing.quantity = Math.min(99, existing.quantity + 1);
  } else {
    const image = selection.image || (product.images && product.images.length ? product.images[0].file : "");
    const rawPrice = selection.price;
    items.push({
      id,
      slug: product.slug,
      title: product.title,
      color,
      material,
      image,
      price: rawPrice !== null && rawPrice !== undefined && Number.isFinite(Number(rawPrice))
        ? Number(rawPrice)
        : null,
      quantity: 1
    });
  }

  saveCart();
  renderCart();
  showToast(`${product.title} aggiunto al carrello.`);
}

function setupInquiryCart(site) {
  const nav = qs("#site-nav");
  const actions = qs(".nav-actions") || nav;
  if (actions && !qs("#inquiry-cart-toggle")) {
    const link = document.createElement("a");
    link.id = "inquiry-cart-toggle";
    link.className = "nav-cart js-open-inquiry-cart";
    link.href = "#inquiry-cart";
    link.setAttribute("aria-haspopup", "dialog");
    link.setAttribute("aria-controls", "inquiry-cart-modal");
    link.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <path d="M3 4h2l2.1 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 8H6"></path>
        <circle cx="10" cy="20" r="1"></circle>
        <circle cx="18" cy="20" r="1"></circle>
      </svg>
      <span class="nav-cart-count" id="inquiry-cart-count" aria-live="polite">0</span>
    `;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const topbar = qs(".topbar");
      if (topbar) topbar.classList.remove("is-open");
      qs(".nav-toggle")?.setAttribute("aria-expanded", "false");
    });
    actions.appendChild(link);
  }

  if (!qs("#inquiry-cart-modal")) {
    document.body.insertAdjacentHTML("beforeend", getModalMarkup());
  }

  setupModal("#inquiry-cart-modal", ".js-open-inquiry-cart");
  setupCartControls(site);
}

export { addInquiryItem, setupInquiryCart };
