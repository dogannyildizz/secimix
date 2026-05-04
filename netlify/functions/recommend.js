exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Sadece POST istekleri kabul edilir." })
    };
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "OPENAI_API_KEY tanımlı değil. Netlify Environment Variables alanını kontrol et."
        })
      };
    }

    const body = JSON.parse(event.body || "{}");

    const budget = Number(body.budget);
    const currency = body.currency || "TL";
    const category = body.category || "Ürün";
    const productType = (body.productType || "").trim();
    const purpose = body.purpose || "Genel kullanım";
    const expectation = (body.expectation || "").trim();

    if (!budget || budget <= 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Geçerli bir bütçe girilmedi." })
      };
    }

    const userPrompt = `
Kullanıcının bütçesi: ${budget} ${currency}
Ürün kategorisi: ${category}
Aranan ürün/tip: ${productType || "Belirtilmedi"}
Kullanım amacı: ${purpose}
Ek beklenti: ${expectation || "Belirtilmedi"}

Bu bilgilere göre fiyat performans açısından en mantıklı 3 ürün öner.

Önemli kurallar:
- Türkiye pazarı odaklı düşün.
- Güncel fiyatı kesin bilmiyorsan "yaklaşık" olduğunu belirt.
- Gerçek satın alma linki bilmiyorsan link alanına "#" koy.
- Kullanıcıyı yanıltacak kesin fiyat veya stok iddiası yazma.
- Yanıtı sadece geçerli JSON olarak ver.
- JSON dışında açıklama, markdown veya ek metin yazma.

JSON formatı tam olarak şöyle olsun:
{
  "products": [
    {
      "rank": "1. En dengeli tercih",
      "name": "Ürün adı",
      "price": "Yaklaşık fiyat",
      "score": "F/P Puanı: 9.0/10",
      "priceScore": "9/10",
      "performanceScore": "9/10",
      "needScore": "9/10",
      "suitableFor": "Kimler için uygun?",
      "reason": "Neden önerildiği",
      "pros": "Artı yönü",
      "cons": "Eksi yönü",
      "sourceNote": "Fiyat ve stok bilgileri doğrulanmalıdır.",
      "link": "#"
    }
  ]
}
`;

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "Sen fiyat performans odaklı ürün önerileri hazırlayan dikkatli bir ürün analiz asistanısın. Kullanıcıyı yanıltma. Emin olmadığın fiyat, stok ve link bilgilerini kesinmiş gibi yazma. Yanıtı yalnızca geçerli JSON olarak ver."
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        temperature: 0.4
      })
    });

    const openaiData = await openaiResponse.json();

    if (!openaiResponse.ok) {
      return {
        statusCode: openaiResponse.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: openaiData.error?.message || "OpenAI API isteği başarısız oldu."
        })
      };
    }

    const outputText =
      openaiData.output_text ||
      openaiData.output?.[0]?.content?.[0]?.text ||
      "";

    let parsed;

    try {
      parsed = JSON.parse(outputText);
    } catch (parseError) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "OpenAI yanıtı JSON olarak okunamadı.",
          raw: outputText
        })
      };
    }

    if (!parsed.products || !Array.isArray(parsed.products)) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "OpenAI yanıtında products listesi bulunamadı."
        })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        products: parsed.products.slice(0, 3)
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Backend tarafında beklenmeyen bir hata oluştu."
      })
    };
  }
};
