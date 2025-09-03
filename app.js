/*
  FILE: app.js
  Updated to include Standard Amortization Chart visualization:
  
  NEW FEATURE: Interactive Chart showing Interest vs Principal over time
  - Uses Chart.js library for visualization
  - Shows breakdown of EMI components month by month
  - Displays above the interactive table
  - Minimal DOM manipulation approach
  - Chart updates automatically with table changes
  - Shows month/year labels (e.g., Mar26)
*/

/////////////////////// Utility functions ///////////////////////

function toCurrency(x) {
  if (x === null || x === undefined || isNaN(Number(x))) return "-";
  return Number(x).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/**
 * Calculate EMI for given principal, monthlyRate (decimal), and months.
 * If monthlyRate === 0, EMI = principal / months.
 */
function calculateEMI(principal, monthlyRate, months) {
  if (months <= 0) return 0;
  if (!principal || principal <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  const r = monthlyRate;
  const pow = Math.pow(1 + r, months);
  return (principal * r * pow) / (pow - 1);
}

/**
 * Given remaining principal (P), fixed EMI, and monthlyRate (decimal),
 * compute the number of months required to amortize P at that EMI.
 */
function calculateRemainingMonths(principal, emi, monthlyRate) {
  if (principal <= 0) return 0;
  if (emi <= 0) return Infinity;
  if (monthlyRate === 0) {
    return Math.ceil(principal / emi);
  }
  const monthlyInterest = principal * monthlyRate;
  if (emi <= monthlyInterest + 1e-12) {
    return Infinity;
  }
  const numerator = Math.log(emi / (emi - principal * monthlyRate));
  const denominator = Math.log(1 + monthlyRate);
  return numerator / denominator;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatDate(date) {
  const opts = { year: "numeric", month: "short", day: "numeric" };
  return new Date(date).toLocaleDateString("en-GB", opts);
}

/**
 * Format date as MonthYear for chart labels (e.g., Mar26)
 */
function formatMonthYear(date) {
  const d = new Date(date);
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear().toString().slice(-2);
  return `${month}${year}`;
}

/**
 * Simple number to words conversion (basic implementation)
 */
function convertNumberToWords(num) {
  if (num === 0) return "Zero Rupees";

  const crores = Math.floor(num / 10000000);
  const lakhs = Math.floor((num % 10000000) / 100000);
  const thousands = Math.floor((num % 100000) / 1000);
  const hundreds = Math.floor((num % 1000) / 100);

  let words = "";
  if (crores > 0) words += crores + " Crore ";
  if (lakhs > 0) words += lakhs + " Lakh ";
  if (thousands > 0) words += thousands + " Thousand ";
  if (hundreds > 0) words += hundreds + " Hundred ";

  return words.trim() + " Rupees";
}

/**
 * Panel toggle functionality
 */
function togglePanel(panelId) {
  const panel = document.getElementById(panelId);
  const chevron = panel.parentElement.querySelector(".chevron");

  panel.classList.toggle("collapsed");
  chevron.style.transform = panel.classList.contains("collapsed")
    ? "rotate(-90deg)"
    : "rotate(0deg)";
}

/**
 * Compact view toggle
 */
function toggleCompactView() {
  const table = document.getElementById("amortTable");
  table.classList.toggle("compact");

  const button = document.querySelector(".compact-view");

  if (table.classList.contains("compact")) {
    // Expanded mode
    button.innerHTML = `
      <svg
        width="16"
        height="16"
        fill="currentColor"
        viewBox="0 0 24 24"
        style="margin-right: 4px"
      >
        <path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"/>
      </svg>
      Expanded
    `;
  } else {
    // Compact mode
    button.innerHTML = `
      <svg
        width="16"
        height="16"
        fill="currentColor"
        viewBox="0 0 24 24"
        style="margin-right: 4px"
      >
        <path d="M3 4h18v2H3V4zm0 6h18v2H3v-2zm0 6h18v2H3v-2z"/>
      </svg>
      Compact
    `;
  }
}

/////////////////////// DOM refs ///////////////////////

const loanAmountEl = document.getElementById("loanAmount");
const roiStartEl = document.getElementById("roiStart");
const tenureEl = document.getElementById("tenureMonths");
const generateBtn = document.getElementById("generateBtn");
const resetBtn = document.getElementById("resetBtn");
const amortTableBody = document.querySelector("#amortTable tbody");
const interestSavedEl = document.getElementById("interestSaved");
const completionDateEl = document.getElementById("completionDate");
const origTotalInterestEl = document.getElementById("origTotalInterest");
const newTotalInterestEl = document.getElementById("newTotalInterest");
const totalDisbursementsEl = document.getElementById("totalDisbursements");
const applyChangesBtn = document.getElementById("applyChanges");
const downloadCsvBtn = document.getElementById("downloadCsv");
const monthlyEMIEl = document.getElementById("monthlyEMI");
const currentRoiEl = document.getElementById("currentRoi");
const currentOutstandingEl = document.getElementById("currentOutstanding");
const monthsRemainingEl = document.getElementById("monthsRemaining");
const interestSavedPerEl = document.getElementById("interestSavedPer");

// Save/Load DOM elements
const saveScenarioBtnEl = document.getElementById("saveScenarioBtn");
const loadFileInputEl = document.getElementById("loadFileInput");
const loadScenarioBtnEl = document.getElementById("loadScenarioBtn");
const currentScenarioIdEl = document.getElementById("currentScenarioId");
const loadedScenarioIdEl = document.getElementById("loadedScenarioId");

/////////////////////// State ///////////////////////

let originalSchedule = [];
let currentSchedule = [];
let currentScenarioId = null;
let loadedScenarioData = null;
let amortizationChart = null;

/////////////////////// NEW: Chart Functions ///////////////////////

/**
 * Load Chart.js library if not already loaded
 */
function loadChartJS() {
  return new Promise((resolve, reject) => {
    if (window.Chart) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Create chart container
 */
function createChartContainer() {
  // Remove existing chart container if it exists
  const existingChart = document.getElementById("amortizationChartContainer");
  if (existingChart) {
    existingChart.remove();
  }

  // Find insertion point (before the interactive amortization table)
  const interactiveTableCard = document
    .querySelector("#amortTable")
    .closest(".card");

  // Create container card
  const chartCard = document.createElement("div");
  chartCard.className = "card mt-4 shadow-sm";
  chartCard.id = "amortizationChartContainer";

  // Create card body
  const cardBody = document.createElement("div");
  cardBody.className = "card-body";

  // Create title with toggle button
  const titleRow = document.createElement("div");
  titleRow.className = "d-flex justify-content-between align-items-center mb-3";

  const title = document.createElement("h5");
  title.className = "card-title mb-0";
  title.textContent = "Standard Amortization Chart (Interest vs Principal)";

  const toggleButton = document.createElement("button");
  toggleButton.className = "btn btn-outline-secondary btn-sm";
  toggleButton.innerHTML = `
  <svg
    width="16"
    height="16"
    fill="currentColor"
    viewBox="0 0 24 24"
    style="margin-right: 4px"
  >
    <path d="M5 9v10h2V9H5zm6 4v6h2v-6h-2zm6-8v14h2V5h-2z"/>
  </svg>
  Hide Chart
`;

  toggleButton.onclick = toggleChart;

  titleRow.appendChild(title);
  titleRow.appendChild(toggleButton);
  cardBody.appendChild(titleRow);

  // Create chart canvas container
  const canvasContainer = document.createElement("div");
  canvasContainer.id = "chartCanvasContainer";
  canvasContainer.style.position = "relative";
  canvasContainer.style.height = "400px";
  canvasContainer.style.width = "100%";

  const canvas = document.createElement("canvas");
  canvas.id = "amortizationChart";
  canvas.style.maxHeight = "400px";

  canvasContainer.appendChild(canvas);
  cardBody.appendChild(canvasContainer);

  // Add note
  const note = document.createElement("small");
  note.className = "text-muted d-block mt-2";
  note.innerHTML = `
    <strong>Chart Legend:</strong> 
    <span style="color: #ff6b6b;">● Interest Component</span> | 
    <span style="color: #4ecdc4;">● Principal Component</span> | 
    <span style="color: #45b7d1;">● Outstanding Balance</span>
    <br>This shows how your EMI is split between interest and principal payments over time.
  `;
  cardBody.appendChild(note);

  chartCard.appendChild(cardBody);

  // Insert before interactive table
  interactiveTableCard.parentNode.insertBefore(chartCard, interactiveTableCard);
}

/**
 * Create and render the amortization chart
 */
async function createAmortizationChart() {
  // Use currentSchedule if available, otherwise use originalSchedule
  const scheduleToChart =
    currentSchedule.length > 0 ? currentSchedule : originalSchedule;

  if (!scheduleToChart || scheduleToChart.length === 0) return;

  try {
    await loadChartJS();

    // Check if container exists, if not create it
    if (!document.getElementById("amortizationChartContainer")) {
      createChartContainer();
    }

    const canvas = document.getElementById("amortizationChart");
    if (!canvas) {
      console.error("Chart canvas not found");
      return;
    }

    const ctx = canvas.getContext("2d");

    // Destroy existing chart if it exists
    if (amortizationChart) {
      amortizationChart.destroy();
    }

    // Prepare data with formatted month/year labels
    const startDate = new Date();
    const labels = scheduleToChart.map((row, index) => {
      const monthDate = addMonths(startDate, index + 1);
      return formatMonthYear(monthDate);
    });

    const interestData = scheduleToChart.map((row) => row.interest);
    const principalData = scheduleToChart.map((row) => row.principal);
    const balanceData = scheduleToChart.map((row) => row.balance);

    // Create chart
    amortizationChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Interest Component",
            data: interestData,
            backgroundColor: "#ff6b6b",
            borderColor: "#e55555",
            borderWidth: 1,
            stack: "EMI",
          },
          {
            label: "Principal Component",
            data: principalData,
            backgroundColor: "#4ecdc4",
            borderColor: "#3bb5b0",
            borderWidth: 1,
            stack: "EMI",
          },
          {
            label: "Outstanding Balance",
            data: balanceData,
            type: "line",
            backgroundColor: "rgba(69, 183, 209, 0.1)",
            borderColor: "#45b7d1",
            borderWidth: 2,
            fill: false,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          title: {
            display: true,
            text: "EMI Breakdown Over Time",
          },
          legend: {
            position: "top",
          },
          tooltip: {
            callbacks: {
              footer: function (context) {
                const index = context[0].dataIndex;
                const emi = scheduleToChart[index].emi;
                return `Total EMI: ₹${toCurrency(emi)}`;
              },
              label: function (context) {
                const value = context.parsed.y || context.parsed;
                return `${context.dataset.label}: ₹${toCurrency(value)}`;
              },
            },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "Loan Tenure (Months)",
            },
            grid: {
              display: false,
            },
            ticks: {
              callback: function (value, index) {
                // Show every nth label for long tenures
                if (scheduleToChart.length > 24) {
                  const interval = Math.ceil(scheduleToChart.length / 12);
                  return index % interval === 0
                    ? this.getLabelForValue(value)
                    : "";
                }
                return this.getLabelForValue(value);
              },
              maxRotation: 45,
              minRotation: 45,
            },
          },
          y: {
            type: "linear",
            display: true,
            position: "left",
            title: {
              display: true,
              text: "EMI Amount (₹)",
            },
            ticks: {
              callback: function (value) {
                return "₹" + toCurrency(value);
              },
            },
          },
          y1: {
            type: "linear",
            display: true,
            position: "right",
            title: {
              display: true,
              text: "Outstanding Balance (₹)",
            },
            grid: {
              drawOnChartArea: false,
            },
            ticks: {
              callback: function (value) {
                return "₹" + toCurrency(value);
              },
            },
          },
        },
      },
    });
  } catch (error) {
    console.error("Error creating chart:", error);
    // Show fallback message
    const container = document.getElementById("chartCanvasContainer");
    if (container) {
      container.innerHTML = `
        <div class="alert alert-warning">
          <strong>Chart unavailable:</strong> Unable to load chart library. 
          The data table below shows the same information.
        </div>
      `;
    }
  }
}

/**
 * Toggle chart visibility
 */
function toggleChart() {
  const container = document.getElementById("chartCanvasContainer");
  const button = document.querySelector(
    "#amortizationChartContainer .btn-outline-secondary"
  );

  if (!container || !button) return;

  if (container.style.display === "none") {
    // Show chart
    container.style.display = "block";
    button.innerHTML = `
      <svg
        width="16"
        height="16"
        fill="currentColor"
        viewBox="0 0 24 24"
        style="margin-right: 4px"
      >
        <path d="M5 9v10h2V9H5zm6 4v6h2v-6h-2zm6-8v14h2V5h-2z"/>
      </svg>
      Hide Chart
    `;
  } else {
    // Hide chart
    container.style.display = "none";
    button.innerHTML = `
      <svg
        width="16"
        height="16"
        fill="currentColor"
        viewBox="0 0 24 24"
        style="margin-right: 4px"
      >
        <path d="M12 4l-8 8h5v8h6v-8h5l-8-8z"/>
      </svg>
      Show Chart
    `;
  }
}

/////////////////////// Save/Load Functions ///////////////////////

function generateScenarioId() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.getTime().toString().slice(-6);
  return `LOAN_${dateStr}_${timeStr}`;
}

