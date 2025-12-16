/**
 * public/product.js
 * Product page that matches your style + uses the same cart drawer.
 * Cart is persisted in localStorage so it works across pages.
 *
 * Upgrades:
 * - Gallery (main + thumbs, up to 10)
 * - Features + Details (from products.json)
 * - Current settings summary (live)
 * - Bandana-only size guide link
 */

let PRODUCTS = [];
let CART = [];

const LS_CART_KEY = "gf_cart_v1";

const mountEl = document.getElementById("productMount");
const crumbNameEl = document.getElementById("crumbName");

// Cart DOM
const cartButtonEl = document.getElementById("cartButton");
const cartDrawerEl = document.getElementById("cartDrawer");
const closeCartEl = document.getElementById("closeCart");
const cartItemsEl = document.getElementById("cartItems");
const cartTotalEl = document.getElementById("cartTotal");
const cartCountEl = document.getElementById("cartCount");
const checkoutButtonEl = document.getElementById("checkoutButton");

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function dollars(n) {
  return `$${Number(n).toFixed(2)}`;
}

function loadCart() {
  try {
    const raw = localStorage.getItem(LS_CART_KEY);
    CART = raw ? JSON.parse(raw) : [];
  } catch {
    CART = [];
  }
}

function saveCart() {
  localStorage.setItem(LS_CART_KEY, JSON.stringify(CART));
}

function cartCount() {
  return CART.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

function cartTotal() {
  return CART.reduce((sum, item) => {
    const p = PRODUCTS.find((x) => x.id === item.id);
    return p ? sum + p.price * item.quantity : sum;
  }, 0);
}

function renderCartBadge() {
  if (!cartCountEl) return;
  cartCountEl.textContent = String(cartCount());
}

function openCart() {
  cartDrawerEl?.classList.remove("translate-x-full");
  renderCart();
}

function closeCart() {
  cartDrawerEl?.classList.add("translate-x-full");
}

cartButtonEl?.addEventListener("click", (e) => {
  e.stopPropagation();
  openCart();
});
closeCartEl?.addEventListener("click", (e) => {
  e.stopPropagation();
  closeCart();
});
cartDrawerEl?.addEventListener("click", (e) => e.stopPropagation());

document.addEventListener("click", (e) => {
  const isOpen = cartDrawerEl && !cartDrawerEl.classList.contains("translate-x-full");
  if (!isOpen) return;
  if (cartDrawerEl.contains(e.target) || cartButtonEl?.contains(e.target)) return;
  closeCart();
});

// ---- sizes: supports strings OR {value,label}
function sizeValue(sizeItem) {
  return typeof sizeItem === "string" ? sizeItem : (sizeItem?.value || "");
}
function sizeLabel(sizeItem) {
  return typeof sizeItem === "string" ? sizeItem : (sizeItem?.label || sizeItem?.value || "");
}
function getSizeLabelFromValue(opt, value) {
  if (!opt?.sizes || !Array.isArray(opt.sizes) || !value) return value;
  const found = opt.sizes.find((s) => sizeValue(s) === value);
  return found ? sizeLabel(found) : value;
}
function getColorLabel(opt, value) {
  if (!opt?.colors || !Array.isArray(opt.colors) || !value) return value;
  const found = opt.colors.find((c) => c.value === value);
  return found ? (found.label || value) : value;
}

// ---- dog name normalization
function normalizeDogName(raw) {
  const v = (raw || "").trim();
  if (!v) return null;
  if (/^(blank|none)$/i.test(v)) return "none";
  return v.length > 15 ? v.slice(0, 15) : v;
}

// ---- colors (swatch specific image if present)
function getDisplayImage(product, selectedColor) {
  const opt = product?.options || {};
  if (opt.colors && Array.isArray(opt.colors) && selectedColor) {
    const c = opt.colors.find((x) => x.value === selectedColor);
    if (c?.image) return c.image;
  }
  return product.image;
}

function getCartItemImage(product, item) {
  const opt = product?.options || {};
  if (opt.colors && Array.isArray(opt.colors) && item.color) {
    const c = opt.colors.find((x) => x.value === item.color);
    if (c?.image) return c.image;
  }
  return product.image;
}

// ---- gallery helpers
function getGalleryImages(product, selectedColor) {
  // Priority:
  // 1) if swatch has an image, it becomes first image
  // 2) then product.images (up to 10)
  // 3) fallback to product.image
  const out = [];

  const swatchImg = getDisplayImage(product, selectedColor);
  if (swatchImg) out.push(swatchImg);

  const list = Array.isArray(product.images) ? product.images : [];
  for (const src of list) {
    if (src && !out.includes(src)) out.push(src);
  }

  if (out.length === 0 && product.image) out.push(product.image);

  return out.filter(Boolean).slice(0, 10);
}

function renderGallery(product, selectedColor) {
  const main = document.getElementById("pMainImage");
  const grid = document.getElementById("pThumbGrid");
  if (!main || !grid) return;

  const imgs = getGalleryImages(product, selectedColor);

  main.src = imgs[0] || "";
  main.alt = product.name || "Product image";

  grid.innerHTML = imgs
    .map(
      (src, i) => `
      <button type="button"
        class="rounded-xl overflow-hidden border border-slate-200 hover:border-slate-900"
        data-thumb="${i}"
        aria-label="View image ${i + 1}">
        <img src="${src}" loading="lazy"
          class="w-full h-full object-cover aspect-square bg-slate-100" alt="">
      </button>
    `
    )
    .join("");

  grid.querySelectorAll("[data-thumb]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-thumb"));
      if (!Number.isFinite(idx)) return;
      const src = imgs[idx];
      if (src) main.src = src;
    });
  });
}

