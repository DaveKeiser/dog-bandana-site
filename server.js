// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const Stripe = require("stripe");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// If you haven't set STRIPE_SECRET_KEY yet, this will just be an empty string.
// That's fine for Day 1 – checkout just won't work yet.
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const PRODUCTS_FILE = path.join(__dirname, "products.json");

function readProducts() {
  const data = fs.readFileSync(PRODUCTS_FILE, "utf-8");
  return JSON.parse(data);
}

function writeProducts(products) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf-8");
}

// GET all products
app.get("/api/products", (req, res) => {
  const products = readProducts();
  res.json(products);
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

// Stripe Checkout (we'll fully wire this on Day 2)
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