function collectScenarioData() {
  const mainData = {
    loanAmount: Number(loanAmountEl.value) || 0,
    roiStart: Number(roiStartEl.value) || 0,
    tenureMonths: parseInt(tenureEl.value) || 0,
  };

  // Collect disbursements
  const disbursements = {};
  document.querySelectorAll(".disbursement-input").forEach((el) => {
    const idx = el.getAttribute("data-idx");
    const value = Number(el.value) || 0;
    if (value > 0) {
      disbursements[idx] = value;
    }
  });

  // Collect prepayments
  const prepayments = {};
  document.querySelectorAll(".prepay-input").forEach((el) => {
    const idx = el.getAttribute("data-idx");
    const value = Number(el.value) || 0;
    if (value > 0) {
      prepayments[idx] = value;
    }
  });

  // Collect ROI changes
  const roiChanges = {};
  document.querySelectorAll(".roi-input").forEach((el) => {
    const idx = el.getAttribute("data-idx");
    const value = el.value.trim();
    if (value !== "") {
      const numValue = Number(value);
      if (!isNaN(numValue)) {
        roiChanges[idx] = numValue;
      }
    }
  });

  return {
    ...mainData,
    disbursements,
    prepayments,
    roiChanges,
  };
}

function saveScenario() {
  try {
    if (!currentScenarioId) {
      currentScenarioId = generateScenarioId();
      currentScenarioIdEl.value = currentScenarioId;
    }

    const scenarioData = {
      id: currentScenarioId,
      timestamp: new Date().toISOString(),
      version: "2.1", // Updated version for chart support
      ...collectScenarioData(),
    };

    const jsonStr = JSON.stringify(scenarioData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentScenarioId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showMessage(
      "save-success",
      `Scenario saved successfully! ID: ${currentScenarioId}`,
      saveScenarioBtnEl.parentElement
    );
  } catch (error) {
    console.error("Error saving scenario:", error);
    showMessage(
      "error-message",
      "Failed to save scenario. Please try again.",
      saveScenarioBtnEl.parentElement
    );
  }
}

function handleFileSelection() {
  const file = loadFileInputEl.files[0];
  if (!file) {
    loadScenarioBtnEl.disabled = true;
    loadedScenarioIdEl.value = "None loaded";
    loadedScenarioData = null;
    return;
  }

  if (!file.name.endsWith(".json")) {
    showMessage(
      "error-message",
      "Please select a valid JSON file.",
      loadFileInputEl.parentElement
    );
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const jsonData = JSON.parse(e.target.result);

      if (
        !jsonData.id ||
        !jsonData.loanAmount ||
        !jsonData.roiStart ||
        !jsonData.tenureMonths
      ) {
        throw new Error("Invalid loan scenario file format");
      }

      loadedScenarioData = jsonData;
      loadedScenarioIdEl.value = jsonData.id;
      loadScenarioBtnEl.disabled = false;

      showMessage(
        "load-success",
        `File loaded successfully! Scenario ID: ${jsonData.id}`,
        loadFileInputEl.parentElement
      );
    } catch (error) {
      console.error("Error parsing file:", error);
      showMessage(
        "error-message",
        "Invalid file format. Please select a valid loan scenario file.",
        loadFileInputEl.parentElement
      );
      loadScenarioBtnEl.disabled = true;
      loadedScenarioIdEl.value = "Invalid file";
      loadedScenarioData = null;
    }
  };

  reader.readAsText(file);
}

