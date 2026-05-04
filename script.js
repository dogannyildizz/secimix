const form = document.getElementById("productForm");
const results = document.getElementById("results");
const statusMessage = document.getElementById("statusMessage");
const searchSummary = document.getElementById("searchSummary");
const searchSummaryText = document.getElementById("searchSummaryText");

const categorySelect = document.getElementById("category");
const expectationInput = document.getElementById("expectation");

const expectationExamples = {
  Laptop: "Örn: oyun için güçlü olsun, hafif olsun, şarjı uzun gitsin",
  Telefon: "Örn: kamerası iyi olsun, şarjı uzun gitsin",
  Kulaklık: "Örn: mikrofonu iyi olsun, gürültü engelleme olsun",
  Monitör: "Örn: 144Hz olsun, renkleri iyi olsun",
  Tablet: "Örn: kalem desteği olsun, ders için uygun olsun",
  Televizyon: "Örn: görüntü kalitesi iyi olsun, büyük ekran olsun",
  "Akıllı Saat": "Örn: pil ömrü uzun olsun, spor takibi iyi olsun",
  "Oyun Konsolu": "Örn: oyun çeşitliliği iyi olsun, uzun ömürlü olsun",
  Klavye: "Örn: sessiz olsun, mekanik olsun",
  Mouse: "Örn: kablosuz olsun, oyun için uygun olsun"
};

function updateExpectationPlaceholder() {
  const selectedCategory = categorySelect.value;

  expectationInput.placeholder =
    expectationExamples[selectedCategory] ||
    "Örn: fiyat performans açısından mantıklı olsun";
}

categorySelect.addEventListener("change", updateExpectationPlaceholder);
updateExpectationPlaceholder();

function renderProducts(products) {
  results.innerHTML = "";

  products.forEach(function(product) {
    const card = document.createElement("div");
    card.className = "product-card";

    card.innerHTML = `
      <span class="product-rank">${product.rank}</span>
      <h3>${product.name}</h3>
      <div class="price">${product.price}</div>
      <div class="score">${product.score}</div>
      <div class="score-breakdown">
        <div class="score-row"><span>Fiyat uygunluğu</span><strong>${product.priceScore}</strong></div>
        <div class="score-row"><span>Performans</span><strong>${product.performanceScore}</strong></div>
        <div class="score-row"><span>İhtiyaca uyum</span><strong>${product.needScore}</strong></div>
      </div>
      <p><strong>Kimler için uygun?</strong><br>${product.suitableFor}</p>
      <p class="reason">${product.reason}</p>
      <div class="detail-list">
        <div><strong>Artı:</strong> ${product.pros}</div>
        <div><strong>Eksi:</strong> ${product.cons}</div>
      </div>
      <p class="source-note">${product.sourceNote}</p>
      <a class="btn btn-secondary" href="${product.link}">Ürüne Git</a>
    `;

    results.appendChild(card);
  });
}

form.addEventListener("submit", async function(event) {
  event.preventDefault();

  const budget = document.getElementById("budget").value;
  const currency = document.getElementById("currency").value;
  const category = document.getElementById("category").value;
  const productType = document.getElementById("productType").value.trim();
  const purpose = document.getElementById("purpose").value;
  const expectation = document.getElementById("expectation").value.trim();

  if (!budget || Number(budget) <= 0) {
    statusMessage.textContent = "Lütfen geçerli bir bütçe gir.";
    statusMessage.classList.remove("hidden");
    statusMessage.classList.add("error");
    searchSummary.classList.add("hidden");
    results.classList.add("hidden");
    return;
  }

  const selectedProductName = productType || category;

  searchSummaryText.textContent =
    `${budget} ${currency} bütçeyle, ${purpose.toLowerCase()} amacı için ` +
    `${selectedProductName.toLowerCase()} önerileri hazırlanıyor` +
    `${expectation ? ". Ek beklenti: " + expectation : ""}.`;

  searchSummary.classList.remove("hidden");

  statusMessage.textContent = "Backend üzerinden OpenAI ile öneriler hazırlanıyor...";
  statusMessage.classList.remove("hidden");
  statusMessage.classList.remove("error");
  results.classList.add("hidden");
  results.innerHTML = "";

  try {
    const response = await fetch("/.netlify/functions/recommend", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        budget,
        currency,
        category,
        productType,
        purpose,
        expectation
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Öneriler alınamadı.");
    }

    renderProducts(data.products);

    statusMessage.classList.add("hidden");
    results.classList.remove("hidden");
  } catch (error) {
  statusMessage.textContent =
    "Şu anda öneriler hazırlanamadı. Lütfen birkaç dakika sonra tekrar deneyin.";
  statusMessage.classList.remove("hidden");
  statusMessage.classList.add("error");
  results.classList.add("hidden");

  console.error("Backend hatası:", error);
}
});