function isBandana(product) {
  const t = String(product.type || "").toLowerCase();
  if (t.includes("bandana")) return true;

  const tags = Array.isArray(product.tags) ? product.tags : [];
  return tags.some((x) => String(x).toLowerCase().includes("bandana"));
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = html || "";
}

function renderFeaturesAndDetails(product) {
  // Features
  const features = Array.isArray(product.features) ? product.features : [];
  const featureHtml = features.length
    ? features.map((f) => `<li class="flex gap-2"><span>•</span><span>${f}</span></li>`).join("")
    : `<li class="text-slate-500">No extra details listed yet.</li>`;
  setHtml("pFeatureList", featureHtml);

  // Details (optional)
  const d = product.details || {};
  const row = (label, value) => {
    if (!value) return "";
    return `
      <div class="rounded-2xl border border-slate-200 p-4">
        <div class="text-xs uppercase tracking-wide text-slate-500">${label}</div>
        <div class="mt-1 text-sm text-slate-700">${value}</div>
      </div>
    `;
  };

  const detailsHtml =
    row("Materials", d.materials) +
    row("Care", d.care) +
    row("Sizing notes", d.sizingNote) +
    row("Shipping", d.shipping);

  setHtml("pDetailsGrid", detailsHtml || "");
}

function renderSettingsSummary(opt, state) {
  const el = document.getElementById("pSettingsSummary");
  if (!el) return;

  const parts = [];
  if (state.color) parts.push(`Color: ${getColorLabel(opt, state.color)}`);
  if (state.size) parts.push(`Size: ${getSizeLabelFromValue(opt, state.size)}`);
  if (opt.dogName && state.dogName) parts.push(`Name: ${state.dogName}`);
  if (opt.note && state.note) parts.push(`Note: ${state.note}`);

  el.textContent = parts.length ? parts.join(" • ") : "No options selected yet.";
}