function loadScenario() {
  if (!loadedScenarioData) {
    showMessage(
      "error-message",
      "No valid scenario data to load.",
      loadScenarioBtnEl.parentElement
    );
    return;
  }

  try {
    loanAmountEl.value = loadedScenarioData.loanAmount;
    roiStartEl.value = loadedScenarioData.roiStart;
    tenureEl.value = loadedScenarioData.tenureMonths;

    updateLoanAmountWords();

    currentScenarioId = loadedScenarioData.id;
    currentScenarioIdEl.value = currentScenarioId;

    generateBaseline();

    setTimeout(() => {
      // Set disbursements
      if (loadedScenarioData.disbursements) {
        Object.entries(loadedScenarioData.disbursements).forEach(
          ([idx, value]) => {
            const input = document.querySelector(
              `.disbursement-input[data-idx="${idx}"]`
            );
            if (input) {
              input.value = value;
            }
          }
        );
      }

      // Set prepayments
      if (loadedScenarioData.prepayments) {
        Object.entries(loadedScenarioData.prepayments).forEach(
          ([idx, value]) => {
            const input = document.querySelector(
              `.prepay-input[data-idx="${idx}"]`
            );
            if (input) {
              input.value = value;
            }
          }
        );
      }

      // Set ROI changes
      if (loadedScenarioData.roiChanges) {
        Object.entries(loadedScenarioData.roiChanges).forEach(
          ([idx, value]) => {
            const input = document.querySelector(
              `.roi-input[data-idx="${idx}"]`
            );
            if (input) {
              input.value = value;
            }
          }
        );
      }

      applyUserChanges();

      showMessage(
        "load-success",
        `Scenario "${loadedScenarioData.id}" loaded successfully!`,
        loadScenarioBtnEl.parentElement
      );
    }, 100);
  } catch (error) {
    console.error("Error loading scenario:", error);
    showMessage(
      "error-message",
      "Failed to load scenario. Please try again.",
      loadScenarioBtnEl.parentElement
    );
  }
}

