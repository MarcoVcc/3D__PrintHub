import {
  ASSET_DIR,
  buildOptimizedImageMarkup,
  escapeHtml,
  formatPrice,
  qs,
  qsa
} from "./core.js";
import { buildPriceBlock, renderProductCard, setupCategoryCarousels } from "./catalog.js";
import { addInquiryItem } from "./cart.js";

function openImageLightbox(src, alt = "") {
  const lightbox = qs("#product-lightbox");
  const image = qs("#product-lightbox-image");
  if (!lightbox || !image || !src) return;
  image.src = src;
  image.alt = alt;
  lightbox.classList.add("is-open");
}

function renderProductPage(product, reviews, site, allProducts) {
  if (!product) return;
  document.title = `${product.title} - ${site.site_name || "3D__PrintHub"}`;
  document.body.classList.toggle("is-custom", Boolean(product.is_custom));

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
  const colorSelect = qs("#color-select");
  const materialSelect = qs("#material-select");
  const colorOptionGroup = qs("#color-option-group");
  const materialOptionGroup = qs("#material-option-group");
  const colorSelectionState = qs("#color-selection-state");
  const materialSelectionState = qs("#material-selection-state");
  const selectionStatus = qs("#variant-selection-status");
  const stickySelectionHint = qs("#sticky-selection-hint");
  const stickyCta = qs("#product-sticky-cta");
  const stickyPriceBlock = qs("#sticky-price-block");
  const stickyPriceCurrent = qs("#sticky-price-current");
  const stickyPriceOld = qs("#sticky-price-old");
  const stickyPriceDiscount = qs("#sticky-price-discount");
  const lightbox = qs("#product-lightbox");
  const lightboxImage = qs("#product-lightbox-image");

  title.textContent = product.title;
  if (mainImage) {
    mainImage.loading = "eager";
    mainImage.decoding = "async";
  }
  description.textContent = product.description || "";
  dimensions.textContent = product.dimensions || "";
  availabilityText.textContent = product.availability || "";
  shippingNote.textContent = product.shipping_note || "";

  if (site.show_badges && (product.availability === "Disponibile" || product.availability === "Su ordinazione")) {
    availabilityBadge.textContent = product.availability;
    availabilityBadge.hidden = false;
    availabilityBadge.classList.add(product.availability === "Disponibile" ? "badge-available" : "badge-order");
  } else {
    availabilityBadge.hidden = true;
  }

  if (product.availability && product.availability !== "Disponibile") {
    shipping.hidden = false;
    shippingTime.textContent = product.shipping_time || "";
  } else {
    shipping.hidden = true;
    shippingNote.textContent = "";
  }

  buildPriceBlock(product, priceBlock);
  if (stickyCta) stickyCta.hidden = Boolean(product.is_custom);
  const productCta = qs(".product-media .cta");
  if (productCta) productCta.hidden = Boolean(product.is_custom);
  const reviewsSection = qs(".reviews");
  if (reviewsSection) reviewsSection.hidden = Boolean(product.is_custom);

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

  function appendSelectOptions(select, values) {
    if (!select) return [];
    return (values || []).filter(Boolean).map((value) => {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = String(value);
      select.appendChild(option);
      return option;
    });
  }

  const colorOptions = appendSelectOptions(colorSelect, product.colors);
  const materialOptions = appendSelectOptions(materialSelect, product.materials);

  let selectedColor = "";
  let selectedMaterial = "";
  const addToCartButtons = qsa("[data-add-to-cart]");
  let currentSrc = images.length ? images[0].src : "";
  let currentGalleryItems = images.slice();
  let activeGalleryIndex = 0;
  let touchStartX = null;
  let touchEndX = null;

  function hasCompleteSelection() {
    return Boolean(selectedColor && selectedMaterial);
  }

  function updateSelectionState() {
    const colorReady = colorOptions.length > 0 && Boolean(selectedColor);
    const materialReady = materialOptions.length > 0 && Boolean(selectedMaterial);
    const complete = colorReady && materialReady;
    const missing = [];
    const unconfigured = [];

    if (colorOptionGroup) {
      colorOptionGroup.hidden = false;
      colorOptionGroup.classList.toggle("is-complete", colorReady && Boolean(selectedColor));
    }
    if (materialOptionGroup) {
      materialOptionGroup.hidden = false;
      materialOptionGroup.classList.toggle("is-complete", materialReady && Boolean(selectedMaterial));
    }

    if (colorSelectionState) {
      colorSelectionState.textContent = colorOptions.length === 0
        ? "Nessun colore configurato"
        : selectedColor ? `Selezionato: ${selectedColor}` : "Seleziona un colore";
    }
    if (materialSelectionState) {
      materialSelectionState.textContent = materialOptions.length === 0
        ? "Nessun materiale configurato"
        : selectedMaterial ? `Selezionato: ${selectedMaterial}` : "Seleziona un materiale";
    }
    if (colorSelect) colorSelect.setAttribute("aria-invalid", String(!colorReady));
    if (materialSelect) materialSelect.setAttribute("aria-invalid", String(!materialReady));

    if (!colorReady) missing.push("il colore");
    if (!materialReady) missing.push("il materiale");
    if (colorOptions.length === 0) unconfigured.push("il colore");
    if (materialOptions.length === 0) unconfigured.push("il materiale");

    if (selectionStatus) {
      selectionStatus.textContent = unconfigured.length
        ? `Non è possibile aggiungere questo prodotto: configura ${unconfigured.join(" e ")}.`
        : complete
          ? `Scelta completa: ${selectedColor} · ${selectedMaterial}.`
          : `Per aggiungere il prodotto, seleziona ${missing.join(" e ")}.`;
      selectionStatus.classList.toggle("is-complete", complete);
    }

    addToCartButtons.forEach((button) => {
      button.disabled = !complete;
    });
    if (stickySelectionHint) {
      stickySelectionHint.hidden = complete;
      stickySelectionHint.textContent = unconfigured.length
        ? "Opzioni da configurare"
        : `Seleziona ${missing.join(" e ")}`;
    }
  }

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

  function updateDisabledColors() {
    const allowed = selectedMaterial
      ? new Set(images.filter((img) => img.material === selectedMaterial && img.color).map((img) => img.color))
      : null;
    colorOptions.forEach((option) => {
      const enabled = !allowed || allowed.size === 0 || allowed.has(option.value);
      option.disabled = !enabled;
      if (!enabled && selectedColor === option.value) selectedColor = "";
    });
    if (colorSelect) colorSelect.value = selectedColor;
  }

  function updateDisabledMaterials() {
    const allowed = selectedColor
      ? new Set(images.filter((img) => img.color === selectedColor && img.material).map((img) => img.material))
      : null;
    materialOptions.forEach((option) => {
      const enabled = !allowed || allowed.size === 0 || allowed.has(option.value);
      option.disabled = !enabled;
      if (!enabled && selectedMaterial === option.value) selectedMaterial = "";
    });
    if (materialSelect) materialSelect.value = selectedMaterial;
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
    if (product.is_custom || price == null) {
      stickyPriceBlock.classList.remove("is-discounted");
      if (stickyPriceOld) stickyPriceOld.style.display = "none";
      if (stickyPriceDiscount) stickyPriceDiscount.style.display = "none";
      stickyPriceCurrent.textContent = "Su richiesta";
      return;
    }
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
    const base = product.base_price;
    const price = priceValue ?? base;
    const discount = discountValue ?? null;
    if (product.is_custom || base == null) {
      priceBlock.classList.remove("is-discounted");
      priceOld.style.display = "none";
      priceDiscount.style.display = "none";
      priceCurrent.textContent = "Su richiesta";
      syncStickyPrice(base, discount);
      return;
    }
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
    updateSelectionState();
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

    if (product.is_custom || product.base_price == null) {
      setPriceDisplay(null, null);
    } else {
      const variant = getVariantMatch();
      if (variant) {
        setPriceDisplay(variant.price, variant.discount_price);
      } else {
        setPriceDisplay(product.base_price, product.base_discount_price);
      }
    }
  }

  if (colorSelect) {
    colorSelect.addEventListener("change", () => {
      selectedColor = colorSelect.value;
      updateImage();
    });
  }

  if (materialSelect) {
    materialSelect.addEventListener("change", () => {
      selectedMaterial = materialSelect.value;
      updateImage();
    });
  }

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

  if (lightbox && lightboxImage) {
    const closeTargets = qsa("[data-close]", lightbox);
    const closeLightbox = () => lightbox.classList.remove("is-open");
    mainImage.addEventListener("click", () => {
      openImageLightbox(mainImage.currentSrc || mainImage.src, mainImage.alt);
    });
    closeTargets.forEach((btn) => btn.addEventListener("click", closeLightbox));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeLightbox();
    });
  }

  function renderRelatedProducts() {
    const section = qs("#related-products");
    const track = qs("#related-track");
    if (!section || !track || !Array.isArray(allProducts)) return;

    if (product.is_custom) {
      section.hidden = true;
      return;
    }

    const pool = allProducts.filter((item) => !item.is_custom);
    const sameCategory = pool.filter(
      (item) => item.slug !== product.slug && item.category === product.category
    );
    const fallback = pool.filter(
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

    track.innerHTML = related.map(product => renderProductCard(product, site)).join("");
    section.hidden = false;
    setupCategoryCarousels();
  }

  updateImage();

  if (!product.is_custom) {
    renderReviews(product.slug, reviews, openImageLightbox);
    addToCartButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (!hasCompleteSelection()) {
          updateSelectionState();
          return;
        }
        const variant = getVariantMatch();
        const price = variant?.discount_price ?? variant?.price ?? product.base_discount_price ?? product.base_price;
        addInquiryItem(product, {
          color: selectedColor,
          material: selectedMaterial,
          image: findMatch()?.file || "",
          price
        });
      });
    });

    const footer = qs(".footer");
    if (stickyCta && footer && "IntersectionObserver" in window) {
      const footerObserver = new IntersectionObserver(([entry]) => {
        const footerIsVisible = entry.isIntersecting;
        stickyCta.classList.toggle("is-footer-visible", footerIsVisible);
        stickyCta.setAttribute("aria-hidden", String(footerIsVisible));
        stickyCta.inert = footerIsVisible;
      });
      footerObserver.observe(footer);
    }
  }
  renderRelatedProducts();
}

