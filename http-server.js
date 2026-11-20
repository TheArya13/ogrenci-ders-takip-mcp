
const express = require("express");
const path = require("path");
const fs = require("fs");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require(
  "@modelcontextprotocol/sdk/server/streamableHttp.js"
);
const { z } = require("zod");

const app = express();
app.use(express.json());

const DOSYA = path.join(__dirname, "dersler.json");

function dersleriOku() {
  if (!fs.existsSync(DOSYA)) return [];

  try {
    const veri = JSON.parse(fs.readFileSync(DOSYA, "utf8"));
    return Array.isArray(veri) ? veri : [];
  } catch (hata) {
    console.error("Dersler okunamadı:", hata);
    return [];
  }
}

function dersleriKaydet(dersler) {
  fs.writeFileSync(
    DOSYA,
    JSON.stringify(dersler, null, 2),
    "utf8"
  );
}

function dersGecerliMi(d) {
  return d &&
    typeof d.ad === "string" &&
    d.ad.trim().length > 0 &&
    typeof d.kod === "string" &&
    d.kod.trim().length > 0 &&
    Number.isInteger(d.kredi) &&
    d.kredi > 0 &&
    Number.isFinite(d.not) &&
    d.not >= 0 &&
    d.not <= 100;
}

// Web sitesi
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Dersleri listele
app.get("/api/dersler", (req, res) => {
  res.json(dersleriOku());
});

// Ders ekle
app.post("/api/dersler", (req, res) => {
  const ders = req.body;

  if (!dersGecerliMi(ders)) {
    return res.status(400).json({
      error: "Geçersiz ders bilgileri"
    });
  }

  try {
    const dersler = dersleriOku();
    dersler.push({
      ad: ders.ad.trim(),
      kod: ders.kod.trim(),
      kredi: ders.kredi,
      not: ders.not
    });
    dersleriKaydet(dersler);

    res.status(201).json({
      mesaj: "Ders eklendi"
    });
  } catch (hata) {
    res.status(500).json({
      error: "Ders kaydedilemedi"
    });
  }
});

// Ders düzenle
app.put("/api/dersler/:index", (req, res) => {
  const index = Number(req.params.index);
  const ders = req.body;
  const dersler = dersleriOku();

  if (!Number.isInteger(index) ||
      index < 0 ||
      index >= dersler.length) {
    return res.status(404).json({
      error: "Ders bulunamadı"
    });
  }

  if (!dersGecerliMi(ders)) {
    return res.status(400).json({
      error: "Geçersiz ders bilgileri"
    });
  }

  try {
    dersler[index] = {
      ad: ders.ad.trim(),
      kod: ders.kod.trim(),
      kredi: ders.kredi,
      not: ders.not
    };

    dersleriKaydet(dersler);
    res.json({ mesaj: "Ders güncellendi" });
  } catch (hata) {
    res.status(500).json({
      error: "Ders güncellenemedi"
    });
  }
});

// Ders sil
app.delete("/api/dersler/:index", (req, res) => {
  const index = Number(req.params.index);
  const dersler = dersleriOku();

  if (!Number.isInteger(index) ||
      index < 0 ||
      index >= dersler.length) {
    return res.status(404).json({
      error: "Ders bulunamadı"
    });
  }

  try {
    dersler.splice(index, 1);
    dersleriKaydet(dersler);
    res.json({ mesaj: "Ders silindi" });
  } catch (hata) {
    res.status(500).json({
      error: "Ders silinemedi"
    });
  }
});

// Sunucu durumu
app.get("/api/status", (req, res) => {
  res.json({
    proje: "EduTrack Öğrenci Ders Takip",
    durum: "Çalışıyor",
    mcp_endpoint: "/mcp"
  });
});

// MCP araçları
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
        text: JSON.stringify(dersleriOku(), null, 2)
      }]
    })
  );

  server.registerTool(
    "ders_ekle",
    {
      description: "Yeni ders ve not ekler",
      inputSchema: {
        ad: z.string().min(1),
        not: z.number().min(0).max(100)
      }
    },
    async ({ ad, not }) => {
      const dersler = dersleriOku();

      dersler.push({
        ad,
        kod: "MCP" + (dersler.length + 1),
        kredi: 1,
        not
      });

      dersleriKaydet(dersler);

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
      description: "Kredi ağırlıklı not ortalamasını hesaplar"
    },
    async () => {
      const dersler = dersleriOku();

      const toplamKredi = dersler.reduce(
        (t, d) => t + d.kredi, 0
      );

      const toplamNot = dersler.reduce(
        (t, d) => t + d.not * d.kredi, 0
      );

      const ortalama = toplamKredi
        ? toplamNot / toplamKredi
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

// MCP bağlantısı
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
  } catch (hata) {
    console.error(hata);

    if (!res.headersSent) {
      res.status(500).json({
        error: "MCP sunucu hatası"
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
  console.log(
    `EduTrack MCP sunucusu ${PORT} portunda çalışıyor`
  );
});
