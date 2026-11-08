/* ============================================================

   STOCK PRICE TRACKER — FRONTEND CONNECTED TO FLASK API

   Backend: http://127.0.0.1:5000

   ============================================================ */



const API = "http://127.0.0.1:5000/api";



let stocks = [];

let transactions = [];

let stack = [];

let holdings = {};

let wallet = 100000;

let priceChart = null;

let plChart = null;



const $ = id => document.getElementById(id);

const fmt = n => Number(n || 0).toLocaleString("en-IN", {

  maximumFractionDigits: 2

});



const changePct = s => Number(s.changePct || 0);



async function api(url, options = {}) {

  const response = await fetch(API + url, {

    headers: { "Content-Type": "application/json" },

    ...options

  });



  const data = await response.json();



  if (!response.ok) {

    throw new Error(data.message || "Server error");

  }



  return data;

}



// ---------- LOAD DATA FROM BACKEND ----------

async function loadStocks() {

  stocks = await api("/stocks");

  renderDashboard();

  renderSearch();

  updateTradePrice();

}



async function loadWallet() {

  const data = await api("/wallet");

  wallet = Number(data.wallet);

  $("virtualMoney").textContent = fmt(wallet);

  $("studentName").textContent = "Student: " + data.name;

}



async function loadPortfolio() {

  const data = await api("/portfolio");



  holdings = {};

  data.holdings.forEach(h => {

    holdings[h.symbol] = {

      qty: h.qty,

      avgPrice: h.avgPrice

    };

  });



  renderPortfolioFromBackend(data);

  renderDashboard();

}



async function loadTransactions() {

  transactions = await api("/transactions");

  stack = transactions.slice(-5);

  renderStack();

  renderTransactions();

}



async function loadAll() {

  try {

    await loadStocks();

    await loadWallet();

    await loadPortfolio();

    await loadTransactions();

  } catch (error) {

    console.error(error);

    alert("Backend connection failed. Start Flask on http://127.0.0.1:5000");

  }

}



// ---------- TAB SWITCHING ----------

document.querySelectorAll(".tab").forEach(btn => {

  btn.addEventListener("click", async () => {

    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));

    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));



    btn.classList.add("active");

    $(btn.dataset.tab).classList.add("active");



    if (btn.dataset.tab === "portfolio") await loadPortfolio();

    if (btn.dataset.tab === "transactions") await loadTransactions();

  });

});



// ---------- DASHBOARD ----------

function renderDashboard() {

  const tbody = $("marketTable").querySelector("tbody");

  tbody.innerHTML = "";



  let gainers = 0;

  let losers = 0;



  stocks.forEach(s => {

    const pct = changePct(s);

    if (pct >= 0) gainers++;

    else losers++;



    const cls = pct >= 0 ? "up" : "down";

    const arrow = pct >= 0 ? "▲" : "▼";

    const trend = pct >= 0 ? "UP" : "DOWN";



    tbody.innerHTML += `

      <tr>

        <td><b>${s.symbol}</b></td>

        <td>${s.company}</td>

        <td>₹${fmt(s.price)}</td>

        <td>₹${fmt(s.prev)}</td>

        <td class="${cls}">${arrow} ${pct.toFixed(2)}%</td>

        <td class="${cls}">${trend}</td>

      </tr>`;

  });



  $("totalStocks").textContent = stocks.length;

  $("gainers").textContent = gainers;

  $("losers").textContent = losers;



  let value = 0;

  Object.keys(holdings).forEach(sym => {

    const s = stocks.find(x => x.symbol === sym);

    if (s) value += holdings[sym].qty * s.price;

  });



  $("portfolioValue").textContent = "₹" + fmt(value);

}



// ---------- SEARCH & SORT ----------

function renderSearch() {

  const q = $("searchBox").value.toLowerCase().trim();

  const sortVal = $("sortSelect").value;



  let list = stocks.filter(s =>

    s.symbol.toLowerCase().includes(q) ||

    s.company.toLowerCase().includes(q)

  );



  if (sortVal === "price_asc") {

    list.sort((a, b) => a.price - b.price);

  } else if (sortVal === "price_desc") {

    list.sort((a, b) => b.price - a.price);

  } else if (sortVal === "change_desc") {

    list.sort((a, b) => b.changePct - a.changePct);

  } else if (sortVal === "name_asc") {

    list.sort((a, b) => a.company.localeCompare(b.company));

  }



  const tbody = $("searchTable").querySelector("tbody");

  tbody.innerHTML = "";



  list.forEach(s => {

    const pct = changePct(s);

    const cls = pct >= 0 ? "up" : "down";



    tbody.innerHTML += `

      <tr>

        <td><b>${s.symbol}</b></td>

        <td>${s.company}</td>

        <td>₹${fmt(s.price)}</td>

        <td class="${cls}">${pct.toFixed(2)}%</td>

        <td>

          <button class="view-btn"

                  onclick="showChart('${s.symbol}')">

            View chart

          </button>

        </td>

      </tr>`;

  });

}



