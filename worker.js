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
    const geminiApiKey = env.GEMINI_API_KEY;
    const serperApiKey = env.SERPER_API_KEY;

    if (!geminiApiKey) {
      return jsonResponse(
        {
          error:
            "GEMINI_API_KEY tanımlı değil. Cloudflare Variables and Secrets alanını kontrol et."
        },
        500
      );
    }

    if (!serperApiKey) {
      return jsonResponse(
        {
          error:
            "SERPER_API_KEY tanımlı değil. Cloudflare Variables and Secrets alanını kontrol et."
        },
        500
      );
    }

    const body = await request.json();

    const currency = "TL";
    const category = body.category || "Ürün";
    const purpose = body.purpose || "Genel kullanım";

    if (!budget || budget <= 0) {
      return jsonResponse(
        { error: "Geçerli bir bütçe girilmedi." },
        400
      );
    }

    const candidates = await searchProductCandidates(serperApiKey, {
  budget,
  currency,
  category,
  purpose
});

    if (!candidates.length) {
      return jsonResponse(
        {
          error:
            "Güncel ürün adayı bulunamadı. Lütfen ürün tipini daha genel yazarak tekrar deneyin."
        },
        404
      );
    }

    const prompt = `
Sen Seçimix adlı fiyat-performans ürün öneri sisteminin analiz motorusun.

Kullanıcı bilgileri:
- Bütçe: ${budget} ${currency}
- Ürün kategorisi: ${category}
- Aranan ürün/tip: ${productType || "Belirtilmedi"}
- Kullanım amacı: ${purpose}
- Ek beklenti: ${expectation || "Belirtilmedi"}

Aşağıda güncel arama sonuçlarından çekilmiş ürün adayları var.
Bu adaylar Serper üzerinden alınmıştır.

ÇOK ÖNEMLİ:
- Sadece aşağıdaki ürün adayları arasından seçim yap.
- Aday listesinde olmayan yeni ürün/model üretme.
- candidateId değerini mutlaka döndür.
- Linkleri değiştirme, uydurma link üretme.
- Fiyatı aday listesindeki price alanına göre değerlendir.
- Price alanı eksikse fiyatı kesinmiş gibi yazma.
- Stok bilgisini kesinmiş gibi iddia etme.
- Aynı kullanıcı girdileri ve aynı aday listesi geldiğinde aynı sıralama mantığını kullan.
- Rastgele, yaratıcı veya sürpriz seçim yapma.
- Yanıtı sadece geçerli JSON olarak ver.
- Markdown, açıklama, yorum, kod bloğu veya JSON dışı metin yazma.
- Tam olarak 3 ürün döndür.

Ürün adayları:
${JSON.stringify(candidates, null, 2)}

Sıralama mantığı:
1. ürün:
- En dengeli fiyat-performans tercihi olmalı.
- Kullanıcının bütçesine mümkün olduğunca yakın ama bütçeyi aşmayan mantıklı seçenek olmalı.
- Fiyat, performans, kullanım amacı ve güven dengesi iyi olmalı.

2. ürün:
- Daha uygun fiyatlı alternatif olmalı.
- Kullanıcının bütçesini daha az zorlamalı.
- Performanstan biraz ödün verse bile temel ihtiyacı karşılamalı.

3. ürün:
- Bütçe biraz esnerse düşünülebilecek alternatif olmalı.
- Sadece gerçekten anlamlı bir kalite, performans veya uzun ömür avantajı varsa bütçeyi aşabilir.
- Bütçeyi aşarsa bunu eksi yönünde açıkça belirt.

Puanlama sistemi:
Her ürün için aşağıdaki kriterlere göre düşün:
- %35 fiyat uygunluğu
- %30 performans
- %20 kullanım amacına uyum
- %10 marka, garanti, servis ve genel kullanıcı güveni
- %5 fiyat/stok riski

Puanlama kuralları:
- priceScore fiyatın bütçeye uygunluğunu temsil eder.
- performanceScore ürünün kendi sınıfındaki performansını temsil eder.
- needScore ürünün kullanıcının kullanım amacına ve ek beklentisine uyumunu temsil eder.
- score genel fiyat-performans puanıdır.
- Puanları abartma. Her ürüne 10/10 verme.
- Bütçeyi aşan ürünün priceScore değeri daha düşük olmalı.
- Ek beklenti belirtilmişse needScore değerlendirmesinde bunu dikkate al.

Metin kalitesi kuralları:
- reason alanı 1-2 cümle olsun.
- pros alanı kısa ve net olsun.
- cons alanı gerçekçi bir uyarı içersin.
- suitableFor alanı ürünün kimler için uygun olduğunu açıkça söylesin.
- sourceNote alanında fiyat ve stok bilgisinin satın almadan önce kontrol edilmesi gerektiğini belirt.
- Gereksiz teknik jargon kullanma.
- Kullanıcının anlayacağı sade Türkçe kullan.

JSON formatı tam olarak şöyle olsun:
{
  "products": [
    {
      "candidateId": "1",
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
      "sourceNote": "Fiyat ve stok bilgileri satın almadan önce kontrol edilmelidir.",
      "link": "#"
    }
  ]
}
`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
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
            temperature: 0,
            topP: 0.1,
            topK: 1,
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

    const candidateMap = new Map(
      candidates.map((candidate) => [String(candidate.id), candidate])
    );

    const products = parsed.products.slice(0, 3).map((product, index) => {
      const candidate = candidateMap.get(String(product.candidateId));

      if (!candidate) {
        return {
          ...product,
          link: product.link || "#",
          sourceNote:
            product.sourceNote ||
            "Fiyat ve stok bilgileri satın almadan önce kontrol edilmelidir."
        };
      }

      return {
        ...product,
        rank: product.rank || defaultRank(index),
        name: candidate.title,
        price: candidate.price || product.price || "Yaklaşık fiyat belirtilmedi",
        link: candidate.link || "#",
        sourceNote:
          `Kaynak: ${candidate.source || "Arama sonucu"}. ` +
          "Fiyat ve stok bilgileri satın almadan önce kontrol edilmelidir."
      };
    });

    return jsonResponse({
      products
    });
  } catch (error) {
    return jsonResponse(
      { error: "Backend tarafında beklenmeyen bir hata oluştu." },
      500
    );
  }
}

