import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { esClient } from "./esClient.js";

const app = express();
app.use(cors());
app.use(express.json());

// Root
app.get("/", (req, res) => res.send("ElasticSearch + Socket.IO demo server running!"));

// Socket.IO setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join-room", (room) => socket.join(room));

  socket.on("send-message", ({ room, message }) => {
    io.to(room).emit("receive-message", { from: socket.id, message });
  });
});

// ADD PRODUCT (FULL DATA SAVED)
app.post("/add-product", async (req, res) => {
  try {
    const { name, price, category, brand } = req.body;
    if (!name || !price) return res.status(400).json({ error: "Name and price required" });

    // Check if index exists
    const indexExists = await esClient.indices.exists({ index: "products" });
    if (!indexExists.body) {
      await esClient.indices.create({ index: "products" }, { ignore: [400] });
      console.log("Index created: products");
    }

    // Index the full product
    const result = await esClient.index({
      index: "products",
      document: { name, price, category, brand },
      refresh: true
    });

    // Emit to clients
    io.to("products").emit("receive-message", {
      from: "SERVER",
      message: `New product added: ${name} - ₹${price} - ${category} - ${brand}`
    });

    res.json({ success: true, product: { name, price, category, brand } });
  } catch (e) {
    console.error("Add product error:", e);
    res.status(400).json({ error: e.message });
  }
});



// SEARCH PRODUCT (ALWAYS RETURNS CLEAN OBJECTS)
app.get("/search", async (req, res) => {
  try {
    const { q } = req.query;

    // Perform search
    const result = await esClient.search({
      index: "products",
      query: {
        multi_match: {
          query: q || "",
          fields: ["name", "category", "brand"]
        }
      }
    });

    // Map hits to clean objects
    const out = result.hits.hits.map(h => ({
      name: h._source?.name ?? "N/A",
      price: h._source?.price ?? "N/A",
      category: h._source?.category ?? "N/A",
      brand: h._source?.brand ?? "N/A"
    }));

    res.json(out);
  } catch (err) {
    console.error("Search error:", err);
    res.status(400).json({ error: err.message });
  }
});


server.listen(3000, () => console.log("Server running on port 3000"));
