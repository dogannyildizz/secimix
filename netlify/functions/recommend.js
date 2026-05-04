exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Sadece POST istekleri kabul edilir." })
    };
  }

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "OPENROUTER_API_KEY tanımlı değil. Netlify Environment Variables alanını kontrol et."
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

    const routerResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://secimix.netlify.app",
        "X-Title": "Secimix"
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat-v3-0324:free",
        messages: [
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
        temperature: 0.3
      })
    });

    const routerData = await routerResponse.json();

    if (!routerResponse.ok) {
      return {
        statusCode: routerResponse.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error:
            routerData.error?.message ||
            routerData.message ||
            "OpenRouter API isteği başarısız oldu."
        })
      };
    }

    const outputText =
      routerData.choices?.[0]?.message?.content ||
      "";

    if (!outputText) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "OpenRouter boş yanıt döndürdü."
        })
      };
    }

    let parsed;

    try {
      parsed = JSON.parse(outputText);
    } catch (firstParseError) {
      const jsonMatch = outputText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        return {
          statusCode: 500,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: "OpenRouter yanıtı JSON olarak okunamadı.",
            raw: outputText
          })
        };
      }

      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (secondParseError) {
        return {
          statusCode: 500,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: "OpenRouter yanıtından JSON ayıklanamadı.",
            raw: outputText
          })
        };
      }
    }

    if (!parsed.products || !Array.isArray(parsed.products)) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Yanıtta products listesi bulunamadı."
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
