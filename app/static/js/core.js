const DATA_DIR = "data";
const ASSET_DIR = "app/static";

const state = {
  site: null,
  catalog: null,
  materials: null,
  reviews: null
};

const PRODUCT_SLUG_ALIASES = {
  "mini-cavaliere": "ironman-pla-rosso-nero",
  "ironman": "ironman-pla-rosso-nero",
  "IronMan_PLA_RossoNero": "ironman-pla-rosso-nero",
  "Litofania_PLA_BiancoNero": "litofania-personalizzata"
};

const qs = (selector, scope = document) => scope.querySelector(selector);
const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

const formatPrice = (value) => `EUR ${Number(value).toFixed(2)}`;
const formatAvailability = (value) => value || "";
const asString = (value) => (value === null || value === undefined ? "" : String(value));
const escapeHtml = (value) =>
  asString(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const isCustomProduct = (product) => Boolean(product && product.is_custom);
const getSaleProducts = (products) => (Array.isArray(products) ? products.filter((p) => !isCustomProduct(p)) : []);
const getCustomProducts = (products) => (Array.isArray(products) ? products.filter((p) => isCustomProduct(p)) : []);

function buildOptimizedImageMarkup(folder, file, alt, options = {}) {
  if (!file) return `<div class="placeholder">Foto</div>`;
  const imgSrc = `${ASSET_DIR}/${folder}/${file}`;
  const webpFile = options.webpFile || "";
  const webpSrc = webpFile ? `${ASSET_DIR}/${folder}/${webpFile}` : "";
  const loading = options.loading || "lazy";
  const decoding = options.decoding || "async";
  const className = options.className ? ` class="${escapeHtml(options.className)}"` : "";
  const altText = escapeHtml(alt || "");
  const fetchpriority = options.fetchpriority ? ` fetchpriority="${escapeHtml(options.fetchpriority)}"` : "";

  const imgTag = `<img${className} src="${imgSrc}" alt="${altText}" loading="${loading}" decoding="${decoding}"${fetchpriority}>`;
  if (!webpSrc) return imgTag;
  return `<picture><source srcset="${webpSrc}" type="image/webp">${imgTag}</picture>`;
}

function showToast(message) {
  if (!message) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}

async function loadJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Impossibile caricare ${path}`);
  }
  return res.json();
}

async function getSite() {
  if (!state.site) {
    state.site = await loadJson(`${DATA_DIR}/site.json`);
  }
  return state.site;
}

async function getCatalog() {
  if (!state.catalog) {
    state.catalog = await loadJson(`${DATA_DIR}/catalog.json`);
  }
  return state.catalog;
}

async function getMaterials() {
  if (!state.materials) {
    state.materials = await loadJson(`${DATA_DIR}/materials.json`);
  }
  return state.materials;
}

async function getReviews() {
  if (!state.reviews) {
    state.reviews = await loadJson(`${DATA_DIR}/reviews.json`);
  }
  return state.reviews;
}

function applySiteData(site) {
  qsa("[data-site-name]").forEach((el) => {
    if (site.site_name) el.textContent = site.site_name;
  });
  qsa("[data-site-tagline]").forEach((el) => {
    if (site.tagline) {
      el.textContent = site.tagline;
    } else {
      el.remove();
    }
  });
  qsa("[data-site-instagram]").forEach((el) => {
    if (site.instagram_url) {
      el.href = site.instagram_url;
      el.style.display = "";
    } else {
      el.style.display = "none";
    }
  });
  qsa("[data-site-email]").forEach((el) => {
    if (site.contact_email) {
      el.href = `mailto:${site.contact_email}`;
      el.style.display = "";
    } else {
      el.style.display = "none";
    }
  });
}

function setupNavMenu() {
  const topbar = qs(".topbar");
  const nav = qs(".nav", topbar || document);
  if (!topbar || !nav) return;

  let toggle = qs(".nav-toggle", topbar);
  if (!toggle) {
    toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "nav-toggle";
    toggle.setAttribute("aria-label", "Apri menu");
    toggle.innerHTML = "<span></span><span></span><span></span>";
    topbar.querySelector(".container")?.insertBefore(toggle, nav);
  }

  let actions = qs(".nav-actions", topbar);
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "nav-actions";
    nav.insertAdjacentElement("afterend", actions);
  }
  if (toggle.parentElement !== actions) actions.appendChild(toggle);

  if (!nav.id) nav.id = "site-nav";
  toggle.setAttribute("aria-controls", nav.id);
  toggle.setAttribute("aria-expanded", "false");

  function setOpen(open) {
    topbar.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  toggle.addEventListener("click", () => {
    setOpen(!topbar.classList.contains("is-open"));
  });

  qsa("a", nav).forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });

  document.addEventListener("click", (event) => {
    if (!topbar.classList.contains("is-open")) return;
    if (topbar.contains(event.target)) return;
    setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) setOpen(false);
  });
}

function openMailto(email, subject, body) {
  if (!email) return;
  const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
}

function getRequiredList(site, key) {
  if (!site || !site.required_fields) return [];
  const list = site.required_fields[key];
  return Array.isArray(list) ? list : [];
}

function applyRequired(form, requiredList) {
  if (!form || !Array.isArray(requiredList)) return;
  const fields = qsa("input, select, textarea", form);
  fields.forEach((field) => {
    const name = field.getAttribute("name");
    if (!name) return;
    const required = requiredList.includes(name);
    field.required = required;
    if (required) {
      field.setAttribute("required", "");
    } else {
      field.removeAttribute("required");
    }

    const label = field.closest("label");
    const labelText = label ? qs("span", label) : null;
    if (!labelText) return;
    const base = labelText.dataset.baseText || labelText.textContent.replace(/\s*\*$/, "").trim();
    labelText.dataset.baseText = base;
    labelText.textContent = base;
    if (required) {
      const mark = document.createElement("span");
      mark.className = "required-mark";
      mark.textContent = " *";
      labelText.appendChild(mark);
    }
  });
}

function ensureValid(form) {
  if (!form) return false;
  if (typeof form.reportValidity === "function") {
    return form.reportValidity();
  }
  return true;
}

function copyToClipboard(message) {
  if (message && navigator.clipboard) {
    navigator.clipboard.writeText(message).catch(() => {});
  }
}

function confirmInstagram(label) {
  const subject = label || "richiesta";
  const message =
    `Verrai reindirizzato alla chat Instagram.\n` +
    `I dati della ${subject} sono stati copiati negli appunti e andranno incollati manualmente nella chat.\n\n` +
    "Vuoi continuare?";
  return window.confirm(message);
}

function getInstagramAppUrl(site) {
  const usernameMatch = (site.instagram_url || site.instagram_dm_url || "").match(/instagram\.com\/(?:_u\/|p\/|stories\/|direct\/|tv\/)?([a-zA-Z0-9._]+)/i);
  if (usernameMatch) {
    return `instagram://user?username=${usernameMatch[1]}`;
  }
  return "instagram://";
}