async function searchProductCandidates(apiKey, searchInput) {
  const query = buildProductSearchQuery(searchInput);

  const shoppingResponse = await fetch("https://google.serper.dev/shopping", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      q: query,
      gl: "tr",
      hl: "tr",
      num: 10
    })
  });

  const shoppingData = await shoppingResponse.json();

  if (!shoppingResponse.ok) {
    throw new Error(
      shoppingData.message ||
        shoppingData.error ||
        "Serper Shopping isteği başarısız oldu."
    );
  }

  const shoppingResults =
    shoppingData.shopping ||
    shoppingData.shoppingResults ||
    [];

  let candidates = normalizeCandidates(shoppingResults);

  if (candidates.length >= 3) {
    return candidates.slice(0, 8);
  }

  const searchResponse = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      q: query,
      gl: "tr",
      hl: "tr",
      num: 10
    })
  });

  const searchData = await searchResponse.json();

  if (!searchResponse.ok) {
    throw new Error(
      searchData.message ||
        searchData.error ||
        "Serper Search isteği başarısız oldu."
    );
  }

  const organicResults = searchData.organic || [];
  const fallbackCandidates = normalizeCandidates(organicResults);

  candidates = [...candidates, ...fallbackCandidates];

  return candidates.slice(0, 8);
}

function buildProductSearchQuery({
  budget,
  currency,
  category,
  purpose
}) {
  return [
    category,
    purpose,
    `${budget} ${currency}`,
    "fiyat",
    "satın al",
    "Türkiye"
  ]
    .filter(Boolean)
    .join(" ");
}

function normalizeCandidates(items) {
  return items
    .map((item, index) => {
      const title = item.title || item.name || "";
      const link =
        item.link ||
        item.product_link ||
        item.sourceLink ||
        item.url ||
        "";
      const price =
        item.price ||
        item.extracted_price ||
        item.priceString ||
        "";
      const source =
        item.source ||
        item.seller ||
        item.merchant ||
        item.domain ||
        "";
      const snippet =
        item.snippet ||
        item.description ||
        item.delivery ||
        "";

      return {
        id: String(index + 1),
        title: cleanText(title),
        price: cleanText(String(price || "")),
        link,
        source: cleanText(source),
        snippet: cleanText(snippet)
      };
    })
    .filter((candidate) => candidate.title && candidate.link);
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function defaultRank(index) {
  if (index === 0) return "1. En dengeli tercih";
  if (index === 1) return "2. En uygun fiyatlı tercih";
  return "3. Bütçe esnerse";
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
