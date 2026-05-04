const form = document.getElementById("productForm");
const submitButton = form.querySelector("button[type='submit']");
const results = document.getElementById("results");
const statusMessage = document.getElementById("statusMessage");
const searchSummary = document.getElementById("searchSummary");
const searchSummaryText = document.getElementById("searchSummaryText");

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
      <a class="btn btn-secondary" href="${product.link}" target="_blank" rel="noopener noreferrer">Ürüne Git</a>
    `;

    results.appendChild(card);
  });
}

form.addEventListener("submit", async function(event) {
  event.preventDefault();

  const budget = document.getElementById("budget").value;
  const category = document.getElementById("category").value;
  const purpose = document.getElementById("purpose").value;

  if (!budget || Number(budget) <= 0) {
    statusMessage.textContent = "Lütfen geçerli bir bütçe gir.";
    statusMessage.classList.remove("hidden");
    statusMessage.classList.add("error");
    searchSummary.classList.add("hidden");
    results.classList.add("hidden");
    return;
  }

  searchSummaryText.textContent =
    `${budget} TL bütçeyle, ${purpose.toLowerCase()} amacı için ` +
    `${category.toLowerCase()} önerileri hazırlanıyor.`;

  searchSummary.classList.remove("hidden");

  statusMessage.textContent = "Sizin için en mantıklı öneriler hazırlanıyor...";
  submitButton.disabled = true;
  submitButton.textContent = "Hazırlanıyor...";
  statusMessage.classList.remove("hidden");
  statusMessage.classList.remove("error");
  results.classList.add("hidden");
  results.innerHTML = "";

  try {
    const response = await fetch("/recommend", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        budget,
        category,
        purpose
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

  submitButton.disabled = false;
  submitButton.textContent = "Önerileri Göster";
});