function renderReviews(slug, reviewsData, openImage) {
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
      let imageMarkup;
      if (typeof img === "string") {
        imageMarkup = buildOptimizedImageMarkup("reviews", img, "Foto recensione", {
          loading: "lazy",
          decoding: "async"
        });
      } else {
        imageMarkup = buildOptimizedImageMarkup("reviews", img.file, "Foto recensione", {
          webpFile: img.webp_file,
          loading: "lazy",
          decoding: "async"
        });
      }
      return `<button class="review-image-button" type="button" data-review-image aria-label="Ingrandisci la foto di ${escapeHtml(review.name || "un cliente")}">${imageMarkup}</button>`;
    }).join("");
    const imagesBlock = images ? `<div class="review-images">${images}</div>` : "";
    const dateBlock = review.date ? `<p class="muted">${escapeHtml(review.date)}</p>` : "";
    return `
      <div class="review-card">
        <div class="review-head">
          <strong>${escapeHtml(review.name || "Cliente")}</strong>
        </div>
        <p>${escapeHtml(review.text || "")}</p>
        ${dateBlock}
        ${imagesBlock}
      </div>
    `;
  }).join("");
  qsa("[data-review-image]", list).forEach((button) => {
    button.addEventListener("click", () => {
      const image = qs("img", button);
      if (image) openImage(image.currentSrc || image.src, image.alt);
    });
  });
}
export { renderProductPage };
