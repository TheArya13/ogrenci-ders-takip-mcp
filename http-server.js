
const express = require("express");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require(
  "@modelcontextprotocol/sdk/server/streamableHttp.js"
);
const { z } = require("zod");

const app = express();
app.use(express.json());

const dersler = [
  { ad: "İnternet Programcılığı", not: 85 },
  { ad: "Veritabanı Yönetimi", not: 90 },
  { ad: "İşletme Yönetimi", not: 80 }
];

function createServer() {
  const server = new McpServer({
    name: "ogrenci-ders-takip",
    version: "1.0.0"
  });

  server.registerTool(
    "dersleri_listele",
    {
      description: "Öğrencinin derslerini listeler"
    },
    async () => ({
      content: [{
        type: "text",
        text: JSON.stringify(dersler, null, 2)
      }]
    })
  );

  server.registerTool(
    "ders_ekle",
    {
      description: "Yeni ders ve not ekler",
      inputSchema: {
        ad: z.string(),
        not: z.number().min(0).max(100)
      }
    },
    async ({ ad, not }) => {
      dersler.push({ ad, not });
      return {
        content: [{
          type: "text",
          text: `${ad} dersi başarıyla eklendi.`
        }]
      };
    }
  );

  server.registerTool(
    "ortalama_hesapla",
    {
      description: "Not ortalamasını hesaplar"
    },
    async () => {
      const toplam = dersler.reduce((t, d) => t + d.not, 0);
      const ortalama = dersler.length
        ? toplam / dersler.length
        : 0;

      return {
        content: [{
          type: "text",
          text: `Not ortalaması: ${ortalama.toFixed(2)}`
        }]
      };
    }
  );

  return server;
}

app.get("/", (req, res) => {
  res.json({
    proje: "Öğrenci Ders Takip MCP Sunucusu",
    durum: "Çalışıyor",
    mcp_endpoint: "/mcp"
  });
});

app.post("/mcp", async (req, res) => {
  const server = createServer();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Sunucu hatası"
      });
    }
  }
});

app.get("/mcp", (req, res) => {
  res.status(405).send("Method Not Allowed");
});

app.delete("/mcp", (req, res) => {
  res.status(405).send("Method Not Allowed");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`MCP HTTP sunucusu ${PORT} portunda çalışıyor`);
});
