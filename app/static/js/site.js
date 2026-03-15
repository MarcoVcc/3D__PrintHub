(() => {
  const DATA_DIR = "data";
  const ASSET_DIR = "app/static";

  const COLOR_SWATCHES = {
    "Verde acqua": { bg: "#7fd1c9", text: "#0f2a2c" },
    "Verde erba": { bg: "#5f9f5b", text: "#ffffff" },
    "Bianco opaco": { bg: "#f5f5f5", text: "#333333" },
    "Bianco": { bg: "#f4f4f4", text: "#2a2a2a" },
    "Terracotta": { bg: "#c97a5b", text: "#ffffff" },
    "Sabbia": { bg: "#e8d6c0", text: "#5b4a3a" },
    "Nero opaco": { bg: "#1f1f1f", text: "#f0f0f0" },
    "Nero": { bg: "#1b1b1b", text: "#f5f5f5" },
    "Verde scuro": { bg: "#2e5d50", text: "#f0fff9" },
    "Grigio pietra": { bg: "#bfc3c7", text: "#2b2e33" },
    "Multicolor": { bg: "linear-gradient(135deg, #f16f6f 0%, #f2c84b 32%, #7fb6e8 68%, #7fd1c9 100%)", text: "#10263a" },
    "Blu": { bg: "#7fb6e8", text: "#0f2a2c" },
    "Rosso": { bg: "#e38b7a", text: "#2b1a15" },
    "Rosa": { bg: "#f2b8c6", text: "#3a2530" },
    "Argento": { bg: "#d2d7dc", text: "#243140" }
  };

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
  const asString = (value) => (value === null || value === undefined ? "" : String(value));
  const escapeHtml = (value) =>
    asString(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

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

  function openInstagram(site) {
    const url = site.instagram_dm_url || site.instagram_url || "https://instagram.com";
    window.open(url, "_blank", "noopener");
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

  function renderFeatured(grid, products) {
    if (!grid) return;
    grid.innerHTML = products.map((p) => {
      const firstImage = p.images && p.images.length ? p.images[0] : null;
      const img = firstImage
        ? buildOptimizedImageMarkup("catalog", firstImage.file, p.title, {
            webpFile: firstImage.webp_file,
            loading: "lazy",
            decoding: "async"
          })
        : `<div class="placeholder">Foto</div>`;
      return `<a class="featured-card" href="product.html?slug=${encodeURIComponent(p.slug)}">${img}<span class="featured-title">${p.title}</span></a>`;
    }).join("");
  }

  function buildPriceBlock(product, priceBlock) {
    const priceOld = qs("#price-old", priceBlock);
    const priceCurrent = qs("#price-current", priceBlock);
    const priceDiscount = qs("#price-discount", priceBlock);
    const basePrice = product.base_price;
    const baseDiscount = product.base_discount_price;

    if (baseDiscount && baseDiscount < basePrice) {
      priceBlock.classList.add("is-discounted");
      priceOld.style.display = "inline";
      priceOld.textContent = formatPrice(basePrice);
      priceCurrent.textContent = formatPrice(baseDiscount);
      const percent = Math.round((1 - baseDiscount / basePrice) * 100);
      priceDiscount.style.display = "inline";
      priceDiscount.textContent = `-${percent}%`;
    } else {
      priceBlock.classList.remove("is-discounted");
      priceOld.style.display = "none";
      priceDiscount.style.display = "none";
      priceCurrent.textContent = formatPrice(basePrice);
    }
  }

  function renderProductCard(product) {
    const firstImage = product.images && product.images.length ? product.images[0] : null;
    const img = firstImage
      ? buildOptimizedImageMarkup("catalog", firstImage.file, product.title, {
          webpFile: firstImage.webp_file,
          loading: "lazy",
          decoding: "async"
        })
      : `<div class="placeholder">Foto</div>`;
    const hasDiscount = product.base_discount_price && product.base_discount_price < product.base_price;
    const priceHtml = hasDiscount
      ? `<span class="price-old">${formatPrice(product.base_price)}</span>
         <span class="price-current">${formatPrice(product.base_discount_price)}</span>
         <span class="price-discount">-${Math.round((1 - product.base_discount_price / product.base_price) * 100)}%</span>`
      : `<span class="price-current">${formatPrice(product.base_price)}</span>`;
    const badge = product.availability
      ? `<span class="badge ${product.availability === "Disponibile" ? "badge-available" : "badge-order"}">${product.availability}</span>`
      : "";

    return `
      <a class="card card-link" href="product.html?slug=${encodeURIComponent(product.slug)}">
        ${img}
        <div class="card-body">
          <div class="card-head">
            <h3>${product.title}</h3>
            <div class="price-block ${hasDiscount ? "is-discounted" : ""}">
              ${priceHtml}
            </div>
          </div>
          <p>${product.short_description || ""}</p>
          <div class="card-meta">${badge}</div>
        </div>
      </a>
    `;
  }

  function getUniqueValues(products, key) {
    const values = new Set();
    products.forEach((product) => {
      if (key === "category" && product.category) {
        values.add(product.category);
      }
      if (key === "material") {
        (product.materials || []).forEach((material) => {
          if (material) values.add(material);
        });
      }
      if (key === "color") {
        (product.colors || []).forEach((color) => {
          if (color) values.add(color);
        });
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, "it"));
  }

  function updateProductsQuery(category, material) {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (material) params.set("material", material);
    const query = params.toString();
    const next = query ? `products.html?${query}` : "products.html";
    window.history.replaceState({}, "", next);
  }

  function renderQuickFilters(products, selectedCategory, selectedMaterial) {
    const container = qs("#quick-filters");
    if (!container) return;

    const categories = getUniqueValues(products, "category");
    const materials = getUniqueValues(products, "material");

    const categoryOptions = [
      `<option value="">Tutte le categorie</option>`,
      ...categories.map((value) => `<option value="${escapeHtml(value)}"${selectedCategory === value ? " selected" : ""}>${escapeHtml(value)}</option>`)
    ].join("");

    const materialOptions = [
      `<option value="">Tutti i materiali</option>`,
      ...materials.map((value) => `<option value="${escapeHtml(value)}"${selectedMaterial === value ? " selected" : ""}>${escapeHtml(value)}</option>`)
    ].join("");

    container.innerHTML = `
      <div class="quick-filter-row">
        <label class="quick-select-wrap">
          <span class="quick-filter-label">Categoria</span>
          <select class="input quick-select" id="filter-category">${categoryOptions}</select>
        </label>
        <label class="quick-select-wrap">
          <span class="quick-filter-label">Materiale</span>
          <select class="input quick-select" id="filter-material">${materialOptions}</select>
        </label>
      </div>
    `;

    const categorySelect = qs("#filter-category", container);
    const materialSelect = qs("#filter-material", container);
    const onChange = () => {
      const nextCategory = categorySelect ? categorySelect.value : "";
      const nextMaterial = materialSelect ? materialSelect.value : "";
      updateProductsQuery(nextCategory, nextMaterial);
      renderProductsPage(products, nextMaterial, nextCategory);
    };
    if (categorySelect) categorySelect.addEventListener("change", onChange);
    if (materialSelect) materialSelect.addEventListener("change", onChange);
  }

  function renderProductsPage(products, material, category) {
    const container = qs("#products-content");
    if (!container) return;
    renderQuickFilters(products, category, material);
    let filtered = products;

    if (category || material) {
      filtered = products.filter((product) => {
        const categoryOk = !category || product.category === category;
        if (!categoryOk) return false;
        if (!material) return true;
        return (product.images || []).some((img) => img.material === material);
      });
    }

    const grouped = {};
    filtered.forEach((product) => {
      const key = product.category || "Altro";
      grouped[key] = grouped[key] || [];
      grouped[key].push(product);
    });

    const sections = Object.keys(grouped).map((category) => {
      const cards = grouped[category].map(renderProductCard).join("");
      return `
        <section class="category">
          <div class="container">
            <div class="category-head">
              <h2>${category}</h2>
            </div>
            <div class="category-carousel" data-product-carousel>
              <button class="mini-scroll prev" type="button" aria-label="Scorri a sinistra" data-scroll="prev">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M15 6l-6 6 6 6"></path>
                </svg>
              </button>
              <div class="product-track">
                ${cards}
              </div>
              <button class="mini-scroll next" type="button" aria-label="Scorri a destra" data-scroll="next">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M9 6l6 6-6 6"></path>
                </svg>
              </button>
            </div>
          </div>
        </section>
      `;
    }).join("");

    container.innerHTML = sections || `
      <section class="category">
        <div class="container">
          <p class="muted">Nessun prodotto trovato con i filtri selezionati.</p>
        </div>
      </section>
    `;

    const filterNote = qs("#filter-note");
    const filterText = qs("#filter-text");
    if (filterNote && (category || material)) {
      const parts = [];
      if (category) parts.push(`Categoria ${category}`);
      if (material) parts.push(`Materiale ${material}`);
      filterText.textContent = parts.join(" ");
      filterNote.hidden = false;
    } else if (filterNote) {
      filterNote.hidden = true;
    }

    setupCategoryCarousels();
  }

  function setupCategoryCarousels() {
    const carousels = qsa("[data-product-carousel]");
    carousels.forEach((carousel) => {
      const track = qs(".product-track", carousel);
      const prev = qs("[data-scroll=\"prev\"]", carousel);
      const next = qs("[data-scroll=\"next\"]", carousel);
      if (!track || !prev || !next) return;

      function getScrollStep() {
        const firstCard = qs(".card", track);
        if (!firstCard) return 260;
        const styles = window.getComputedStyle(track);
        const gap = parseFloat(styles.columnGap || styles.gap || "0") || 0;
        return firstCard.getBoundingClientRect().width + gap;
      }

      function updateButtons() {
        const maxScrollLeft = track.scrollWidth - track.clientWidth;
        const hasOverflow = maxScrollLeft > 2;
        const edgeTolerance = 10;
        const hasLeftPeek = hasOverflow && track.scrollLeft > edgeTolerance;
        const hasRightPeek = hasOverflow && track.scrollLeft < maxScrollLeft - edgeTolerance;
        carousel.classList.toggle("has-left-peek", hasLeftPeek);
        carousel.classList.toggle("has-right-peek", hasRightPeek);
        prev.style.display = hasOverflow ? "grid" : "none";
        next.style.display = hasOverflow ? "grid" : "none";
        if (!hasOverflow) return;
        prev.disabled = !hasLeftPeek;
        next.disabled = !hasRightPeek;
      }

      prev.addEventListener("click", () => {
        const step = getScrollStep();
        track.scrollBy({ left: -(step * 2), behavior: "smooth" });
      });

      next.addEventListener("click", () => {
        const step = getScrollStep();
        track.scrollBy({ left: step * 2, behavior: "smooth" });
      });

      track.addEventListener("scroll", updateButtons, { passive: true });
      window.addEventListener("resize", updateButtons);
      updateButtons();
      requestAnimationFrame(updateButtons);
      setTimeout(updateButtons, 160);
    });
  }

  function renderMaterialsPage(materials, products) {
    const container = qs("#materials-list");
    if (!container) return;

    function hasProducts(materialName, colorName) {
      return products.some((product) =>
        (product.images || []).some(
          (img) => img.material === materialName && img.color === colorName
        )
      );
    }

    container.innerHTML = materials.map((material) => {
      const colorRows = material.colors.map((color) => {
        const imgSrc = `${ASSET_DIR}/materials/${color.sample_image}`;
        const swatchMarkup = buildOptimizedImageMarkup("materials", color.sample_image, color.name, {
          webpFile: color.sample_webp_image,
          loading: "lazy",
          decoding: "async"
        });
        const hasProduct = hasProducts(material.name, color.name);
        const link = hasProduct
          ? `<a class="btn btn-ghost" href="products.html?material=${encodeURIComponent(material.name)}">Vedi prodotti</a>`
          : `<span class="muted">Nessun prodotto</span>`;
        return `
          <div class="material-row">
            <button class="material-swatch swatch-zoom" type="button" data-lightbox-src="${imgSrc}">
              ${swatchMarkup}
            </button>
            <div class="material-info">
              <strong>${color.name}</strong>
              <span class="muted">Provino ${material.name}</span>
            </div>
            <div class="material-action">${link}</div>
          </div>
        `;
      }).join("");

      return `
        <div class="material-block">
          <div class="material-head">
            <h2>${material.name}</h2>
            <p>${material.description}</p>
          </div>
          <div class="material-list">
            ${colorRows}
          </div>
        </div>
      `;
    }).join("");

    setupLightbox("#materials-lightbox", "#materials-lightbox-image");
  }

  function setupLightbox(lightboxId, imageId) {
    const lightbox = qs(lightboxId);
    const image = qs(imageId);
    if (!lightbox || !image) return;
    const closeTargets = qsa("[data-close]", lightbox);
    const openButtons = qsa("[data-lightbox-src]");

    function open(src) {
      if (!src) return;
      image.src = src;
      lightbox.classList.add("is-open");
    }

    function close() {
      lightbox.classList.remove("is-open");
    }

    openButtons.forEach((btn) => {
      btn.addEventListener("click", () => open(btn.dataset.lightboxSrc));
    });
    closeTargets.forEach((btn) => btn.addEventListener("click", close));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
  }

  function renderProductPage(product, reviews, site, allProducts) {
    if (!product) return;
    document.title = `${product.title} - ${site.site_name || "3D__PrintHub"}`;

    const availabilityBadge = qs("#product-availability");
    const availabilityText = qs("#product-availability-text");
    const title = qs("#product-title");
    const description = qs("#product-description");
    const dimensions = qs("#product-dimensions");
    const shipping = qs("#product-shipping");
    const shippingTime = qs("#product-shipping-time");
    const shippingNote = qs("#product-shipping-note");
    const priceBlock = qs("#price-block");
    const mainImage = qs("#main-image");
    const galleryPlaceholder = qs("#gallery-placeholder");
    const miniGalleryWrap = qs("#mini-gallery-wrap");
    const miniGallery = qs("#mini-gallery");
    const galleryDots = qs("#gallery-dots");
    const note = qs("#image-note");
    const colorChips = qs("#color-chips");
    const materialChips = qs("#material-chips");
    const stickyCta = qs("#product-sticky-cta");
    const stickyPriceBlock = qs("#sticky-price-block");
    const stickyPriceCurrent = qs("#sticky-price-current");
    const stickyPriceOld = qs("#sticky-price-old");
    const stickyPriceDiscount = qs("#sticky-price-discount");

    title.textContent = product.title;
    if (mainImage) {
      mainImage.loading = "eager";
      mainImage.decoding = "async";
    }
    description.textContent = product.description || "";
    dimensions.textContent = product.dimensions || "";
    availabilityText.textContent = product.availability || "";
    shippingNote.textContent = product.shipping_note || "";

    if (product.availability) {
      availabilityBadge.textContent = product.availability;
      availabilityBadge.hidden = false;
      availabilityBadge.classList.add(product.availability === "Disponibile" ? "badge-available" : "badge-order");
    }

    if (product.availability && product.availability !== "Disponibile") {
      shipping.hidden = false;
      shippingTime.textContent = product.shipping_time || "";
    } else {
      shipping.hidden = true;
      shippingNote.textContent = "";
    }

    buildPriceBlock(product, priceBlock);
    if (stickyCta) stickyCta.hidden = false;

    const images = (product.images || []).map((img) => ({
      src: `${ASSET_DIR}/catalog/${img.file}`,
      file: img.file || "",
      webpFile: img.webp_file || "",
      color: img.color || "",
      material: img.material || ""
    }));

    if (images.length) {
      mainImage.src = images[0].src;
      mainImage.hidden = false;
      if (galleryPlaceholder) {
        galleryPlaceholder.hidden = true;
        galleryPlaceholder.style.display = "none";
      }
    } else if (galleryPlaceholder) {
      galleryPlaceholder.hidden = false;
      galleryPlaceholder.style.display = "";
    }

    const colorButtons = (product.colors || []).map((color) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip chip-btn";
      btn.dataset.color = color;
      btn.textContent = color;
      const swatch = COLOR_SWATCHES[color];
      if (swatch) {
        btn.style.setProperty("--chip-bg", swatch.bg);
        btn.style.setProperty("--chip-ink", swatch.text);
      }
      return btn;
    });
    colorButtons.forEach((btn) => colorChips.appendChild(btn));

    const materialButtons = (product.materials || []).map((material) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip chip-btn";
      btn.dataset.material = material;
      btn.textContent = material;
      return btn;
    });
    materialButtons.forEach((btn) => materialChips.appendChild(btn));

    let selectedColor = "";
    let selectedMaterial = "";
    let currentSrc = images.length ? images[0].src : "";
    let currentGalleryItems = images.slice();
    let activeGalleryIndex = 0;
    let touchStartX = null;
    let touchEndX = null;

    function getFilteredImages() {
      if (!selectedColor && !selectedMaterial) {
        return images;
      }
      return images.filter((img) => {
        const colorOk = !selectedColor || img.color === selectedColor;
        const materialOk = !selectedMaterial || img.material === selectedMaterial;
        return colorOk && materialOk;
      });
    }

    function setActiveDot(index) {
      if (miniGallery) {
        qsa(".mini-thumb", miniGallery).forEach((thumb, thumbIndex) => {
          thumb.classList.toggle("is-active", thumbIndex === index);
        });
      }
      if (galleryDots) {
        qsa(".gallery-dot", galleryDots).forEach((dot, dotIndex) => {
          dot.classList.toggle("is-active", dotIndex === index);
        });
      }
    }

    function renderGalleryDots(list) {
      if (!galleryDots) return;
      const items = Array.isArray(list) ? list : [];
      if (items.length <= 1) {
        galleryDots.hidden = true;
        galleryDots.innerHTML = "";
        return;
      }
      galleryDots.hidden = false;
      galleryDots.innerHTML = items.map((_, index) => `
        <button type="button" class="gallery-dot" data-index="${index}" aria-label="Seleziona foto ${index + 1}"></button>
      `).join("");
      qsa(".gallery-dot", galleryDots).forEach((dot) => {
        dot.addEventListener("click", () => {
          const index = Number(dot.dataset.index || 0);
          showImageAt(index, currentGalleryItems);
        });
      });
    }

    function showImageAt(index, items, keepIfInvalid = false) {
      const list = Array.isArray(items) ? items : currentGalleryItems;
      if (!list.length || !mainImage) return;
      const size = list.length;
      const nextIndex = ((index % size) + size) % size;
      const next = list[nextIndex];
      if (!next || !next.src) {
        if (!keepIfInvalid) return;
      }
      activeGalleryIndex = nextIndex;
      if (next && next.src) {
        mainImage.src = next.src;
        currentSrc = next.src;
      }
      setActiveDot(activeGalleryIndex);
    }

    function renderMiniGallery(items) {
      if (!miniGallery || !miniGalleryWrap) return;
      const list = Array.isArray(items) ? items : [];
      if (list.length <= 1) {
        miniGalleryWrap.hidden = true;
        miniGallery.innerHTML = "";
        currentGalleryItems = list;
        activeGalleryIndex = 0;
        renderGalleryDots(list);
        return;
      }

      miniGalleryWrap.hidden = false;
      currentGalleryItems = list;
      miniGallery.innerHTML = list.map((img, index) => `
        <button type="button" class="mini-thumb" data-index="${index}" aria-label="Vai immagine ${index + 1}">
          ${buildOptimizedImageMarkup("catalog", img.file, product.title, {
            webpFile: img.webpFile,
            loading: "lazy",
            decoding: "async"
          })}
        </button>
      `).join("");

      qsa(".mini-thumb", miniGallery).forEach((thumb) => {
        thumb.addEventListener("click", () => {
          const index = Number(thumb.dataset.index || 0);
          showImageAt(index, currentGalleryItems);
        });
      });
      renderGalleryDots(list);
      setActiveDot(activeGalleryIndex);
    }

    function setActive(buttons, value) {
      buttons.forEach((btn) => {
        const isActive = btn.dataset.color === value || btn.dataset.material === value;
        btn.classList.toggle("is-active", isActive);
      });
    }

    function updateDisabledColors() {
      if (!selectedMaterial) {
        colorButtons.forEach((btn) => {
          btn.disabled = false;
          btn.classList.remove("is-disabled");
        });
        return;
      }
      const allowed = new Set(images.filter((img) => img.material === selectedMaterial && img.color).map((img) => img.color));
      colorButtons.forEach((btn) => {
        const enabled = allowed.size === 0 || allowed.has(btn.dataset.color);
        btn.disabled = !enabled;
        btn.classList.toggle("is-disabled", !enabled);
        if (!enabled && selectedColor === btn.dataset.color) selectedColor = "";
      });
    }

    function updateDisabledMaterials() {
      if (!selectedColor) {
        materialButtons.forEach((btn) => {
          btn.disabled = false;
          btn.classList.remove("is-disabled");
        });
        return;
      }
      const allowed = new Set(images.filter((img) => img.color === selectedColor && img.material).map((img) => img.material));
      materialButtons.forEach((btn) => {
        const enabled = allowed.size === 0 || allowed.has(btn.dataset.material);
        btn.disabled = !enabled;
        btn.classList.toggle("is-disabled", !enabled);
        if (!enabled && selectedMaterial === btn.dataset.material) selectedMaterial = "";
      });
    }

    function findMatch() {
      if (!images.length) return null;
      if (selectedColor && selectedMaterial) {
        return images.find((img) => img.color === selectedColor && img.material === selectedMaterial);
      }
      if (selectedColor) {
        return images.find((img) => img.color === selectedColor);
      }
      if (selectedMaterial) {
        return images.find((img) => img.material === selectedMaterial);
      }
      return images[0] || null;
    }

    function selectionHasImage() {
      return images.some((img) => {
        const colorOk = !selectedColor || img.color === selectedColor;
        const materialOk = !selectedMaterial || img.material === selectedMaterial;
        return colorOk && materialOk;
      });
    }

    function getVariantMatch() {
      const variants = product.price_variants || [];
      if (selectedColor && selectedMaterial) {
        return variants.find((v) => v.color === selectedColor && v.material === selectedMaterial);
      }
      if (selectedColor) {
        return variants.find((v) => v.color === selectedColor);
      }
      if (selectedMaterial) {
        return variants.find((v) => v.material === selectedMaterial);
      }
      return null;
    }

    function syncStickyPrice(price, discount) {
      if (!stickyPriceCurrent || !stickyPriceBlock) return;
      if (discount && discount < price) {
        stickyPriceBlock.classList.add("is-discounted");
        if (stickyPriceOld) {
          stickyPriceOld.style.display = "inline";
          stickyPriceOld.textContent = formatPrice(price);
        }
        if (stickyPriceDiscount) {
          const percent = Math.round((1 - discount / price) * 100);
          stickyPriceDiscount.style.display = "inline";
          stickyPriceDiscount.textContent = `-${percent}%`;
        }
        stickyPriceCurrent.textContent = formatPrice(discount);
      } else {
        stickyPriceBlock.classList.remove("is-discounted");
        if (stickyPriceOld) stickyPriceOld.style.display = "none";
        if (stickyPriceDiscount) stickyPriceDiscount.style.display = "none";
        stickyPriceCurrent.textContent = formatPrice(price);
      }
    }

    function setPriceDisplay(priceValue, discountValue) {
      const priceOld = qs("#price-old");
      const priceCurrent = qs("#price-current");
      const priceDiscount = qs("#price-discount");
      const price = priceValue || product.base_price;
      const discount = discountValue || null;
      if (discount && discount < price) {
        priceBlock.classList.add("is-discounted");
        priceOld.style.display = "inline";
        priceOld.textContent = formatPrice(price);
        priceCurrent.textContent = formatPrice(discount);
        const percent = Math.round((1 - discount / price) * 100);
        priceDiscount.style.display = "inline";
        priceDiscount.textContent = `-${percent}%`;
      } else {
        priceBlock.classList.remove("is-discounted");
        priceOld.style.display = "none";
        priceDiscount.style.display = "none";
        priceCurrent.textContent = formatPrice(price);
      }
      syncStickyPrice(price, discount);
    }

    function updateImage() {
      updateDisabledColors();
      updateDisabledMaterials();
      setActive(colorButtons, selectedColor);
      setActive(materialButtons, selectedMaterial);
      const hasImage = selectionHasImage();
      if (images.length) {
        if (hasImage) {
          const filteredImages = getFilteredImages();
          const match = findMatch();
          if (match) {
            const preservedIndex = filteredImages.findIndex((img) => img.src === currentSrc);
            const matchIndex = filteredImages.findIndex((img) => img.src === match.src);
            activeGalleryIndex = preservedIndex >= 0 ? preservedIndex : (matchIndex >= 0 ? matchIndex : 0);
          }
          renderMiniGallery(filteredImages);
          showImageAt(activeGalleryIndex, filteredImages, true);
          note.textContent = "";
        } else {
          note.textContent = "Non e disponibile l'immagine per il colore o materiale selezionato.";
          if (currentSrc) mainImage.src = currentSrc;
        }
      }

      const variant = getVariantMatch();
      if (variant) {
        setPriceDisplay(variant.price, variant.discount_price);
      } else {
        setPriceDisplay(product.base_price, product.base_discount_price);
      }
    }

    colorButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        selectedColor = btn.dataset.color === selectedColor ? "" : btn.dataset.color;
        updateImage();
      });
    });

    materialButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        selectedMaterial = btn.dataset.material === selectedMaterial ? "" : btn.dataset.material;
        updateImage();
      });
    });

    if (mainImage) {
      mainImage.addEventListener("touchstart", (event) => {
        touchStartX = event.changedTouches?.[0]?.screenX ?? null;
      }, { passive: true });

      mainImage.addEventListener("touchend", (event) => {
        touchEndX = event.changedTouches?.[0]?.screenX ?? null;
        if (touchStartX === null || touchEndX === null) return;
        const delta = touchEndX - touchStartX;
        if (Math.abs(delta) < 40 || currentGalleryItems.length <= 1) return;
        if (delta < 0) {
          showImageAt(activeGalleryIndex + 1, currentGalleryItems);
        } else {
          showImageAt(activeGalleryIndex - 1, currentGalleryItems);
        }
        touchStartX = null;
        touchEndX = null;
      }, { passive: true });
    }
    renderMiniGallery(images);

    const lightbox = qs("#product-lightbox");
    const lightboxImage = qs("#product-lightbox-image");
    if (lightbox && lightboxImage) {
      const closeTargets = qsa("[data-close]", lightbox);
      const openLightbox = () => {
        if (!mainImage.src) return;
        lightboxImage.src = mainImage.src;
        lightbox.classList.add("is-open");
      };
      const closeLightbox = () => lightbox.classList.remove("is-open");
      mainImage.addEventListener("click", openLightbox);
      closeTargets.forEach((btn) => btn.addEventListener("click", closeLightbox));
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeLightbox();
      });
    }

    function renderRelatedProducts() {
      const section = qs("#related-products");
      const track = qs("#related-track");
      if (!section || !track || !Array.isArray(allProducts)) return;

      const sameCategory = allProducts.filter(
        (item) => item.slug !== product.slug && item.category === product.category
      );
      const fallback = allProducts.filter(
        (item) =>
          item.slug !== product.slug &&
          item.category !== product.category &&
          (item.best_seller || item.is_new)
      );
      const merged = [...sameCategory];
      fallback.forEach((item) => {
        if (!merged.find((entry) => entry.slug === item.slug)) {
          merged.push(item);
        }
      });
      const related = merged.slice(0, 10);

      if (!related.length) {
        section.hidden = true;
        return;
      }

      track.innerHTML = related.map(renderProductCard).join("");
      section.hidden = false;
      setupCategoryCarousels();
    }

    updateImage();

    renderReviews(product.slug, reviews);
    renderRelatedProducts();

    setupAvailabilityForm(site, product, () => selectedColor, () => selectedMaterial);
  }

  function renderReviews(slug, reviewsData) {
    const list = qs("#review-list");
    const empty = qs("#review-empty");
    const countEl = qs("#reviews-count");
    if (!list || !countEl) return;

    const approved = (reviewsData.approved || []).filter((r) => r.product_slug === slug);
    if (!approved.length) {
      list.innerHTML = "";
      empty.hidden = false;
      countEl.textContent = "0 recensioni";
      return;
    }

    empty.hidden = true;
    countEl.textContent = `${approved.length} ${approved.length === 1 ? "recensione" : "recensioni"}`;

    list.innerHTML = approved.map((review) => {
      const images = (review.images || []).map((img) => {
        if (typeof img === "string") {
          return buildOptimizedImageMarkup("reviews", img, "Foto recensione", {
            loading: "lazy",
            decoding: "async"
          });
        }
        return buildOptimizedImageMarkup("reviews", img.file, "Foto recensione", {
          webpFile: img.webp_file,
          loading: "lazy",
          decoding: "async"
        });
      }).join("");
      const imagesBlock = images ? `<div class="review-images">${images}</div>` : "";
      const dateBlock = review.date ? `<p class="muted">${review.date}</p>` : "";
      return `
        <div class="review-card">
          <div class="review-head">
            <strong>${review.name || "Cliente"}</strong>
          </div>
          <p>${review.text || ""}</p>
          ${dateBlock}
          ${imagesBlock}
        </div>
      `;
    }).join("");
  }

  function setupAvailabilityForm(site, product, getColor, getMaterial) {
    const modal = qs("#availability-modal");
    const openBtn = qs(".js-open-availability");
    const form = qs("#availability-form");
    const status = qs("#availability-status");
    const igButton = form ? form.querySelector("[data-channel=\"instagram\"]") : null;
    if (!modal || !openBtn || !form) return;
    applyRequired(form, getRequiredList(site, "availability_request"));

    setupModal("#availability-modal", ".js-open-availability");

    function buildMessage(data) {
      return [
        "Richiesta disponibilita",
        "",
        `Nome: ${data.get("name") || ""}`,
        `Email: ${data.get("email") || ""}`,
        `Prodotto: ${product.title || ""}`,
        `Colore: ${getColor() || ""}`,
        `Materiale: ${getMaterial() || ""}`,
        "",
        "Note:",
        data.get("notes") || ""
      ].join("\n");
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!ensureValid(form)) return;
      const data = new FormData(form);
      const body = buildMessage(data);
      openMailto(site.contact_email, "Richiesta disponibilita", body);
      if (status) status.hidden = false;
      showToast("Richiesta inviata.");
    });

    if (igButton) {
      igButton.addEventListener("click", () => {
        if (!ensureValid(form)) return;
        const data = new FormData(form);
        const body = buildMessage(data);
        copyToClipboard(body);
        if (!confirmInstagram("richiesta di disponibilita")) return;
        openInstagram(site);
        if (status) status.hidden = false;
        showToast("Messaggio copiato negli appunti. Incollalo nella chat Instagram.");
      });
    }
  }

  function initHomePage(products) {
    const best = products.filter((p) => p.best_seller);
    const newest = products.filter((p) => p.is_new);
    const bestGrid = qs("#best-seller-grid");
    const newGrid = qs("#new-entry-grid");

    renderFeatured(bestGrid, best.length ? best : products.slice(0, 6));
    renderFeatured(newGrid, newest.length ? newest : products.slice(-6));
  }

  async function init() {
    const page = document.body.dataset.page;
    setupNavMenu();
    const site = await getSite();
    applySiteData(site);
    setupModal("#custom-modal", ".js-open-custom");
    setupCustomForm(site);

    if (page === "home") {
      const products = await getCatalog();
      initHomePage(products);
    }

    if (page === "products") {
      const products = await getCatalog();
      const params = new URLSearchParams(window.location.search);
      const material = params.get("material");
      const category = params.get("category");
      renderProductsPage(products, material, category);
    }

    if (page === "materials") {
      const [materials, products] = await Promise.all([getMaterials(), getCatalog()]);
      renderMaterialsPage(materials, products);
    }

    if (page === "product") {
      const params = new URLSearchParams(window.location.search);
      const rawSlug = params.get("slug");
      const slug = PRODUCT_SLUG_ALIASES[rawSlug] || rawSlug;
      const [products, reviews] = await Promise.all([getCatalog(), getReviews()]);
      const product = products.find((p) => p.slug === slug);
      if (!product) {
        window.location.href = "products.html";
        return;
      }
      if (rawSlug && rawSlug !== slug) {
        params.set("slug", slug);
        window.history.replaceState({}, "", `product.html?${params.toString()}`);
      }
      renderProductPage(product, reviews, site, products);
    }
  }

  init().catch((err) => {
    console.error(err);
  });
})();