function renderCart() {
  if (!cartItemsEl || !cartTotalEl) return;

  if (CART.length === 0) {
    cartItemsEl.innerHTML = `<p class="text-slate-600">Your cart is empty.</p>`;
    cartTotalEl.textContent = dollars(0);
    return;
  }

  cartItemsEl.innerHTML = CART
    .map((item, idx) => {
      const p = PRODUCTS.find((x) => x.id === item.id);
      if (!p) return "";

      const opt = p.options || {};
      const details = [
        item.color ? `Color: ${getColorLabel(opt, item.color)}` : "",
        item.size ? `Size: ${getSizeLabelFromValue(opt, item.size)}` : "",
        item.dogName ? `Name: ${item.dogName}` : "No personalization",
        item.note ? `Note: ${item.note}` : "",
      ]
        .filter(Boolean)
        .join(" • ");

      const thumb = getCartItemImage(p, item);

      return `
      <div class="py-3 border-b border-slate-200">
        <div class="flex justify-between gap-3">
          <div class="flex gap-3">
            <img src="${thumb}" alt="${p.name}"
              class="w-14 h-14 rounded-xl object-cover bg-slate-100 border border-slate-200" />
            <div>
              <p class="font-medium">${p.name}</p>
              <p class="text-xs text-slate-600 mt-1">${details}</p>
            </div>
          </div>

          <button class="text-xs text-slate-500 hover:text-emerald-700"
            data-remove="${idx}" type="button">Remove</button>
        </div>

        <div class="mt-2 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <button class="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
              data-qty="${idx}" data-delta="-1" type="button">-</button>
            <span class="text-sm">${item.quantity}</span>
            <button class="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
              data-qty="${idx}" data-delta="1" type="button">+</button>
          </div>
          <p class="text-sm font-semibold">${dollars(p.price * item.quantity)}</p>
        </div>
      </div>
    `;
    })
    .join("");

  cartItemsEl.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = Number(btn.getAttribute("data-remove"));
      CART.splice(idx, 1);
      saveCart();
      renderCartBadge();
      renderCart();
    });
  });

  cartItemsEl.querySelectorAll("[data-qty]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = Number(btn.getAttribute("data-qty"));
      const delta = Number(btn.getAttribute("data-delta"));
      if (!CART[idx]) return;

      CART[idx].quantity += delta;
      if (CART[idx].quantity <= 0) CART.splice(idx, 1);

      saveCart();
      renderCartBadge();
      renderCart();
    });
  });

  cartTotalEl.textContent = dollars(cartTotal());
}

