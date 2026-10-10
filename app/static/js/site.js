import {
  PRODUCT_SLUG_ALIASES,
  applySiteData,
  getCatalog,
  getMaterials,
  getReviews,
  getSite,
  setupCustomForm,
  setupModal,
  setupNavMenu
} from "./core.js";
import {
  initHomePage,
  renderMaterialsPage,
  renderProductsPage,
  renderWorksPage
} from "./catalog.js";
import { renderProductPage } from "./product.js";
import { setupInquiryCart } from "./cart.js";

async function init() {
  const page = document.body.dataset.page;
  setupNavMenu();
  const site = await getSite();
  applySiteData(site);
  setupInquiryCart(site);
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
    const color = params.get("color");
    renderProductsPage(products, material, category, color, site);
  }

  if (page === "works") {
    const products = await getCatalog();
    renderWorksPage(products, site);
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
