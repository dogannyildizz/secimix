export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/recommend") {
      return handleRecommend(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleRecommend(request, env) {
  if (request.method !== "POST") {
    return jsonResponse(
      { error: "Sadece POST istekleri kabul edilir." },
      405
    );
  }

  try {
    const apiKey = env.GEMINI_API_KEY;

    if (!apiKey) {
      return jsonResponse(
        {
          error:
            "GEMINI_API_KEY tanımlı değil. Cloudflare environment variables alanını kontrol et."
        },
        500
      );
    }

    const body = await request.json();

    const budget = Number(body.budget);
    const currency = body.currency || "TL";
    const category = body.category || "Ürün";
    const productType = (body.productType || "").trim();
    const purpose = body.purpose || "Genel kullanım";
    const expectation = (body.expectation || "").trim();

    if (!budget || budget <= 0) {
      return jsonResponse(
        { error: "Geçerli bir bütçe girilmedi." },
        400
      );
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
- Mümkün olduğunca gerçek ve bilinen ürün modelleri öner.
- Uydurma mağaza linki verme; gerçek linkten emin değilsen link alanına "#" koy.
- Güncel fiyatı kesin bilmiyorsan fiyatı "yaklaşık" olarak yaz.
- Kullanıcıyı yanıltacak kesin fiyat, kesin stok veya kesin kampanya iddiası yazma.
- Bütçeyi aşan ürünü sadece 3. alternatifte ve makul gerekçeyle öner.
- İlk ürün dengeli fiyat performans tercihi olsun.
- İkinci ürün daha uygun fiyatlı alternatif olsun.
- Üçüncü ürün bütçe biraz esnerse düşünülebilecek alternatif olsun.
- Artı ve eksi yönleri kısa, net ve abartısız yaz.
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
      return jsonResponse(
        {
          error:
            geminiData.error?.message ||
            "Gemini API isteği başarısız oldu."
        },
        geminiResponse.status
      );
    }

    const outputText =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!outputText) {
      return jsonResponse(
        { error: "Gemini boş yanıt döndürdü." },
        500
      );
    }

    let parsed;

    try {
      parsed = JSON.parse(outputText);
    } catch (parseError) {
      const jsonMatch = outputText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        return jsonResponse(
          {
            error: "Gemini yanıtı JSON olarak okunamadı.",
            raw: outputText
          },
          500
        );
      }

      parsed = JSON.parse(jsonMatch[0]);
    }

    if (!parsed.products || !Array.isArray(parsed.products)) {
      return jsonResponse(
        { error: "Gemini yanıtında products listesi bulunamadı." },
        500
      );
    }

    return jsonResponse({
      products: parsed.products.slice(0, 3)
    });
  } catch (error) {
    return jsonResponse(
      { error: "Backend tarafında beklenmeyen bir hata oluştu." },
      500
    );
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