checkoutButtonEl?.addEventListener("click", () => {
  alert("Stripe next. 🙂");
});

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function renderProductPage(product) {
  const opt = product.options || {};

  // Defaults
  let selectedColor = "";
  if (opt.colors && Array.isArray(opt.colors)) {
    selectedColor = opt.colors[0]?.value || "";
  }
  // Custom note (always show, with safe default)
  const customNote =
    product.details?.customNote || "Name printed in white. Text centered.";

  const customNoteHtml = `
    <div class="mt-3 text-sm text-slate-700">
      ${escapeHtml(customNote)}
    </div>
  `;


  mountEl.innerHTML = `
    <div class="grid md:grid-cols-2 gap-6 p-6">
      <div>
        <div class="rounded-3xl overflow-hidden bg-slate-100 border border-slate-200">
          <img id="pMainImage" src="" alt="${product.name}"
               class="w-full h-full object-cover aspect-[4/5]">
        </div>

        <div id="pThumbGrid" class="mt-3 grid grid-cols-5 gap-2"></div>

        ${
          opt.colors && Array.isArray(opt.colors)
            ? `<div class="mt-4 flex items-center gap-2 flex-wrap">
              ${opt.colors
                .map(
                  (c) => `
                <button
                  class="h-6 w-6 rounded-full border border-slate-200 hover:border-slate-900"
                  style="background:${c.swatch || "#000"}"
                  title="${c.label}"
                  aria-label="${c.label}"
                  data-color="${c.value}"
                  type="button"
                ></button>
              `
                )
                .join("")}
            </div>`
            : ""
        }
      </div>

      <div class="grid gap-5">
        <div>
          <h1 class="text-2xl font-semibold">${product.name}</h1>
          <p class="text-slate-600 mt-2">${product.description || ""}</p>
          <div class="mt-3 text-xl font-semibold text-emerald-700">${dollars(product.price)}</div>
        </div>

        <div class="rounded-2xl border border-slate-200 p-4">
          <div class="text-xs uppercase tracking-wide text-slate-500">Current settings</div>
          <div id="pSettingsSummary" class="mt-1 text-sm text-slate-700">No options selected yet.</div>
        </div>

        <div class="grid gap-3">
          ${
            opt.sizes && Array.isArray(opt.sizes)
              ? `<div>
                <label class="text-xs text-slate-600">
                  ${opt.sizeLabel || "Size"} <span class="text-red-600">${opt.sizesRequired ? "*" : ""}</span>
                  <select id="pSize" class="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2">
                    <option value="">Select size…</option>
                    ${opt.sizes.map((s) => `<option value="${sizeValue(s)}">${sizeLabel(s)}</option>`).join("")}
                  </select>
                </label>

                <div class="mt-1 flex items-center justify-between">
                  <p id="pSizeErr" class="hidden text-xs text-red-600">Please choose a size.</p>
                  <a id="pSizeGuide" href="./size-guide.html"
                     class="text-xs text-slate-500 hover:text-slate-800 underline">
                    Size guide
                  </a>
                </div>
              </div>`
              : ""
          }

          ${
            opt.dogName
              ? `<div>
                <label class="text-xs text-slate-600">
                  Dog’s name (type "blank" for none)
                  <input id="pDogName" maxlength="15"
                    class="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2"
                    placeholder="e.g., Shelby" />
                </label>
                <p id="pDogErr" class="hidden text-xs text-red-600 mt-1">
                  Please enter dog's name or type "blank".
                </p>
              </div>`
              : ""
          }

          ${
            opt.note
              ? `<div>
                <label class="text-xs text-slate-600">
                  Special request (optional)
                  <textarea id="pNote" class="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2"
                    rows="3" placeholder="font/design changes, note to staff, etc."></textarea>
                </label>
              </div>`
              : ""
          }
        </div>

        <div class="flex gap-3 pt-1">
          <button id="pAdd"
            class="flex-1 px-4 py-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-500"
            type="button">
            Add to cart
          </button>
          <button id="pOpenCart"
            class="px-4 py-2 rounded-full border border-slate-200 hover:bg-slate-50"
            type="button">
            View cart
          </button>
        </div>

        <p class="text-xs text-slate-500">
          Dog names are limited to 15 characters (because thread is not infinite).
        </p>

        <div class="mt-2">
          <h2 class="text-lg font-semibold">Features</h2>
          <ul id="pFeatureList" class="mt-2 space-y-2 text-sm text-slate-700"></ul>
        </div>

        <div class="mt-2">
          <h2 class="text-lg font-semibold">Details</h2>
          <div id="pDetailsGrid" class="mt-2 grid gap-3"></div>
        </div>
      </div>
    </div>
  `;

  // Bandana-only size guide link
  const sizeGuide = document.getElementById("pSizeGuide");
  if (sizeGuide) {
    sizeGuide.style.display = isBandana(product) ? "inline" : "none";
  }

  // Initial gallery + content
  renderGallery(product, selectedColor);
  renderFeaturesAndDetails(product);

  const sizeEl = document.getElementById("pSize");
  const dogEl = document.getElementById("pDogName");
  const noteEl = document.getElementById("pNote");

  const sizeErr = document.getElementById("pSizeErr");
  const dogErr = document.getElementById("pDogErr");

  const state = {
    color: opt.colors ? (selectedColor || "") : "",
    size: "",
    dogName: "",
    note: "",
  };

  function show(el, on) {
    if (!el) return;
    el.classList.toggle("hidden", !on);
  }

  function syncSummary() {
    renderSettingsSummary(opt, state);
  }

  document.getElementById("pOpenCart")?.addEventListener("click", openCart);

  // Swatches
  mountEl.querySelectorAll("[data-color]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedColor = btn.getAttribute("data-color") || "";
      state.color = selectedColor;
      renderGallery(product, selectedColor); // swaps main image + thumbs (swatch image takes priority)
      syncSummary();
    });
  });

  sizeEl?.addEventListener("change", () => {
    state.size = sizeEl.value || "";
    show(sizeErr, false);
    syncSummary();
  });

  dogEl?.addEventListener("input", () => {
    state.dogName = (dogEl.value || "").trim();
    show(dogErr, false);
    syncSummary();
  });

  noteEl?.addEventListener("input", () => {
    state.note = (noteEl.value || "").trim();
    syncSummary();
  });

  syncSummary();

  document.getElementById("pAdd")?.addEventListener("click", () => {
    // Build selections
    const sizeVal = sizeEl ? (sizeEl.value || "") : "";
    let dogVal = dogEl ? (dogEl.value || "") : "";
    const noteVal = noteEl ? (noteEl.value || "").trim() : "";

    // Validate size
    if (opt.sizesRequired && !sizeVal) {
      show(sizeErr, true);
      return;
    } else {
      show(sizeErr, false);
    }

    // Validate dog (prompted)
    if (opt.dogName && opt.dogNamePrompt) {
      const normalized = normalizeDogName(dogVal);
      if (!normalized) {
        show(dogErr, true);
        dogEl?.focus();
        return;
      }
      dogVal = normalized;
      show(dogErr, false);
    } else {
      show(dogErr, false);
    }

    const line = {
      id: product.id,
      quantity: 1,
      size: sizeVal,
      dogName: opt.dogName ? (dogVal || "").trim() : "",
      note: opt.note ? noteVal : "",
      color: opt.colors ? (selectedColor || "") : "",
    };

    // Merge identical items
    const keyMatch = (item) =>
      item.id === line.id &&
      (item.size || "") === (line.size || "") &&
      (item.dogName || "") === (line.dogName || "") &&
      (item.note || "") === (line.note || "") &&
      (item.color || "") === (line.color || "");

    const existing = CART.find(keyMatch);
    if (existing) existing.quantity += 1;
    else CART.push(line);

    saveCart();
    renderCartBadge();
    renderCart();
    openCart();
  });
}