$("searchBox").addEventListener("input", renderSearch);

$("sortSelect").addEventListener("change", renderSearch);



// ---------- PRICE CHART ----------


async function showChart(symbol) {
  try {
    const data = await api(`/stocks/${symbol}/history`);

    // Prefer the labels/prices arrays; fall back to rows if needed.
    let labels = Array.isArray(data.labels) ? data.labels : [];
    let prices = Array.isArray(data.prices) ? data.prices : [];

    if (
      labels.length === 0 ||
      prices.length === 0 ||
      labels.length !== prices.length
    ) {
      if (Array.isArray(data.rows)) {
        const validRows = data.rows.filter(
          row =>
            row &&
            row.date &&
            Number.isFinite(Number(row.close))
        );

        labels = validRows.map(row => row.date);
        prices = validRows.map(row => Number(row.close));
      }
    }

    // Stop instead of drawing an empty chart.
    if (
      labels.length === 0 ||
      prices.length === 0 ||
      labels.length !== prices.length
    ) {
      console.error("Unexpected history response:", data);
      alert("The stock history data is missing or mismatched. Check the browser console.");
      return;
    }

    prices = prices.map(Number);

    if (!prices.every(Number.isFinite)) {
      console.error("Invalid stock prices:", prices);
      alert("Some stock prices are invalid. Check the history API response.");
      return;
    }

    $("chartStockName").textContent = `${symbol} Price History`;

    if (priceChart) {
      priceChart.destroy();
    }

    priceChart = new Chart($("priceChart"), {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: `${symbol} Close Price (₹)`,
          data: prices,
          fill: true,
          tension: 0.36,
          pointRadius: 3,
          pointHoverRadius: 6,
          borderColor: "#5f8d7d",
          backgroundColor: "rgba(111, 151, 133, 0.16)",
          pointBackgroundColor: "#5f8d7d",
          pointBorderColor: "#fbf8f1"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 700,
          easing: "easeOutQuart"
        },
        plugins: {
          legend: {
            labels: { color: "#53685d" }
          }
        },
        scales: {
          x: {
            ticks: { color: "#839087" },
            grid: { color: "#e4dfd3" }
          },
          y: {
            beginAtZero: false,
            ticks: { color: "#839087" },
            grid: { color: "#e4dfd3" }
          }
        }
      }
    });
  } catch (error) {
    console.error("Could not load stock chart:", error);
    alert("Could not load the stock chart: " + error.message);
  }
}


// ---------- TRADE ----------

async function doTrade(type) {

  const sym = $("tradeSymbol").value.toUpperCase().trim();

  const qty = parseInt($("tradeQty").value);

  const msg = $("tradeMsg");



  msg.className = "trade-msg";



  if (!sym) {

    msg.classList.add("error");

    msg.textContent = "Enter a stock symbol.";

    return;

  }



  if (!qty || qty < 1) {

    msg.classList.add("error");

    msg.textContent = "Enter a valid quantity.";

    return;

  }



  try {

    const result = await api("/trade", {

      method: "POST",

      body: JSON.stringify({

        type: type,

        symbol: sym,

        qty: qty

      })

    });



    msg.classList.add("success");

    msg.textContent =

      `${type} ${qty} ${sym} @ ₹${fmt(result.price)} — Total ₹${fmt(result.total)}`;



    wallet = result.wallet;

    $("virtualMoney").textContent = fmt(wallet);



    await loadPortfolio();

    await loadTransactions();

  } catch (error) {

    msg.classList.add("error");

    msg.textContent = error.message;

  }

}



// ---------- AUTO PRICE ----------

function updateTradePrice() {

  const sym = $("tradeSymbol").value.toUpperCase().trim();

  const stock = stocks.find(x => x.symbol === sym);

  $("tradePrice").value = stock ? stock.price : "";

}



$("tradeSymbol").addEventListener("input", updateTradePrice);



// ---------- STACK ----------

