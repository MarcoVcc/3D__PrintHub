import {
  ASSET_DIR,
  buildOptimizedImageMarkup,
  escapeHtml,
  formatPrice,
  getCustomProducts,
  getSaleProducts,
  isCustomProduct,
  qs,
  qsa
} from "./core.js";

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
  if (product.is_custom || basePrice == null) {
    priceBlock.classList.remove("is-discounted");
    priceOld.style.display = "none";
    priceDiscount.style.display = "none";
    priceCurrent.textContent = "Su richiesta";
    return;
  }

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

function renderProductCard(product, site) {
  const firstImage = product.images && product.images.length ? product.images[0] : null;
  const img = firstImage
    ? buildOptimizedImageMarkup("catalog", firstImage.file, product.title, {
        webpFile: firstImage.webp_file,
        loading: "lazy",
        decoding: "async"
      })
    : `<div class="placeholder">Foto</div>`;
  const isCustom = product.is_custom;
  const hasDiscount = !isCustom && product.base_discount_price && product.base_discount_price < product.base_price;
  const priceHtml = hasDiscount
    ? `<span class="price-old">${formatPrice(product.base_price)}</span>
       <span class="price-current">${formatPrice(product.base_discount_price)}</span>
       <span class="price-discount">-${Math.round((1 - product.base_discount_price / product.base_price) * 100)}%</span>`
    : `<span class="price-current">${formatPrice(product.base_price)}</span>`;
  const badge = !isCustom && site.show_badges && (product.availability === "Disponibile" || product.availability === "Su ordinazione")
    ? `<span class="badge ${product.availability === "Disponibile" ? "badge-available" : "badge-order"}">${product.availability}</span>`
    : "";
  const priceBlock = !isCustom
    ? `<div class="price-block ${hasDiscount ? "is-discounted" : ""}">
        ${priceHtml}
      </div>`
    : "";
  const metaBlock = badge ? `<div class="card-meta">${badge}</div>` : "";

  return `
    <a class="card card-link" href="product.html?slug=${encodeURIComponent(product.slug)}">
      ${img}
      <div class="card-body">
        <div class="card-head">
          <h3>${product.title}</h3>
          ${priceBlock}
        </div>
        ${metaBlock}
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

function updateProductsQuery(category, material, color) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (material) params.set("material", material);
  if (color) params.set("color", color);
  const query = params.toString();
  const next = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.replaceState({}, "", next);
}

function renderQuickFilters(products, selectedCategory, selectedMaterial, selectedColor, site) {
  const container = qs("#quick-filters");
  if (!container) return;

  const categories = getUniqueValues(products, "category");
  const materials = getUniqueValues(products, "material");
  const colors = getUniqueValues(products, "color");

  const categoryOptions = [
    `<option value="">Tutte le categorie</option>`,
    ...categories.map((value) => `<option value="${escapeHtml(value)}"${selectedCategory === value ? " selected" : ""}>${escapeHtml(value)}</option>`)
  ].join("");

  const materialOptions = [
    `<option value="">Tutti i materiali</option>`,
    ...materials.map((value) => `<option value="${escapeHtml(value)}"${selectedMaterial === value ? " selected" : ""}>${escapeHtml(value)}</option>`)
  ].join("");
  const colorOptions = [
    `<option value="">Tutti i colori</option>`,
    ...colors.map((value) => `<option value="${escapeHtml(value)}"${selectedColor === value ? " selected" : ""}>${escapeHtml(value)}</option>`)
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
      <label class="quick-select-wrap">
        <span class="quick-filter-label">Colore</span>
        <select class="input quick-select" id="filter-color">${colorOptions}</select>
      </label>
    </div>
  `;

  const categorySelect = qs("#filter-category", container);
  const materialSelect = qs("#filter-material", container);
  const colorSelect = qs("#filter-color", container);
  const onChange = () => {
    const nextCategory = categorySelect ? categorySelect.value : "";
    const nextMaterial = materialSelect ? materialSelect.value : "";
    const nextColor = colorSelect ? colorSelect.value : "";
    updateProductsQuery(nextCategory, nextMaterial, nextColor);
    renderProductsPage(products, nextMaterial, nextCategory, nextColor, site);
  };
  if (categorySelect) categorySelect.addEventListener("change", onChange);
  if (materialSelect) materialSelect.addEventListener("change", onChange);
  if (colorSelect) colorSelect.addEventListener("change", onChange);
}

