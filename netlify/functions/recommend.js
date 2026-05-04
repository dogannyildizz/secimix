exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Sadece POST istekleri kabul edilir." })
    };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "GEMINI_API_KEY tanımlı değil. Netlify Environment Variables alanını kontrol et."
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

    const prompt = `
Kullanıcının bütçesi: ${budget} ${currency}
Ürün kategorisi: ${category}
Aranan ürün/tip: ${productType || "Belirtilmedi"}
Kullanım amacı: ${purpose}
Ek beklenti: ${expectation || "Belirtilmedi"}

Bu bilgilere göre fiyat performans açısından en mantıklı 3 ürün öner.

Kurallar:
- Türkiye pazarı odaklı düşün.
- Güncel fiyatı kesin bilmiyorsan yaklaşık olduğunu belirt.
- Gerçek satın alma linki bilmiyorsan link alanına "#" koy.
- Kullanıcıyı yanıltacak kesin fiyat veya stok iddiası yazma.
- Yanıtı sadece geçerli JSON olarak ver.
- Markdown, açıklama veya JSON dışı metin yazma.
- Tam olarak 3 ürün döndür.

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

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json"
          }
        })
      }
    );

    const geminiData = await geminiResponse.json();

    if (!geminiResponse.ok) {
      return {
        statusCode: geminiResponse.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error:
            geminiData.error?.message ||
            "Gemini API isteği başarısız oldu."
        })
      };
    }

    const outputText =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!outputText) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Gemini boş yanıt döndürdü."
        })
      };
    }

    let parsed;

    try {
      parsed = JSON.parse(outputText);
    } catch (parseError) {
      const jsonMatch = outputText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        return {
          statusCode: 500,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: "Gemini yanıtı JSON olarak okunamadı.",
            raw: outputText
          })
        };
      }

      parsed = JSON.parse(jsonMatch[0]);
    }

    if (!parsed.products || !Array.isArray(parsed.products)) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Gemini yanıtında products listesi bulunamadı."
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