function renderStack() {

  const ul = $("recentStack");

  ul.innerHTML = "";



  [...stack].reverse().forEach(t => {

    ul.innerHTML += `

      <li>

        <span class="badge ${t.type.toLowerCase()}">${t.type}</span>

        <b>${t.symbol}</b> × ${t.qty}

        @ ₹${fmt(t.price)}

        — ₹${fmt(t.total)}

      </li>`;

  });



  if (!stack.length) {

    ul.innerHTML = "<li>No transactions yet.</li>";

  }

}



// ---------- PORTFOLIO ----------

function renderPortfolioFromBackend(data) {

  const tbody = $("portfolioTable").querySelector("tbody");

  tbody.innerHTML = "";



  const labels = [];

  const plData = [];



  data.holdings.forEach(h => {

    const cls = h.pl >= 0 ? "up" : "down";



    tbody.innerHTML += `

      <tr>

        <td><b>${h.symbol}</b></td>

        <td>${h.qty}</td>

        <td>₹${fmt(h.avgPrice)}</td>

        <td>₹${fmt(h.currentPrice)}</td>

        <td>₹${fmt(h.invested)}</td>

        <td>₹${fmt(h.currentValue)}</td>

        <td class="${cls}">₹${fmt(h.pl)}</td>

      </tr>`;



    labels.push(h.symbol);
plData.push(Number(h.pl) || 0);
  });



  $("invAmount").textContent = "₹" + fmt(data.invested);

  $("currValue").textContent = "₹" + fmt(data.current);

  $("plAmount").textContent =

    (data.pl >= 0 ? "+₹" : "-₹") + fmt(Math.abs(data.pl));



  $("plCard").className = "card " + (data.pl >= 0 ? "green" : "red");



  if (plChart) plChart.destroy();



  plChart = new Chart($("plChart"), {

    type: "bar",

    data: {

      labels: labels,

      datasets: [{

        label: "Profit / Loss (₹)",
        data: plData,
        backgroundColor: plData.map(value => value >= 0 ? "rgba(105, 151, 119, 0.78)" : "rgba(191, 123, 110, 0.78)"),
        borderColor: plData.map(value => value >= 0 ? "#679779" : "#bf7b6e"),
       borderRadius: 7,
borderSkipped: false,
minBarLength: 4
      }]

    },

    options: {
      animation: { duration: 700, easing: "easeOutQuart" },
      plugins: {
        legend: { labels: { color: "#53685d" } }

      },

      scales: {

        x: {

          ticks: { color: "#839087" },

          grid: { color: "#e4dfd3" }

        },

        y: {

          ticks: { color: "#839087" },

          grid: { color: "#e4dfd3" }

        }

      }

    }

  });

}



// ---------- TRANSACTIONS ----------

function renderTransactions() {

  const tbody = $("txnTable").querySelector("tbody");

  tbody.innerHTML = "";



  transactions.forEach((t, i) => {

    tbody.innerHTML += `

      <tr>

        <td>${i + 1}</td>

        <td><span class="badge ${t.type.toLowerCase()}">${t.type}</span></td>

        <td><b>${t.symbol}</b></td>

        <td>${t.qty}</td>

        <td>₹${fmt(t.price)}</td>

        <td>₹${fmt(t.total)}</td>

        <td>${t.date}</td>

      </tr>`;

  });



  if (!transactions.length) {

    tbody.innerHTML =

      "<tr><td colspan='7' style='text-align:center;color:#64748b'>No transactions yet.</td></tr>";

  }

}



// ---------- START ----------

loadAll();
// =========================================
// STOCK TRACKER - TRICKS & TIPS
// =========================================