function openInstagram(site) {
  const webUrl = site.instagram_dm_url || site.instagram_url || "https://instagram.com";
  const appUrl = site.instagram_app_url || getInstagramAppUrl(site);

  let didOpenApp = false;
  const fallback = () => {
    if (!didOpenApp) {
      didOpenApp = true;
      window.location.href = webUrl;
    }
  };

  window.location.href = appUrl;
  setTimeout(fallback, 600);
}

function setupModal(modalId, openSelector) {
  const modal = qs(modalId);
  if (!modal) return;
  const openButtons = qsa(openSelector);
  const closeTargets = qsa("[data-close]", modal);

  function open() {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function close() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  openButtons.forEach((btn) => btn.addEventListener("click", open));
  closeTargets.forEach((btn) => btn.addEventListener("click", close));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
    }
  });
}

function setupCustomForm(site) {
  const form = qs("#custom-form");
  const status = qs("#custom-status");
  const igButton = form ? form.querySelector("[data-channel=\"instagram\"]") : null;
  if (!form) return;
  applyRequired(form, getRequiredList(site, "custom_request"));

  function buildMessage(data) {
    return [
      "Richiesta personalizzata",
      "",
      `Nome: ${data.get("name") || ""}`,
      `Contatto: ${data.get("contact") || ""}`,
      `Tipo progetto: ${data.get("project_type") || ""}`,
      `Quantita: ${data.get("quantity") || ""}`,
      `Colori: ${data.get("colors") || ""}`,
      `Materiali: ${data.get("materials") || ""}`,
      `Budget: ${data.get("budget") || ""}`,
      `Tempistica: ${data.get("deadline") || ""}`,
      "",
      "Descrizione:",
      data.get("description") || "",
      "",
      `Link: ${data.get("reference_link") || ""}`
    ].join("\n");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!ensureValid(form)) return;
    const data = new FormData(form);
    const body = buildMessage(data);
    openMailto(site.contact_email, "Richiesta personalizzata", body);
    if (status) status.hidden = false;
    showToast("Richiesta inviata.");
  });

  if (igButton) {
    igButton.addEventListener("click", () => {
      if (!ensureValid(form)) return;
      const data = new FormData(form);
      const body = buildMessage(data);
      copyToClipboard(body);
      if (!confirmInstagram("richiesta personalizzata")) return;
      openInstagram(site);
      if (status) status.hidden = false;
      showToast("Messaggio copiato negli appunti. Incollalo nella chat Instagram.");
    });
  }
}
export {
  ASSET_DIR,
  PRODUCT_SLUG_ALIASES,
  applyRequired,
  applySiteData,
  buildOptimizedImageMarkup,
  confirmInstagram,
  copyToClipboard,
  escapeHtml,
  formatAvailability,
  formatPrice,
  getCatalog,
  getCustomProducts,
  getMaterials,
  getRequiredList,
  getReviews,
  getSaleProducts,
  getSite,
  isCustomProduct,
  openInstagram,
  openMailto,
  qs,
  qsa,
  setupCustomForm,
  setupModal,
  setupNavMenu,
  showToast
};