function setupFilterToggle() {
  const toggle = qs("#toggle-filters");
  const filters = qs("#quick-filters");
  if (!toggle || !filters) return;
  if (toggle.dataset.filterToggleReady === "true") return;
  toggle.dataset.filterToggleReady = "true";

  const updateText = () => {
    const collapsed = filters.classList.contains("collapsed");
    toggle.textContent = collapsed ? "Mostra filtri" : "Nascondi filtri";
    toggle.setAttribute("aria-expanded", String(!collapsed));
  };

  toggle.addEventListener("click", () => {
    filters.classList.toggle("collapsed");
    updateText();
  });

  const mobileQuery = window.matchMedia("(max-width: 768px)");
  const syncResponsiveState = () => {
    filters.classList.toggle("collapsed", mobileQuery.matches);
    updateText();
  };
  if (mobileQuery.addEventListener) {
    mobileQuery.addEventListener("change", syncResponsiveState);
  } else {
    mobileQuery.addListener(syncResponsiveState);
  }
  syncResponsiveState();
}

function renderProductsPage(products, material, category, color, site) {
  const container = qs("#products-content");
  if (!container) return;
  const saleProducts = getSaleProducts(products);
  const visibleProducts = saleProducts.filter((product) => product.category !== "Lavori Personalizzati");
  renderQuickFilters(visibleProducts, category, material, color, site);
  setupFilterToggle();
  let filtered = visibleProducts;

  if (category || material || color) {
    filtered = visibleProducts.filter((product) => {
      const categoryOk = !category || product.category === category;
      const materialOk = !material || (product.materials || []).includes(material);
      const colorOk = !color || (product.colors || []).includes(color);
      return categoryOk && materialOk && colorOk;
    });
  }

  const grouped = {};
  filtered.forEach((product) => {
    const key = product.category || "Altro";
    grouped[key] = grouped[key] || [];
    grouped[key].push(product);
  });

  const categories = Object.keys(grouped);

  const sections = categories.map((category) => {
    const cards = grouped[category].map(product => renderProductCard(product, site)).join("");
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
  if (filterNote && (category || material || color)) {
    const parts = [];
    if (category) parts.push(`Categoria ${category}`);
    if (material) parts.push(`Materiale ${material}`);
    if (color) parts.push(`Colore ${color}`);
    filterText.textContent = parts.join(" ");
    filterNote.hidden = false;
  } else if (filterNote) {
    filterNote.hidden = true;
  }

  setupCategoryCarousels();
}

function renderWorksPage(products, site) {
  const container = qs("#works-content");
  if (!container) return;
  const customProducts = getCustomProducts(products);

  if (!customProducts.length) {
    container.innerHTML = `
      <section class="category">
        <div class="container">
          <p class="muted">Nessun lavoro personalizzato pubblicato.</p>
        </div>
      </section>
    `;
    return;
  }

  const cards = customProducts.map(product => renderProductCard(product, site)).join("");
  container.innerHTML = `
    <section class="category">
      <div class="container">
        <div class="category-head">
          <h2>I miei lavori</h2>
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

  container.innerHTML = materials.map((material) => {
    const colorRows = material.colors.map((color) => {
      const imgSrc = `${ASSET_DIR}/materials/${color.sample_image}`;
      const hasMatchingProducts = products.some((product) =>
        !isCustomProduct(product) &&
        product.category !== "Lavori Personalizzati" &&
        (product.materials || []).includes(material.name) &&
        (product.colors || []).includes(color.name)
      );
      const productLink = hasMatchingProducts
        ? `<div class="material-action"><a class="btn btn-ghost" href="products.html?material=${encodeURIComponent(material.name)}&amp;color=${encodeURIComponent(color.name)}">Vedi prodotti</a></div>`
        : "";
      return `
        <div class="material-row">
          <div class="material-swatch">
            <img src="${imgSrc}" alt="${color.name}" loading="lazy" decoding="async">
          </div>
          <div class="material-info">
            <strong>${color.name}</strong>
          </div>
          ${productLink}
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
}

function initHomePage(products) {
  const saleProducts = getSaleProducts(products);
  const best = saleProducts.filter((p) => p.best_seller);
  const newest = saleProducts.filter((p) => p.is_new);
  const bestGrid = qs("#best-seller-grid");
  const newGrid = qs("#new-entry-grid");

  renderFeatured(bestGrid, best.length ? best : saleProducts.slice(0, 6));
  renderFeatured(newGrid, newest.length ? newest : saleProducts.slice(-6));
}
export {
  buildPriceBlock,
  initHomePage,
  renderMaterialsPage,
  renderProductCard,
  renderProductsPage,
  renderWorksPage,
  setupCategoryCarousels
};