const learningTips = [

    {
        category: "Calculations",
        title: "Calculate Profit Quickly",
        description: "Find the amount earned when you sell a share for more than its buying price.",
        formula: "Profit = Selling Price - Buying Price",
        example: "Buy at ₹100 and sell at ₹120. Profit = ₹20 per share.",
        memory: "Selling price greater than buying price = Profit."
    },

    {
        category: "Calculations",
        title: "Calculate Your Loss",
        description: "Understand how much money you lose when selling below your buying price.",
        formula: "Loss = Buying Price - Selling Price",
        example: "Buy at ₹200 and sell at ₹180. Loss = ₹20 per share.",
        memory: "Buying price greater than selling price = Loss."
    },

    {
        category: "Calculations",
        title: "Profit Percentage Trick",
        description: "Calculate profit in percentage instead of just looking at the rupee amount.",
        formula: "Profit % = (Profit / Buying Price) × 100",
        example: "Buying price ₹200, profit ₹50. Profit percentage = 25%.",
        memory: "Divide profit by buying price and multiply by 100."
    },

    {
        category: "Calculations",
        title: "Calculate Total Investment",
        description: "Find the total amount required to purchase shares.",
        formula: "Investment = Quantity × Share Price",
        example: "10 shares × ₹150 = ₹1,500.",
        memory: "Multiply quantity by the price of one share."
    },

    {
        category: "Calculations",
        title: "Daily Percentage Change",
        description: "Compare the latest price with the previous closing price.",
        formula: "Change % = ((Current - Previous Close) / Previous Close) × 100",
        example: "Previous close ₹100, current price ₹105. Change = +5%.",
        memory: "Difference ÷ Previous close × 100."
    },

    {
        category: "Calculations",
        title: "Find Average Buying Price",
        description: "Calculate the average cost when shares are purchased at different prices.",
        formula: "Average Price = Total Investment / Total Quantity",
        example: "2 shares at ₹100 and 2 at ₹120. Average = ₹110.",
        memory: "Total money spent divided by total shares."
    },

    {
        category: "Market Basics",
        title: "Remember OHLC",
        description: "Four important prices used to describe a stock during a trading session.",
        formula: "O = Open | H = High | L = Low | C = Close",
        example: "Open ₹100, High ₹110, Low ₹98, Close ₹105.",
        memory: "OHLC means Open, High, Low and Close."
    },

    {
        category: "Market Basics",
        title: "Bull vs Bear Market",
        description: "Learn the two common terms used to describe market direction.",
        formula: "Bull = Generally rising | Bear = Generally falling",
        example: "A market experiencing a sustained upward trend is called bullish.",
        memory: "Bull pushes up; bear swipes down."
    },

    {
        category: "Smart Habits",
        title: "Don't Depend on One Stock",
        description: "Diversification means spreading investments across different companies or sectors.",
        formula: "Diversification = Spreading investment risk",
        example: "A portfolio with shares from different sectors has different exposure from one holding only a single stock.",
        memory: "Don't put all your eggs in one basket."
    },

    {
        category: "Smart Habits",
        title: "Research Before Trading",
        description: "Understand a company and its risks before making an investment decision.",
        formula: "Research → Understand Risk → Decide",
        example: "Study company information and historical prices before practising a virtual trade.",
        memory: "A rising price does not guarantee future profit."
    }

];


// Render the learning cards

function renderLearningTips() {

    const grid = document.getElementById("tipsGrid");

    const searchInput = document.getElementById("tipSearch");

    const categoryInput = document.getElementById("tipCategory");

    if (!grid || !searchInput || !categoryInput) return;

    const search = searchInput.value.toLowerCase().trim();

    const category = categoryInput.value;

    const filtered = learningTips.filter(tip => {

        const text = (
            tip.title + " " +
            tip.description + " " +
            tip.formula + " " +
            tip.example + " " +
            tip.memory + " " +
            tip.category
        ).toLowerCase();

        return (
            text.includes(search) &&
            (category === "All" || tip.category === category)
        );

    });

    if (filtered.length === 0) {

        grid.innerHTML = `
            <div class="no-tips">
                <h3>No matching tips found</h3>
                <p>Try searching for another topic.</p>
            </div>
        `;

        return;
    }

    grid.innerHTML = filtered.map((tip, index) => `

        <article class="tip-card">

            <div class="tip-top">

                <span class="tip-category">
                    ${tip.category}
                </span>

                <span class="tip-number">
                    TIP ${String(index + 1).padStart(2, "0")}
                </span>

            </div>

            <h3>${tip.title}</h3>

            <p class="tip-description">
                ${tip.description}
            </p>

            <div class="tip-formula">

                <span class="tip-formula-label">
                    Formula / Key idea
                </span>

                <strong>${tip.formula}</strong>

            </div>

            <p class="tip-example">
                <strong>Example:</strong>
                ${tip.example}
            </p>

            <div class="tip-memory">

                <span class="tip-memory-icon">💡</span>

                <div>
                    <strong>Easy trick to remember</strong>
                    <br>
                    ${tip.memory}
                </div>

            </div>

        </article>

    `).join("");

}


// Initialize search and filters

function initializeLearningTips() {

    const searchInput = document.getElementById("tipSearch");

    const categoryInput = document.getElementById("tipCategory");

    if (!searchInput || !categoryInput) return;

    searchInput.addEventListener("input", renderLearningTips);

    categoryInput.addEventListener("change", renderLearningTips);

    renderLearningTips();

}

initializeLearningTips();