
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

const server = new McpServer({
  name: "ogrenci-ders-takip",
  version: "1.0.0"
});

const dersler = [
  { ad: "İnternet Programcılığı", not: 85 },
  { ad: "Veritabanı Yönetimi", not: 90 },
  { ad: "İşletme Yönetimi", not: 80 }
];

server.registerTool(
  "dersleri_listele",
  {
    description: "Öğrencinin bütün derslerini listeler"
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
    description: "Yeni bir ders ve not ekler",
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
    description: "Derslerin not ortalamasını hesaplar"
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