async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function loadProducts() {
  // API first (when server.js is running), then fallback to local JSON for static dev
  try {
    return await getJson("/api/products");
  } catch {
    return await getJson("products.json");
  }
}

async function startup() {
  loadCart();
  renderCartBadge();

  // Support both ?id=... and ?slug=...
  const id = getQueryParam("id");
  const slug = getQueryParam("slug");
  const key = (slug || id || "").trim();

  if (!key) {
    mountEl.innerHTML = `<div class="p-6 text-slate-600">Missing product id.</div>`;
    return;
  }

  try {
    PRODUCTS = await loadProducts();
  } catch (err) {
    console.error("Failed to load products:", err);
    mountEl.innerHTML = `<div class="p-6 text-slate-600">Could not load products.</div>`;
    return;
  }

  const p =
    PRODUCTS.find((x) => String(x.id) === key) ||
    PRODUCTS.find((x) => String(x.slug || x.handle || "") === key);

  if (!p) {
    mountEl.innerHTML = `<div class="p-6 text-slate-600">Product not found.</div>`;
    return;
  }

  document.title = `${p.name} • Gratitude Forge`;
  if (crumbNameEl) crumbNameEl.textContent = p.name;

  renderProductPage(p);
  renderCart();
}

document.addEventListener("DOMContentLoaded", startup);
