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
Sen Seçimix adlı fiyat-performans ürün öneri sisteminin analiz motorusun.

Kullanıcı bilgileri:
- Bütçe: ${budget} ${currency}
- Ürün kategorisi: ${category}
- Aranan ürün/tip: ${productType || "Belirtilmedi"}
- Kullanım amacı: ${purpose}
- Ek beklenti: ${expectation || "Belirtilmedi"}

Görevin:
Kullanıcının bütçesine, ürün kategorisine, kullanım amacına ve ek beklentisine göre Türkiye pazarı için fiyat-performans açısından en mantıklı 3 ürünü önermek.

Çok önemli çalışma kuralları:
- Aynı kullanıcı girdileri geldiğinde mümkün olduğunca aynı ürün sıralamasını ve aynı değerlendirme mantığını kullan.
- Rastgele, yaratıcı veya sürpriz ürün seçme.
- Çok niş, bulunması zor veya az bilinen ürünleri önceliklendirme.
- Türkiye’de genel olarak bilinen, erişilebilirliği daha yüksek ve kullanıcıların karşılaşma ihtimali daha fazla olan ürünleri düşün.
- Güncel fiyat, stok veya kampanya bilgisine erişimin olmadığını varsay.
- Kesin fiyat, kesin stok, kesin indirim veya kesin mağaza iddiası yazma.
- Fiyatları her zaman yaklaşık olarak yaz.
- Gerçek satın alma linkinden emin değilsen link alanına sadece "#" yaz.
- Uydurma mağaza linki, uydurma URL veya gerçekmiş gibi görünen sahte bağlantı üretme.
- Kullanıcıyı yanıltacak kesin ifadeler kullanma.
- Yanıtı sadece geçerli JSON olarak ver.
- Markdown, açıklama, yorum, kod bloğu veya JSON dışı metin yazma.
- Tam olarak 3 ürün döndür.

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

Ürün seçme kuralları:
- Eğer kullanıcı belirli bir ürün tipi yazdıysa, önerileri o ürün tipine göre seç.
- Örneğin "oyuncu laptopu" yazıldıysa ofis laptopu önerme.
- Örneğin "kamerası iyi telefon" yazıldıysa kamera performansını gerekçede açıkça değerlendir.
- Örneğin "ısınmasın" yazıldıysa ısı yönetimi, kasa yapısı veya performans/soğutma dengesine değin.
- Eğer ürün kategorisiyle ürün tipi çelişirse kategoriye öncelik ver ama reason alanında bunu yumuşak şekilde açıkla.
- Ürünleri sadece ucuz oldukları için seçme.
- En pahalı ürünü otomatik olarak en iyi gösterme.
- Gereksiz teknik jargon kullanma.
- Kullanıcının anlayacağı sade Türkçe kullan.

Metin kalitesi kuralları:
- reason alanı 1-2 cümle olsun.
- pros alanı kısa ve net olsun.
- cons alanı gerçekçi bir uyarı içersin.
- suitableFor alanı ürünün kimler için uygun olduğunu açıkça söylesin.
- sourceNote alanında fiyat ve stok bilgisinin satın almadan önce kontrol edilmesi gerektiğini belirt.
- Ürün isimlerini mümkün olduğunca gerçekçi ve bilinen model isimlerinden seç.
- Emin olmadığın ürün/model hakkında kesin iddia yazma.

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
      "sourceNote": "Fiyat ve stok bilgileri satın almadan önce kontrol edilmelidir.",
      "link": "#"
    },
    {
      "rank": "2. En uygun fiyatlı tercih",
      "name": "Ürün adı",
      "price": "Yaklaşık fiyat",
      "score": "F/P Puanı: 8.5/10",
      "priceScore": "10/10",
      "performanceScore": "7/10",
      "needScore": "8/10",
      "suitableFor": "Kimler için uygun?",
      "reason": "Neden önerildiği",
      "pros": "Artı yönü",
      "cons": "Eksi yönü",
      "sourceNote": "Fiyat ve stok bilgileri satın almadan önce kontrol edilmelidir.",
      "link": "#"
    },
    {
      "rank": "3. Bütçe esnerse",
      "name": "Ürün adı",
      "price": "Yaklaşık fiyat",
      "score": "F/P Puanı: 8.7/10",
      "priceScore": "7/10",
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
  temperature: 0,
  topP: 0.1,
  topK: 1,
  responseMimeType: "application/json"
}

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