function showMessage(className, message, parentElement) {
  parentElement
    .querySelectorAll(".save-success, .load-success, .error-message")
    .forEach((el) => el.remove());

  const messageEl = document.createElement("div");
  messageEl.className = className;
  messageEl.textContent = message;
  parentElement.appendChild(messageEl);

  setTimeout(() => {
    messageEl.remove();
  }, 5000);
}

/////////////////////// Baseline generator ///////////////////////

function generateBaseline() {
  const P = Number(loanAmountEl.value) || 0;
  const annualRate = Number(roiStartEl.value) || 0;
  const n = parseInt(tenureEl.value) || 0;
  const monthlyRate = annualRate / 12 / 100;
  const baselineEMI = calculateEMI(P, monthlyRate, n);

  const rows = [];
  let balance = P;
  let totalInterest = 0;
  const startDate = new Date();

  for (let i = 1; i <= n; i++) {
    const interest = balance * monthlyRate;
    let principal = baselineEMI - interest;
    if (principal < 0) principal = 0;
    if (principal > balance) principal = balance;
    balance -= principal;
    totalInterest += interest;

    rows.push({
      monthIndex: i,
      monthLabel: formatDate(addMonths(startDate, i)),
      emi: baselineEMI,
      interest: interest,
      principal: principal,
      disbursement: 0,
      prepayment: 0,
      roiChange: null,
      balance: Math.max(balance, 0),
    });

    if (balance <= 0.0001) break;
  }

  originalSchedule = rows;
  origTotalInterestEl.value = toCurrency(totalInterest);

  currentSchedule = JSON.parse(JSON.stringify(originalSchedule));
  renderSchedule(currentSchedule);

  // NEW: Create amortization chart
  createAmortizationChart();

  const completionMonthIndex = currentSchedule.length;
  completionDateEl.value = formatDate(
    addMonths(new Date(), completionMonthIndex)
  );
  newTotalInterestEl.value = origTotalInterestEl.value;
  interestSavedEl.value = toCurrency(0);
  totalDisbursementsEl.value = toCurrency(0);

  // Initialize interest saved percentage
  interestSavedPerEl.textContent = "+0% vs original";
  interestSavedPerEl.style.color = "#6b7280";

  if (!loadedScenarioData) {
    currentScenarioId = null;
    currentScenarioIdEl.value = "Not saved yet";
  }

  updateStatsBar();
  updateCompletionProgress();
}

/////////////////////// Render ///////////////////////

