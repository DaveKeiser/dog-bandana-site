// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const Stripe = require("stripe");
const multer = require("multer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// If you haven't set STRIPE_SECRET_KEY yet, this will just be an empty string.
// That's fine for Day 1 – checkout just won't work yet.
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "10mb" }));

// ----------------------
// BASIC AUTH (Admin only)
// ----------------------
function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, encoded] = header.split(" ");
  if (type !== "Basic" || !encoded) {
    return res.status(401).set("WWW-Authenticate", "Basic").send("Auth required");
  }

  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const [user, pass] = decoded.split(":");

  const ok =
    user === (process.env.ADMIN_USER || "admin") &&
    pass === (process.env.ADMIN_PASS || "changeme");

  if (!ok) return res.status(403).send("Forbidden");
  next();
}

// ----------------------
// PRODUCTS
// ----------------------
const PRODUCTS_FILE = path.join(__dirname, "products.json");

function readProducts() {
  const data = fs.readFileSync(PRODUCTS_FILE, "utf-8");
  return JSON.parse(data);
}

function writeProducts(products) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf-8");
}

// Public: GET all products (storefront uses this)
app.get("/api/products", (req, res) => {
  const products = readProducts();
  res.json(products);
});

// Admin: GET all products
app.get("/api/admin/products", requireAdmin, (req, res) => {
  const products = readProducts();
  res.json(products);
});

// Admin: SAVE all products (replace the whole array)
app.post("/api/admin/products", requireAdmin, (req, res) => {
  const products = req.body;

  if (!Array.isArray(products)) {
    return res.status(400).json({ error: "Body must be an array of products" });
  }

  // light sanity: ensure each product has an id
  for (const p of products) {
    if (!p.id) {
      // if someone used slug/name, fallback so you don’t lose work
      if (p.slug) p.id = p.slug;
      else return res.status(400).json({ error: "Each product must have an id (or slug)" });
    }
  }

  writeProducts(products);
  res.json({ ok: true, count: products.length });
});

// ----------------------
// UPLOADS (Admin)
// ----------------------
const UPLOAD_DIR = path.join(__dirname, "public", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});
const upload = multer({ storage });

// Admin: upload an image, returns public URL
app.post("/api/admin/upload", requireAdmin, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const url = `/uploads/${req.file.filename}`;
  res.json({ ok: true, url });
});

// ----------------------
// BLOG POSTS (home page blog)
// ----------------------
const POSTS_FILE = path.join(__dirname, "posts.json");

function readPosts() {
  const data = fs.readFileSync(POSTS_FILE, "utf-8");
  return JSON.parse(data);
}

// GET all blog posts
app.get("/api/posts", (req, res) => {
  const posts = readPosts();
  res.json(posts);
});

// ----------------------
// RATINGS
// ----------------------

// Rate a product
app.post("/api/products/:id/rate", (req, res) => {
  const productId = req.params.id;
  const { rating } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be between 1 and 5." });
  }

  const products = readProducts();
  const product = products.find(p => p.id === productId);

  if (!product) {
    return res.status(404).json({ error: "Product not found." });
  }

  product.ratingCount = product.ratingCount || 0;
  product.ratingTotal = product.ratingTotal || 0;

  product.ratingCount += 1;
  product.ratingTotal += rating;
  product.ratingAverage = product.ratingTotal / product.ratingCount;

  writeProducts(products);
  res.json({ success: true, product });
});

// ----------------------
// Stripe Checkout (we'll fully wire this on Day 2)
// ----------------------
app.post("/api/create-checkout-session", async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: "Stripe is not configured yet." });
  }

  try {
    const { items } = req.body; // [{ id, quantity }]
    const products = readProducts();

    const line_items = items.map(item => {
      const product = products.find(p => p.id === item.id);
      if (!product) throw new Error("Product not found for checkout.");

      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            description: product.description,
          },
          unit_amount: Math.round(product.price * 100), // dollars -> cents
        },
        quantity: item.quantity || 1,
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url: "https://example.com/success", // we'll customize later
      cancel_url: "https://example.com/cancel",
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create checkout session." });
  }
});

// Serve main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
