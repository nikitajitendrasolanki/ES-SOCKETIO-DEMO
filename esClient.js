// esClient.js
import { Client } from "@elastic/elasticsearch";

export const esClient = new Client({
  node: "http://localhost:9200",
  headers: {
    "Accept": "application/vnd.elasticsearch+json; compatible-with=8"
  }
});