function renderSchedule(schedule) {
  amortTableBody.innerHTML = "";
  schedule.forEach((row, idx) => {
    const tr = document.createElement("tr");
    const hasModifiedEMI = row.emi !== originalSchedule[0]?.emi;
    const hasDisbursement = row.disbursement > 0;

    if (hasDisbursement) {
      tr.classList.add("has-disbursement");
    }

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${row.monthLabel}</td>
      <td class="${hasModifiedEMI ? "emi-modified" : ""}">${toCurrency(
      row.emi
    )}</td>
      <td>${toCurrency(row.interest)}</td>
      <td>${toCurrency(row.principal)}</td>
      <td><input type="number" class="form-control table-input input-yellow disbursement-input" 
          data-idx="${idx}" value="${row.disbursement || 0}" min="0" 
          title="Enter additional loan disbursement for this month. EMI will adjust; tenure will remain unchanged if possible."></td>
      <td><input type="number" class="form-control table-input input-yellow prepay-input" 
          data-idx="${idx}" value="${row.prepayment || 0}" min="0"></td>
      <td><input type="number" step="0.01" class="form-control table-input input-yellow roi-input" 
          data-idx="${idx}" value="${
      row.roiChange !== null ? row.roiChange : ""
    }" placeholder="0"></td>
      <td>${toCurrency(row.balance)}</td>
    `;
    amortTableBody.appendChild(tr);
  });
}

/////////////////////// Core apply logic with Disbursement ///////////////////////

function applyUserChanges() {
  const P = Number(loanAmountEl.value) || 0;
  const originalTenure = parseInt(tenureEl.value) || 0;
  const startDate = new Date();

  // Read user inputs
  const disbursementsMap = new Map();
  const prepaymentsMap = new Map();
  const roiMap = new Map();

  document.querySelectorAll(".disbursement-input").forEach((el) => {
    const idx = Number(el.getAttribute("data-idx"));
    const v = Number(el.value) || 0;
    if (v > 0) disbursementsMap.set(idx, v);
  });

  document.querySelectorAll(".prepay-input").forEach((el) => {
    const idx = Number(el.getAttribute("data-idx"));
    const v = Number(el.value) || 0;
    if (v > 0) prepaymentsMap.set(idx, v);
  });

  document.querySelectorAll(".roi-input").forEach((el) => {
    const idx = Number(el.getAttribute("data-idx"));
    if (el.value !== "") {
      const v = Number(el.value);
      if (!isNaN(v) && v >= 0) roiMap.set(idx, v);
    }
  });

  // Initial EMI calculation
  const initialMonthlyRate = Number(roiStartEl.value || 0) / 12 / 100;
  let currentEMI = calculateEMI(
    P,
    initialMonthlyRate,
    Math.max(1, originalTenure)
  );

  let schedule = [];
  let balance = P;
  let monthlyRate = initialMonthlyRate;
  let totalInterest = 0;
  let totalDisbursements = 0;
  let targetRemainingMonths = originalTenure; // Track target tenure

  const SAFE_MONTH_CAP = 5000;

  for (
    let monthCount = 1;
    monthCount <= SAFE_MONTH_CAP && balance > 0.0001;
    monthCount++
  ) {
    const idxForInputs = monthCount - 1;
    const monthLabel = formatDate(addMonths(startDate, monthCount));

    // Calculate remaining months at start of this month
    const remainingMonthsBefore = targetRemainingMonths - (monthCount - 1);

    // 1. Calculate interest for the month
    const interest = balance * monthlyRate;

    // 2. Calculate principal portion of EMI
    let principal = currentEMI - interest;
    if (principal < 0) {
      principal = 0;
      console.warn(`Month ${monthCount}: EMI insufficient to cover interest.`);
    }
    if (principal > balance) principal = balance;

    // 3. Apply EMI principal reduction
    balance -= principal;

    // 4. Calculate net disbursement after prepayment
    const prepay = prepaymentsMap.get(idxForInputs) || 0;
    const disbursement = disbursementsMap.get(idxForInputs) || 0;
    const netDisbursement = disbursement - prepay;

    // Apply net effect
    if (netDisbursement > 0) {
      balance += netDisbursement;
      totalDisbursements += disbursement; // Track total disbursements for reporting
    } else if (netDisbursement < 0) {
      balance = Math.max(0, balance + netDisbursement); // Effectively a prepayment
    }

    totalInterest += interest;

    // 6. Store old rate before potential ROI change
    const oldMonthlyRate = monthlyRate;
    let roiChanged = false;

    // Check for ROI change
    if (roiMap.has(idxForInputs)) {
      const newAnnual = roiMap.get(idxForInputs);
      monthlyRate = Number(newAnnual) / 12 / 100;
      roiChanged = true;
    }

    // 7. Handle EMI/Tenure adjustments based on changes
    let emiChanged = false;

    // If there's a net disbursement, recalculate EMI using OLD rate (tenure stays same)
    if (netDisbursement > 0 && balance > 0.0001) {
      const remainingMonths = targetRemainingMonths - monthCount;
      if (remainingMonths > 0) {
        const newEMI = calculateEMI(balance, oldMonthlyRate, remainingMonths); // Use OLD rate
        if (newEMI > 0 && isFinite(newEMI)) {
          currentEMI = newEMI;
          emiChanged = true;
        }
      }
    }

    // Handle ROI change
    if (roiChanged) {
      if (emiChanged) {
        // EMI already changed due to disbursement, now adjust tenure if needed
        const calculatedMonths = calculateRemainingMonths(
          balance,
          currentEMI,
          monthlyRate
        );
        if (isFinite(calculatedMonths)) {
          targetRemainingMonths = monthCount + Math.ceil(calculatedMonths);
        }
      } else {
        // Only ROI changed, recalculate tenure (EMI stays same)
        const remainingMonths = calculateRemainingMonths(
          balance,
          currentEMI,
          monthlyRate
        );
        if (isFinite(remainingMonths)) {
          targetRemainingMonths = monthCount + Math.ceil(remainingMonths);
        }
      }
    }

    // Handle pure prepayment (negative net disbursement, no ROI change)
    if (netDisbursement < 0 && !roiChanged && !emiChanged) {
      const remainingMonths = calculateRemainingMonths(
        balance,
        currentEMI,
        monthlyRate
      );
      if (isFinite(remainingMonths)) {
        targetRemainingMonths = monthCount + Math.ceil(remainingMonths);
      }
    }

    // Add month to schedule
    schedule.push({
      monthIndex: monthCount,
      monthLabel: monthLabel,
      emi: currentEMI,
      interest: interest,
      principal: principal,
      disbursement: disbursement, // Keep original for display
      prepayment: prepay, // Keep original for display
      roiChange: roiMap.has(idxForInputs) ? roiMap.get(idxForInputs) : null,
      balance: Math.max(balance, 0),
    });

    // Safety check
    if (
      Math.abs(principal) < 1e-12 &&
      prepay === 0 &&
      disbursement === 0 &&
      balance > 0.0001
    ) {
      console.warn(
        `Stopping at month ${monthCount}: No progress in reducing balance.`
      );
      break;
    }
  }

  currentSchedule = schedule;
  renderSchedule(schedule);

  // Update the chart with new data
  createAmortizationChart();

  // Update totals
  const newTotalInterest = schedule.reduce(
    (s, r) => s + Number(r.interest || 0),
    0
  );
  const origTotalInterest =
    Number(String(origTotalInterestEl.value).replace(/,/g, "")) || 0;
  const saved = Math.max(0, origTotalInterest - newTotalInterest);

  interestSavedEl.value = toCurrency(saved);
  newTotalInterestEl.value = toCurrency(newTotalInterest);
  totalDisbursementsEl.value = toCurrency(totalDisbursements);

  // Calculate and display interest saved percentage
  const savedPercentage =
    origTotalInterest > 0 ? (saved / origTotalInterest) * 100 : 0;
  interestSavedPerEl.textContent = `+${savedPercentage.toFixed(
    1
  )}% vs original`;
  interestSavedPerEl.style.color = saved > 0 ? "#22c55e" : "#6b7280"; // Green if savings, gray if none

  const completionMonthIndex = schedule.length;
  completionDateEl.value = formatDate(
    addMonths(new Date(), completionMonthIndex)
  );

  if (currentScenarioId && !loadedScenarioData) {
    currentScenarioId = null;
    currentScenarioIdEl.value = "Modified (not saved)";
  }

  updateStatsBar();
  updateCompletionProgress();
}

/////////////////////// CSV export ///////////////////////

function downloadCSV() {
  if (!currentSchedule || currentSchedule.length === 0)
    return alert("Please generate the schedule first.");
  const rows = [
    [
      "Sr No",
      "Month",
      "EMI",
      "Interest",
      "Principal",
      "Disbursement",
      "Prepayment",
      "ROI Change",
      "Balance",
    ],
  ];
  currentSchedule.forEach((r) => {
    rows.push([
      r.monthIndex,
      r.monthLabel,
      (r.emi || 0).toFixed(2),
      (r.interest || 0).toFixed(2),
      (r.principal || 0).toFixed(2),
      (r.disbursement || 0).toFixed(2),
      (r.prepayment || 0).toFixed(2),
      r.roiChange !== null && r.roiChange !== undefined ? r.roiChange : "",
      (r.balance || 0).toFixed(2),
    ]);
  });
  const csvContent = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "amortization_schedule.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/////////////////////// Helper Functions ///////////////////////

function numberToWordsIndian(num) {
  if (!num || num === 0) return "Zero";

  const a = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function inWords(n) {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
    if (n < 1000)
      return (
        a[Math.floor(n / 100)] +
        " Hundred" +
        (n % 100 ? " " + inWords(n % 100) : "")
      );
    return "";
  }

  let str = "";
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundred = Math.floor(num / 100);
  num %= 100;

  if (crore) str += inWords(crore) + " Crore ";
  if (lakh) str += inWords(lakh) + " Lakh ";
  if (thousand) str += inWords(thousand) + " Thousand ";
  if (hundred) str += inWords(hundred) + " Hundred ";
  if (num > 0) str += inWords(num) + " ";

  return str.trim();
}

function updateLoanAmountWords() {
  const value = Number(loanAmountEl.value);
  const wordsEl = document.querySelector(".loanAmountWords");

  if (isNaN(value) || value <= 0) {
    wordsEl.textContent = "Enter principal amount.";
  } else {
    const formatted = toCurrency(value);
    const inWords = numberToWordsIndian(value);
    wordsEl.textContent = `₹ ${formatted} (${inWords} Rupees)`;
  }
}

function updateStatsBar() {
  if (!currentSchedule || currentSchedule.length === 0) {
    monthlyEMIEl.textContent = "₹0";
    currentRoiEl.textContent = "0%";
    currentOutstandingEl.textContent = "₹0";
    monthsRemainingEl.textContent = "0";
    return;
  }

  const firstMonth = currentSchedule[0];
  const lastMonth = currentSchedule[currentSchedule.length - 1];

  // Get current ROI (check for any ROI changes or use initial)
  let currentROI = Number(roiStartEl.value) || 0;
  for (let i = currentSchedule.length - 1; i >= 0; i--) {
    if (currentSchedule[i].roiChange !== null) {
      currentROI = currentSchedule[i].roiChange;
      break;
    }
  }

  // Use the last month's EMI as the current EMI
  monthlyEMIEl.textContent = `₹${toCurrency(lastMonth.emi)}`;
  currentRoiEl.textContent = `${currentROI}%`;
  // Outstanding should be the balance from the first month (current outstanding)
  currentOutstandingEl.textContent = `₹${toCurrency(firstMonth.balance)}`;
  monthsRemainingEl.textContent = currentSchedule.length.toString();
  updateCompletionProgress();
}

function updateCompletionProgress() {
  const completionProgressEl = document.getElementById("completionProgress");

  if (
    !completionProgressEl ||
    !currentSchedule ||
    currentSchedule.length === 0
  ) {
    if (completionProgressEl) {
      completionProgressEl.textContent = "0%";
      completionProgressEl.style.color = "#dc3545"; // Red
    }
    return;
  }

  // Get the original loan amount
  const originalLoanAmount = Number(loanAmountEl.value) || 0;

  if (originalLoanAmount === 0) {
    completionProgressEl.textContent = "0%";
    completionProgressEl.style.color = "#dc3545"; // Red
    return;
  }

  // Get current outstanding balance (from the first month of current schedule)
  const currentOutstanding = currentSchedule[0]?.balance || 0;

  // Calculate how much has been paid off
  const amountPaidOff = originalLoanAmount - currentOutstanding;

  // Calculate completion percentage
  const completionPercentage = Math.min(
    100,
    Math.max(0, (amountPaidOff / originalLoanAmount) * 100)
  );

  // Update the display
  completionProgressEl.textContent = `${completionPercentage.toFixed(1)}%`;

  // Apply color coding based on percentage ranges
  if (completionPercentage < 20) {
    completionProgressEl.style.color = "#dc3545"; // Red
  } else if (completionPercentage < 40) {
    completionProgressEl.style.color = "#fd7e14"; // Orange
  } else if (completionPercentage < 60) {
    completionProgressEl.style.color = "#ffc107"; // Yellow
  } else if (completionPercentage < 80) {
    completionProgressEl.style.color = "#20c997"; // Teal
  } else {
    completionProgressEl.style.color = "#28a745"; // Green
  }

  // Optional: Add a tooltip with more details
  completionProgressEl.title = `Paid Off: ₹${toCurrency(
    amountPaidOff
  )} of ₹${toCurrency(originalLoanAmount)}`;
}

/////////////////////// Validation Functions ///////////////////////

function validateDisbursementInput(input) {
  const value = Number(input.value);
  const monthIdx = Number(input.getAttribute("data-idx"));
  const currentBalance = currentSchedule[monthIdx]?.balance || 0;

  // Remove any existing warning
  const existingWarning = input.parentElement.querySelector(
    ".disbursement-warning"
  );
  if (existingWarning) {
    existingWarning.remove();
  }

  if (value < 0) {
    input.value = 0;
    showInputWarning(input, "Disbursement amount cannot be negative.");
    return false;
  }

  // Warning for large disbursements
  if (currentBalance > 0 && value > currentBalance * 1.5) {
    showInputWarning(
      input,
      "Large disbursement amount relative to current balance."
    );
  }

  return true;
}

function showInputWarning(input, message) {
  const warning = document.createElement("div");
  warning.className = "disbursement-warning";
  warning.textContent = message;
  input.parentElement.appendChild(warning);

  setTimeout(() => {
    warning.remove();
  }, 5000);
}

/////////////////////// Events ///////////////////////

generateBtn.addEventListener("click", (e) => {
  e.preventDefault();
  generateBaseline();
});

applyChangesBtn.addEventListener("click", (e) => {
  e.preventDefault();
  applyUserChanges();
});

downloadCsvBtn.addEventListener("click", (e) => {
  e.preventDefault();
  downloadCSV();
});

resetBtn.addEventListener("click", (e) => {
  e.preventDefault();
  const confirmReset = confirm(
    "This will reset all inputs and unsaved changes. Continue?"
  );
  if (!confirmReset) return;

  loanAmountEl.value = 1000000;
  roiStartEl.value = 7.5;
  tenureEl.value = 60;
  updateLoanAmountWords();

  currentScenarioId = null;
  currentScenarioIdEl.value = "Not saved yet";
  loadedScenarioIdEl.value = "None loaded";
  loadedScenarioData = null;
  loadFileInputEl.value = "";
  loadScenarioBtnEl.disabled = true;

  generateBaseline();
});

// Save/Load event listeners
saveScenarioBtnEl.addEventListener("click", (e) => {
  e.preventDefault();
  saveScenario();
});

loadFileInputEl.addEventListener("change", handleFileSelection);

loadScenarioBtnEl.addEventListener("click", (e) => {
  e.preventDefault();
  loadScenario();
});

// Update loan amount words dynamically
loanAmountEl.addEventListener("input", updateLoanAmountWords);

// Validation for disbursement inputs
document.addEventListener("blur", (e) => {
  if (e.target.classList.contains("disbursement-input")) {
    validateDisbursementInput(e.target);
  }

  if (e.target.classList.contains("prepay-input")) {
    const value = Number(e.target.value);
    if (value < 0) {
      e.target.value = 0;
      showInputWarning(e.target, "Prepayment amount cannot be negative.");
    }
  }

  if (e.target.classList.contains("roi-input")) {
    const value = Number(e.target.value);
    if (value < 0) {
      e.target.value = "";
      showInputWarning(e.target, "Interest rate cannot be negative.");
    } else if (value > 50) {
      const confirmHighRate = confirm(
        `Interest rate of ${value}% seems very high. Are you sure?`
      );
      if (!confirmHighRate) {
        e.target.value = "";
      }
    }
  }
});

// Auto-apply changes when user modifies inputs
document.addEventListener("input", (e) => {
  if (
    e.target.classList.contains("disbursement-input") ||
    e.target.classList.contains("prepay-input") ||
    e.target.classList.contains("roi-input")
  ) {
    clearTimeout(window.autoApplyTimeout);
    window.autoApplyTimeout = setTimeout(() => {
      applyUserChanges();
    }, 500);
  }
});

// Track changes for scenario saving
[loanAmountEl, roiStartEl, tenureEl].forEach((input) => {
  input.addEventListener("change", () => {
    if (currentScenarioId) {
      currentScenarioIdEl.value = "Modified (not saved)";
      currentScenarioId = null;
    }
  });
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "s") {
    e.preventDefault();
    saveScenario();
  }

  if (e.ctrlKey && e.key === "g") {
    e.preventDefault();
    generateBaseline();
  }

  if (e.ctrlKey && e.key === "r") {
    e.preventDefault();
    resetBtn.click();
  }
});

// Initialize on page load
window.addEventListener("load", () => {
  loadUserPreferences();
  generateBaseline();

  // Initialize collapsed panels
  togglePanel("load-scenario");

  // Add tooltips
  document.querySelectorAll(".disbursement-input").forEach((input) => {
    input.title =
      "Enter additional loan disbursement for this month. EMI will adjust; tenure will remain unchanged if possible.";
  });
});

/////////////////////// Summary Report Function ///////////////////////

function generateSummaryReport() {
  if (!currentSchedule || currentSchedule.length === 0) {
    alert("Please generate a schedule first");
    return;
  }

  const loanAmount = Number(loanAmountEl.value);
  const roiStart = Number(roiStartEl.value);
  const tenure = parseInt(tenureEl.value);
  const newTotalInterest = currentSchedule.reduce(
    (s, r) => s + Number(r.interest || 0),
    0
  );
  const totalPrepayments = currentSchedule.reduce(
    (s, r) => s + Number(r.prepayment || 0),
    0
  );
  const totalDisbursements = currentSchedule.reduce(
    (s, r) => s + Number(r.disbursement || 0),
    0
  );
  const interestSaved =
    Number(String(interestSavedEl.value).replace(/,/g, "")) || 0;

  const report = `
LOAN AMORTIZATION SUMMARY REPORT
Generated: ${new Date().toLocaleString()}
${currentScenarioId ? `Scenario ID: ${currentScenarioId}` : ""}

LOAN DETAILS:
• Principal Amount: ₹${toCurrency(loanAmount)}
• Initial Interest Rate: ${roiStart}% per annum
• Original Tenure: ${tenure} months

RESULTS:
• Actual Completion: ${currentSchedule.length} months
• Total Interest Paid: ₹${toCurrency(newTotalInterest)}
• Total Disbursements: ₹${toCurrency(totalDisbursements)}
• Total Prepayments: ₹${toCurrency(totalPrepayments)}
• Interest Saved: ₹${toCurrency(interestSaved)}
• Completion Date: ${completionDateEl.value}

STRATEGY IMPACT:
• Tenure Change: ${currentSchedule.length - tenure} months ${
    currentSchedule.length > tenure ? "(extended)" : "(reduced)"
  }
• Monthly Savings: ₹${toCurrency(interestSaved / tenure)} average
  `.trim();

  const blob = new Blob([report], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `loan_summary_${currentScenarioId || "report"}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Add summary report button
const summaryBtn = document.createElement("button");
summaryBtn.className = "btn btn-outline-info";
summaryBtn.textContent = "Summary Report";
summaryBtn.title = "Generate summary report";
summaryBtn.addEventListener("click", generateSummaryReport);
document.querySelector(".floating-buttons").appendChild(summaryBtn);

// Local Storage for User Preferences (not scenario data)
function saveUserPreferences() {
  const preferences = {
    defaultLoanAmount: loanAmountEl.value,
    defaultROI: roiStartEl.value,
    defaultTenure: tenureEl.value,
    lastSaved: new Date().toISOString(),
  };

  try {
    localStorage.setItem(
      "loanCalculatorPreferences",
      JSON.stringify(preferences)
    );
  } catch (e) {
    console.log("Cannot save preferences - localStorage not available");
  }
}

function loadUserPreferences() {
  try {
    const saved = localStorage.getItem("loanCalculatorPreferences");
    if (saved) {
      const preferences = JSON.parse(saved);

      if (
        preferences.defaultLoanAmount > 0 &&
        preferences.defaultLoanAmount < 100000000
      ) {
        loanAmountEl.value = preferences.defaultLoanAmount;
      }
      if (preferences.defaultROI > 0 && preferences.defaultROI < 50) {
        roiStartEl.value = preferences.defaultROI;
      }
      if (preferences.defaultTenure > 0 && preferences.defaultTenure < 600) {
        tenureEl.value = preferences.defaultTenure;
      }

      updateLoanAmountWords();
    }
  } catch (e) {
    console.log("Cannot load preferences - using defaults");
  }
}

// Auto-save preferences when main inputs change
[loanAmountEl, roiStartEl, tenureEl].forEach((input) => {
  input.addEventListener("change", () => {
    setTimeout(saveUserPreferences, 1000);
  });
});

// Load preferences on startup
window.addEventListener("load", () => {
  loadUserPreferences();
});

// Scroll navigation functions
function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

function scrollToBottom() {
  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: "smooth",
  });
}
