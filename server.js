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

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// AUTO JOIN ROOM (no manual join required)
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.join("products");
});

// ===== CREATE INDEX =====
async function createIndexIfNotExists() {
  try {
    const indexExists = await esClient.indices.exists({ index: "products" });

if (!indexExists.body) {
  await esClient.indices.create({
    index: "products",
    settings: {
      analysis: {
        analyzer: {
          ngram_analyzer: {
            tokenizer: "ngram_tokenizer",
            filter: ["lowercase"]
          }
        },
        tokenizer: {
          ngram_tokenizer: {
            type: "ngram",
            min_gram: 2,
            max_gram: 8,
            token_chars: ["letter", "digit"]
          }
        }
      }
    },
    mappings: {
      properties: {
        name: {
          type: "text",
          analyzer: "ngram_analyzer",
          fields: {
            std: { type: "text", analyzer: "standard" }   // fuzzy works here
          }
        },
        category: {
          type: "text",
          analyzer: "ngram_analyzer",
          fields: {
            std: { type: "text", analyzer: "standard" }
          }
        },
        brand: {
          type: "text",
          analyzer: "ngram_analyzer",
          fields: {
            std: { type: "text", analyzer: "standard" }
          }
        }
      }
    }
  });

  console.log("Index created with N-gram + fuzzy support");
}

     else {
      console.log("Index already exists");
    }
  } catch (err) {
    console.error("Error creating index:", err);
  }
}

createIndexIfNotExists();

// ===== ADD PRODUCT =====
app.post("/add-product", async (req, res) => {
  try {
    const { name, price, category, brand } = req.body;
    if (!name || !price || !category || !brand) 
   return res.status(400).json({ error: "All fields are required" });


    await esClient.index({
      index: "products",
      document: { name, price, category, brand },
      refresh: true
    });

    io.to("products").emit("receive-message", {
      message: `New product: ${name} - ₹${price} - ${category} - ${brand}`
    });

    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ===== SEARCH PRODUCT =====
app.get("/search", async (req, res) => {
  try {
    const { q } = req.query;

const result = await esClient.search({
  index: "products",
  query: {
    multi_match: {
      query: q,
      fields: [
        "name", "name.std",
        "category", "category.std",
        "brand", "brand.std"
      ],
      fuzziness: "AUTO"
    }
  }
});


    const out = result.hits.hits.map(h => h._source);

    res.json(out);
  } catch (err) {
    console.error("Search error:", err);
    res.status(400).json({ error: err.message });
  }
});

server.listen(3000, () => console.log("Server running on port 3000"));
