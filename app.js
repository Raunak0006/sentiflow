// SentiFlow - Core Application Controller
// Orchestrates tabs, sandbox real-time updates, mock tickers, bulk parses, and lexicon overrides.

document.addEventListener("DOMContentLoaded", () => {
  // Initialize NLP Sentiment Analyzer
  const analyzer = new window.SentimentAnalyzer();

  // Active configurations (to toggle features from settings)
  let configOptions = {
    applyNegations: true,
    applyIntensifiers: true,
    applyContrastive: true
  };

  // State Management
  let activeTab = "sandbox";
  let sandboxKeywordChart = null;
  let bulkSentimentPie = null;
  let bulkKeywordChart = null;
  let streamTrendChart = null;

  // Stream State
  let streamIntervalId = null;
  let streamIsTicking = true;
  let streamTotalCount = 0;
  let streamPosCount = 0;
  let streamNeuCount = 0;
  let streamNegCount = 0;
  let streamScoreHistory = [];
  const MAX_HISTORY = 15;

  // Bulk State
  let bulkRawData = []; // Parsed file rows
  let bulkAnalyzedData = []; // Sentiment results
  let bulkColumns = [];
  let bulkSelectedColumn = "";
  let bulkTablePage = 1;
  const BULK_ROWS_PER_PAGE = 10;

  // Lexicon State
  let customLexicon = { ...window.SENTIMENT_LEXICON };
  let lexiconTablePage = 1;
  const LEXICON_ROWS_PER_PAGE = 10;
  let currentEditingWord = "";

  // ----------------------------------------------------
  // 1. NAVIGATION TAB HANDLERS
  // ----------------------------------------------------
  const tabs = document.querySelectorAll(".nav-tab");
  const tabContents = document.querySelectorAll(".tab-content");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      
      // Toggle nav class
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      // Toggle content section
      tabContents.forEach(content => {
        content.classList.remove("active");
        if (content.id === `tab-${target}`) {
          content.classList.add("active");
        }
      });

      activeTab = target;
      
      // Perform tab initializations if needed
      if (activeTab === "stream") {
        initStreamChart();
        if (streamIsTicking && !streamIntervalId) {
          startStream();
        }
      } else {
        // Stop stream ticking in background to conserve resources (optional)
        // We will keep it ticking or pause based on preference, let's keep it ticking unless they pause it.
      }

      if (activeTab === "tuning") {
        renderLexiconBrowser();
      }
    });
  });

  // ----------------------------------------------------
  // 2. LINGUISTIC SANDBOX CONTROLLER
  // ----------------------------------------------------
  const sandboxTextarea = document.getElementById("sandbox-textarea");
  const charWordCountLabel = document.getElementById("char-word-count");
  const clearSandboxBtn = document.getElementById("clear-sandbox-btn");
  const presetButtons = document.querySelectorAll(".preset-btn");

  // Output DOM Nodes
  const sentimentCatText = document.getElementById("sentiment-cat-text");
  const sentimentCatCard = document.getElementById("sentiment-cat-card");
  const sentimentScoreText = document.getElementById("sentiment-score-text");
  const sentimentScoreCard = document.getElementById("sentiment-score-card");
  const gaugeFillCircle = document.getElementById("gauge-fill-circle");
  const gaugePercent = document.getElementById("gauge-percent");

  const metricSentences = document.getElementById("metric-sentences");
  const metricAvgLen = document.getElementById("metric-avg-len");
  const metricReadTime = document.getElementById("metric-read-time");

  const sentenceHighlighterArea = document.getElementById("sentence-highlighter-area");
  const sentenceDetailsInspector = document.getElementById("sentence-details-inspector");

  // Handle Input Changes
  sandboxTextarea.addEventListener("input", debounce(() => {
    runSandboxAnalysis();
  }, 100));

  clearSandboxBtn.addEventListener("click", () => {
    sandboxTextarea.value = "";
    runSandboxAnalysis();
  });

  // Sample Preset Buttons
  presetButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      sandboxTextarea.value = btn.dataset.text;
      runSandboxAnalysis();
    });
  });

  // Debounce helper
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Core sandbox processor
  function runSandboxAnalysis() {
    const text = sandboxTextarea.value;
    
    // Character and Word Count updates
    const charCount = text.length;
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    charWordCountLabel.textContent = `${charCount} characters | ${wordCount} words`;

    // Process using our NLP Sentiment Engine
    // Pass custom configurations if they've toggled options
    analyzer.setLexicon(customLexicon);
    
    // Apply options overrides (We decorate the analyzer class variables dynamically)
    analyzer.applyNegations = configOptions.applyNegations;
    analyzer.applyIntensifiers = configOptions.applyIntensifiers;
    analyzer.applyContrastive = configOptions.applyContrastive;

    const analysis = analyzer.analyze(text);

    // Update classification card and colors
    updateSentimentUI(analysis.sentiment, analysis.score);

    // Update text metrics
    metricSentences.textContent = analysis.metrics.sentenceCount;
    metricAvgLen.textContent = analysis.metrics.avgSentenceLength;
    metricReadTime.textContent = `${analysis.metrics.readingTime}s`;

    // Render word frequency chart
    renderSandboxChart(analysis.keywords);

    // Render interactive sentence breakdown
    renderSentenceHighlighter(analysis.sentences);
  }

  // Update Classification & Score elements
  function updateSentimentUI(sentiment, score) {
    // Reset classes
    sentimentCatCard.className = "result-card";
    sentimentScoreCard.className = "result-card";

    // Set text
    sentimentScoreText.textContent = score >= 0 ? `+${score.toFixed(4)}` : score.toFixed(4);

    if (score === 0 && sentiment === "neutral") {
      sentimentCatText.textContent = "Neutral";
      sentimentCatCard.classList.add("neutral");
      sentimentScoreCard.classList.add("neutral");
    } else if (sentiment === "positive") {
      sentimentCatText.textContent = "Positive";
      sentimentCatCard.classList.add("positive");
      sentimentScoreCard.classList.add("positive");
    } else if (sentiment === "negative") {
      sentimentCatText.textContent = "Negative";
      sentimentCatCard.classList.add("negative");
      sentimentScoreCard.classList.add("negative");
    } else {
      sentimentCatText.textContent = "Neutral";
      sentimentCatCard.classList.add("neutral");
      sentimentScoreCard.classList.add("neutral");
    }

    // SVG Radial Gauge Mathematics
    // Radius = 50, Circumference = 2 * PI * r = 314
    // Compound score ranges from -1.0 to +1.0. Map it to 0 to 100%
    const percentage = Math.round(((score + 1.0) / 2.0) * 100);
    gaugePercent.textContent = `${percentage}%`;

    // Dashoffset: 314 is empty, 0 is full.
    const offset = 314 - (314 * (percentage / 100));
    gaugeFillCircle.style.strokeDashoffset = offset;

    // Apply color accent to the gauge fill (absolutely no blue!)
    if (sentiment === "positive") {
      gaugeFillCircle.style.stroke = "hsl(145, 60%, 48%)";
    } else if (sentiment === "negative") {
      gaugeFillCircle.style.stroke = "hsl(355, 75%, 55%)";
    } else {
      gaugeFillCircle.style.stroke = "hsl(38, 90%, 55%)";
    }
  }

  // Render Horizontal Bar Chart for Keywords (No Blue, uses violet hues)
  function renderSandboxChart(keywords) {
    const ctx = document.getElementById("sandbox-keyword-chart").getContext("2d");
    
    const labels = keywords.map(k => k.text);
    const dataValues = keywords.map(k => k.value);

    if (sandboxKeywordChart) {
      sandboxKeywordChart.destroy();
    }

    if (keywords.length === 0) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      return;
    }

    sandboxKeywordChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Occurrences",
          data: dataValues,
          backgroundColor: "hsla(280, 75%, 60%, 0.65)",
          borderColor: "hsl(280, 75%, 60%)",
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "hsl(270, 4%, 9%)",
            borderColor: "hsla(280, 75%, 60%, 0.4)",
            borderWidth: 1,
            titleColor: "#fff",
            bodyColor: "hsl(0, 0%, 90%)"
          }
        },
        scales: {
          x: {
            grid: { color: "hsla(270, 4%, 20%, 0.3)" },
            ticks: { color: "hsl(270, 2%, 60%)", stepSize: 1 }
          },
          y: {
            grid: { display: false },
            ticks: { color: "hsl(0, 0%, 90%)", font: { weight: "600" } }
          }
        }
      }
    });
  }

  // Interactive sentence parser renders
  function renderSentenceHighlighter(sentences) {
    sentenceHighlighterArea.innerHTML = "";
    
    if (sentences.length === 0 || (sentences.length === 1 && sentences[0].sentence.trim() === "")) {
      sentenceHighlighterArea.innerHTML = `<p class="placeholder-text">Please type something in the sandbox to see sentence breaks.</p>`;
      sentenceDetailsInspector.innerHTML = `
        <h3>Linguistic Inspector</h3>
        <div class="inspector-content">
          <p class="placeholder-text">Select a sentence on the left to analyze word-by-word valence contributions.</p>
        </div>
      `;
      return;
    }

    sentences.forEach((sData, index) => {
      const span = document.createElement("span");
      span.className = "sentence-span";
      span.textContent = sData.sentence;

      // Color boundary class indicators depending on sentence score
      const sc = sData.score;
      if (sc >= 1.5) {
        span.classList.add("pos-high");
      } else if (sc > 0.1) {
        span.classList.add("pos-low");
      } else if (sc < -1.5) {
        span.classList.add("neg-high");
      } else if (sc < -0.1) {
        span.classList.add("neg-low");
      } else {
        span.classList.add("neu-sent");
      }

      // Action listener
      span.addEventListener("click", () => {
        document.querySelectorAll(".sentence-span").forEach(s => s.classList.remove("active"));
        span.classList.add("active");
        inspectSentence(sData);
      });

      sentenceHighlighterArea.appendChild(span);
    });

    // Proactively select the first sentence to show detail immediately
    sentenceHighlighterArea.firstChild.click();
  }

  // Inspectors detail view of specific sentences
  function inspectSentence(sData) {
    sentenceDetailsInspector.innerHTML = "";

    const h3 = document.createElement("h3");
    h3.textContent = "Linguistic Inspector";
    sentenceDetailsInspector.appendChild(h3);

    const container = document.createElement("div");
    container.className = "inspector-content flex-col";

    // Sentiment badge card
    const badgeRow = document.createElement("div");
    let badgeClass = "badge-orange";
    let badgeText = "Neutral";
    if (sData.score > 0.1) {
      badgeClass = "badge-emerald";
      badgeText = "Positive";
    } else if (sData.score < -0.1) {
      badgeClass = "badge-crimson";
      badgeText = "Negative";
    }
    
    badgeRow.innerHTML = `
      <div class="inspector-score-pill ${sData.score > 0.1 ? 'text-emerald' : (sData.score < -0.1 ? 'text-crimson' : 'text-orange')}">
        Sentence Score: <span class="word-score-val">${sData.score > 0 ? '+' : ''}${sData.score.toFixed(2)}</span>
        <span class="badge ${badgeClass}">${badgeText}</span>
      </div>
    `;
    container.appendChild(badgeRow);

    // List sentiment tokens
    const tokensHeader = document.createElement("h4");
    tokensHeader.textContent = "Recognized Valence Words:";
    tokensHeader.style.fontSize = "12px";
    tokensHeader.style.color = "var(--text-muted)";
    tokensHeader.style.textTransform = "uppercase";
    tokensHeader.style.marginTop = "10px";
    container.appendChild(tokensHeader);

    const wordsGrid = document.createElement("div");
    wordsGrid.className = "inspector-words-grid";

    if (sData.wordBreakdown.length === 0) {
      wordsGrid.innerHTML = `<p class="placeholder-text" style="padding: 20px 0;">No active sentiment words found in this sentence.</p>`;
    } else {
      sData.wordBreakdown.forEach(w => {
        const item = document.createElement("div");
        item.className = "inspector-word-pill";
        if (w.score > 0) item.classList.add("positive-w");
        if (w.score < 0) item.classList.add("negative-w");

        // Format modification metadata (Caps, Negation, Intensified)
        let metaHtml = "";
        if (w.negation) metaHtml += `<span class="meta-badge negated">Negated</span>`;
        if (w.intensifier) metaHtml += `<span class="meta-badge boosted">Intensified</span>`;
        if (w.caps) metaHtml += `<span class="meta-badge caps">ALL CAPS</span>`;

        item.innerHTML = `
          <div class="flex-col" style="gap: 4px; align-items: flex-start;">
            <span style="font-weight: 600;">${w.word}</span>
            <div class="word-meta-details">
              <span>Base: ${w.originalScore.toFixed(1)}</span>
              ${metaHtml}
            </div>
          </div>
          <span class="word-score-val ${w.score > 0 ? 'pos' : 'neg'}">${w.score > 0 ? '+' : ''}${w.score.toFixed(2)}</span>
        `;
        wordsGrid.appendChild(item);
      });
    }

    container.appendChild(wordsGrid);
    sentenceDetailsInspector.appendChild(container);
  }

  // ----------------------------------------------------
  // 3. INTELLIGENCE STREAM CONTROLLER (Live Simulation)
  // ----------------------------------------------------
  const streamCategorySelect = document.getElementById("stream-category-select");
  const streamToggleBtn = document.getElementById("stream-toggle-btn");
  const streamTickerContainer = document.getElementById("stream-ticker-container");
  
  const streamStatTotal = document.getElementById("stream-stat-total");
  const streamStatPos = document.getElementById("stream-stat-pos");
  const streamStatNeu = document.getElementById("stream-stat-neu");
  const streamStatNeg = document.getElementById("stream-stat-neg");
  const streamStatusBadge = document.getElementById("stream-status");

  streamToggleBtn.addEventListener("click", () => {
    if (streamIsTicking) {
      pauseStream();
    } else {
      resumeStream();
    }
  });

  streamCategorySelect.addEventListener("change", () => {
    // Clear feed on category change and reset metrics optionally
    streamTickerContainer.innerHTML = "";
    streamTotalCount = 0;
    streamPosCount = 0;
    streamNeuCount = 0;
    streamNegCount = 0;
    streamScoreHistory = [];
    
    streamStatTotal.textContent = 0;
    streamStatPos.textContent = "0%";
    streamStatNeu.textContent = "0%";
    streamStatNeg.textContent = "0%";

    if (streamTrendChart) {
      streamTrendChart.data.labels = [];
      streamTrendChart.data.datasets[0].data = [];
      streamTrendChart.update();
    }

    // Trigger immediate slide in
    tickStream();
  });

  function startStream() {
    // Run an initial tick right away
    tickStream();
    streamIntervalId = setInterval(tickStream, 2500);
  }

  function pauseStream() {
    streamIsTicking = false;
    clearInterval(streamIntervalId);
    streamIntervalId = null;
    streamToggleBtn.textContent = "Resume Stream";
    streamToggleBtn.className = "btn btn-secondary";
    streamStatusBadge.textContent = "Paused";
    streamStatusBadge.className = "badge badge-orange";
  }

  function resumeStream() {
    streamIsTicking = true;
    streamToggleBtn.textContent = "Pause Stream";
    streamToggleBtn.className = "btn btn-primary";
    streamStatusBadge.textContent = "Ticking...";
    streamStatusBadge.className = "badge badge-purple";
    startStream();
  }

  // Add random comment tick
  function tickStream() {
    const category = streamCategorySelect.value;
    const categoryFeed = window.MOCK_STREAMS[category];
    if (!categoryFeed || categoryFeed.length === 0) return;

    // Grab random item
    const randomItem = categoryFeed[Math.floor(Math.random() * categoryFeed.length)];
    
    // Analyze using lexicon overrides
    analyzer.setLexicon(customLexicon);
    const analysis = analyzer.analyze(randomItem.text);

    // Increment Counts
    streamTotalCount++;
    if (analysis.sentiment === "positive") streamPosCount++;
    else if (analysis.sentiment === "negative") streamNegCount++;
    else streamNeuCount++;

    // Compute Rolling Average score history (store compound scores)
    streamScoreHistory.push(analysis.score);
    if (streamScoreHistory.length > MAX_HISTORY) {
      streamScoreHistory.shift();
    }

    // Update Ticker Feed Cards
    const card = document.createElement("div");
    card.className = "stream-card";
    
    let sentimentText = "Neutral";
    let badgeClass = "badge-orange";
    if (analysis.sentiment === "positive") {
      sentimentText = "Positive";
      badgeClass = "badge-emerald";
    } else if (analysis.sentiment === "negative") {
      sentimentText = "Negative";
      badgeClass = "badge-crimson";
    }

    card.innerHTML = `
      <div class="stream-card-header">
        <span class="stream-username">${randomItem.user}</span>
        <span class="badge ${badgeClass}">${sentimentText} (${analysis.score >= 0 ? '+' : ''}${analysis.score.toFixed(2)})</span>
      </div>
      <p class="stream-body">${randomItem.text}</p>
    `;

    // Insert at top
    streamTickerContainer.insertBefore(card, streamTickerContainer.firstChild);

    // Limit scroll items in DOM to prevent bloating
    if (streamTickerContainer.children.length > 8) {
      streamTickerContainer.removeChild(streamTickerContainer.lastChild);
    }

    // Update Stats UI
    streamStatTotal.textContent = streamTotalCount;
    streamStatPos.textContent = `${Math.round((streamPosCount / streamTotalCount) * 100)}%`;
    streamStatNeu.textContent = `${Math.round((streamNeuCount / streamTotalCount) * 100)}%`;
    streamStatNeg.textContent = `${Math.round((streamNegCount / streamTotalCount) * 100)}%`;

    // Update Line Chart data
    if (streamTrendChart) {
      // Create horizontal labels e.g. "T-15", "T-14", ...
      const labels = streamScoreHistory.map((_, i) => `Tick ${streamTotalCount - streamScoreHistory.length + i + 1}`);
      streamTrendChart.data.labels = labels;
      streamTrendChart.data.datasets[0].data = streamScoreHistory;
      
      // Update color based on general average
      const avg = streamScoreHistory.reduce((a, b) => a + b, 0) / streamScoreHistory.length;
      if (avg > 0.05) {
        streamTrendChart.data.datasets[0].borderColor = "hsl(145, 60%, 48%)";
        streamTrendChart.data.datasets[0].backgroundColor = "hsla(145, 60%, 48%, 0.15)";
      } else if (avg < -0.05) {
        streamTrendChart.data.datasets[0].borderColor = "hsl(355, 75%, 55%)";
        streamTrendChart.data.datasets[0].backgroundColor = "hsla(355, 75%, 55%, 0.15)";
      } else {
        streamTrendChart.data.datasets[0].borderColor = "hsl(38, 90%, 55%)";
        streamTrendChart.data.datasets[0].backgroundColor = "hsla(38, 90%, 55%, 0.15)";
      }

      streamTrendChart.update();
    }
  }

  // Draw Line Chart (Absolutely no blue color!)
  function initStreamChart() {
    if (streamTrendChart) return; // Already drawn

    const ctx = document.getElementById("stream-trend-chart").getContext("2d");
    streamTrendChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label: "Linguistic Score (Compound)",
          data: [],
          borderColor: "hsl(280, 75%, 60%)",
          backgroundColor: "hsla(280, 75%, 60%, 0.1)",
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: "#fff"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "hsl(270, 4%, 9%)",
            borderColor: "hsla(280, 75%, 60%, 0.4)",
            borderWidth: 1
          }
        },
        scales: {
          x: {
            grid: { color: "hsla(270, 4%, 20%, 0.2)" },
            ticks: { color: "hsl(270, 2%, 60%)", maxTicksLimit: 6 }
          },
          y: {
            min: -1.0,
            max: 1.0,
            grid: { color: "hsla(270, 4%, 20%, 0.3)" },
            ticks: { color: "hsl(270, 2%, 60%)" }
          }
        }
      }
    });
  }

  // ----------------------------------------------------
  // 4. BULK DOCUMENT PROCESSOR CONTROLLER
  // ----------------------------------------------------
  const bulkDropzone = document.getElementById("bulk-dropzone");
  const bulkFileInput = document.getElementById("bulk-file-input");
  const fileInfoContainer = document.getElementById("file-info-container");
  const fileLblName = document.getElementById("file-lbl-name");
  const fileLblSize = document.getElementById("file-lbl-size");
  const fileLblRows = document.getElementById("file-lbl-rows");
  const columnSelector = document.getElementById("column-selector");
  const runBulkBtn = document.getElementById("run-bulk-btn");
  const generateBulkSampleBtn = document.getElementById("generate-bulk-sample-btn");
  const bulkResultsBadge = document.getElementById("bulk-results-badge");

  const bulkSumTotal = document.getElementById("bulk-sum-total");
  const bulkSumPos = document.getElementById("bulk-sum-pos");
  const bulkSumNeu = document.getElementById("bulk-sum-neu");
  const bulkSumNeg = document.getElementById("bulk-sum-neg");
  const bulkSumAvg = document.getElementById("bulk-sum-avg");

  const bulkTableBody = document.getElementById("bulk-table-body");
  const bulkTableSearch = document.getElementById("bulk-table-search");
  const bulkTableFilter = document.getElementById("bulk-table-filter");
  const bulkExportCsvBtn = document.getElementById("bulk-export-csv");

  const tablePageInfo = document.getElementById("table-page-info");
  const pagPrevBtn = document.getElementById("pag-prev");
  const pagNextBtn = document.getElementById("pag-next");

  // Drag over drop handlers
  bulkDropzone.addEventListener("click", () => bulkFileInput.click());
  
  bulkDropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    bulkDropzone.classList.add("dragover");
  });

  bulkDropzone.addEventListener("dragleave", () => {
    bulkDropzone.classList.remove("dragover");
  });

  bulkDropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    bulkDropzone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      handleBulkFile(e.dataTransfer.files[0]);
    }
  });

  bulkFileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleBulkFile(e.target.files[0]);
    }
  });

  generateBulkSampleBtn.addEventListener("click", () => {
    generateAndLoadMockDataset();
  });

  // Basic CSV / JSON Parser
  function handleBulkFile(file) {
    const name = file.name;
    const sizeStr = formatBytes(file.size);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      
      if (name.endsWith(".json")) {
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            bulkRawData = parsed;
          } else {
            alert("JSON must be an array of objects representing reviews.");
            return;
          }
        } catch (err) {
          alert("Error parsing JSON file. Check format.");
          return;
        }
      } else {
        // Parse CSV or general TXT line by line
        bulkRawData = parseCSVString(content);
      }

      if (bulkRawData.length === 0) {
        alert("The uploaded file has no readable data.");
        return;
      }

      // Populate file label properties
      fileLblName.textContent = name;
      fileLblSize.textContent = sizeStr;
      fileLblRows.textContent = bulkRawData.length;
      
      // Populate column options dropdown
      columnSelector.innerHTML = "";
      
      // Get all headers from first record
      const firstRecord = bulkRawData[0];
      bulkColumns = Object.keys(firstRecord);
      
      bulkColumns.forEach(col => {
        const option = document.createElement("option");
        option.value = col;
        option.textContent = col;
        
        // Autoselect popular feedback names
        const lowerCol = col.toLowerCase();
        if (lowerCol.includes("text") || lowerCol.includes("review") || lowerCol.includes("comment") || lowerCol.includes("feedback") || lowerCol.includes("body")) {
          option.selected = true;
        }
        columnSelector.appendChild(option);
      });

      fileInfoContainer.classList.remove("hidden");
      bulkResultsBadge.textContent = "Data Loaded";
      bulkResultsBadge.className = "badge badge-purple";
    };
    reader.readAsText(file);
  }

  // Parse CSV helper string to array of objects
  function parseCSVString(csvText) {
    const lines = [];
    let row = [""];
    let inQuotes = false;

    // Character scanner to cleanly parse CSV with quotes and nested commas
    for (let i = 0; i < csvText.length; i++) {
      const c = csvText[i];
      const nextC = csvText[i+1];
      
      if (c === '"') {
        if (inQuotes && nextC === '"') {
          // Doubled quotes inside quote block means escaped quote
          row[row.length - 1] += '"';
          i++;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push("");
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && nextC === '\n') {
          i++;
        }
        lines.push(row);
        row = [""];
      } else {
        row[row.length - 1] += c;
      }
    }
    
    if (row.length > 1 || row[0] !== "") {
      lines.push(row);
    }

    if (lines.length <= 1) return [];

    const headers = lines[0].map(h => h.trim());
    const dataObjects = [];

    for (let r = 1; r < lines.length; r++) {
      const values = lines[r];
      // Skip empty lines
      if (values.length === 1 && values[0] === "") continue;

      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = values[idx] !== undefined ? values[idx].trim() : "";
      });
      dataObjects.push(obj);
    }

    return dataObjects;
  }

  // Run sentiment analyzer over entire bulk spreadsheet
  runBulkBtn.addEventListener("click", () => {
    bulkSelectedColumn = columnSelector.value;
    if (!bulkSelectedColumn) {
      alert("Please select the text column for sentiment mapping.");
      return;
    }

    runBulkBtn.textContent = "Processing Speech...";
    runBulkBtn.disabled = true;

    // Delay slightly to allow UI thread to paint loader
    setTimeout(() => {
      bulkAnalyzedData = [];
      analyzer.setLexicon(customLexicon);

      let totalScore = 0;
      let posCount = 0;
      let neuCount = 0;
      let negCount = 0;

      // Extract general themes/word occurrences for the file
      const bulkWordFreq = {};

      bulkRawData.forEach((row, index) => {
        const textVal = row[bulkSelectedColumn] || "";
        const analysis = analyzer.analyze(textVal);

        totalScore += analysis.score;
        if (analysis.sentiment === "positive") posCount++;
        else if (analysis.sentiment === "negative") negCount++;
        else neuCount++;

        // Add tokens to word cloud frequency
        analysis.keywords.forEach(kw => {
          bulkWordFreq[kw.text] = (bulkWordFreq[kw.text] || 0) + kw.value;
        });

        bulkAnalyzedData.push({
          rowId: index + 1,
          rawText: textVal,
          classification: analysis.sentiment,
          score: analysis.score,
          primaryKeywords: analysis.keywords.slice(0, 3).map(k => k.text).join(", "),
          originalRow: row
        });
      });

      // Update Aggregated statistics Card
      const avgScore = bulkRawData.length > 0 ? (totalScore / bulkRawData.length) : 0;
      bulkSumTotal.textContent = bulkRawData.length;
      bulkSumPos.textContent = posCount;
      bulkSumNeu.textContent = neuCount;
      bulkSumNeg.textContent = negCount;
      bulkSumAvg.textContent = avgScore.toFixed(4);

      bulkResultsBadge.textContent = "Analysis Done";
      bulkResultsBadge.className = "badge badge-emerald";

      // Render Pie Distribution chart
      renderBulkPieChart(posCount, neuCount, negCount);

      // Render Theme Bar chart
      const sortedBulkThemes = Object.keys(bulkWordFreq)
        .map(k => ({ text: k, value: bulkWordFreq[k] }))
        .sort((a,b) => b.value - a.value)
        .slice(0, 10);
      renderBulkKeywordsBar(sortedBulkThemes);

      // Reset Table pagination and display
      bulkTablePage = 1;
      displayBulkGridTable();

      runBulkBtn.textContent = "Run Sentiment Sweep";
      runBulkBtn.disabled = false;
    }, 100);
  });

  // Display grid dataset table rows
  function displayBulkGridTable() {
    bulkTableBody.innerHTML = "";

    // Apply Search Filter and Classification Filter first
    const searchQuery = bulkTableSearch.value.toLowerCase().trim();
    const classFilter = bulkTableFilter.value;

    const filtered = bulkAnalyzedData.filter(item => {
      const matchSearch = item.rawText.toLowerCase().includes(searchQuery) || item.primaryKeywords.toLowerCase().includes(searchQuery);
      const matchClass = classFilter === "all" || item.classification === classFilter;
      return matchSearch && matchClass;
    });

    if (filtered.length === 0) {
      bulkTableBody.innerHTML = `<tr><td colspan="5" class="table-placeholder">No matching reviews found.</td></tr>`;
      tablePageInfo.textContent = "Showing 0 of 0 records";
      pagPrevBtn.disabled = true;
      pagNextBtn.disabled = true;
      return;
    }

    // Pagination calculations
    const totalRecords = filtered.length;
    const totalPages = Math.ceil(totalRecords / BULK_ROWS_PER_PAGE);
    
    // Safety check boundaries
    if (bulkTablePage > totalPages) bulkTablePage = totalPages;
    if (bulkTablePage < 1) bulkTablePage = 1;

    const startIndex = (bulkTablePage - 1) * BULK_ROWS_PER_PAGE;
    const endIndex = Math.min(startIndex + BULK_ROWS_PER_PAGE, totalRecords);

    const pageSlice = filtered.slice(startIndex, endIndex);

    pageSlice.forEach(item => {
      const tr = document.createElement("tr");

      let badgeClass = "badge-orange";
      if (item.classification === "positive") badgeClass = "badge-emerald";
      else if (item.classification === "negative") badgeClass = "badge-crimson";

      tr.innerHTML = `
        <td style="font-weight:700;">${item.rowId}</td>
        <td title="${escapeHtml(item.rawText)}">${escapeHtml(item.rawText)}</td>
        <td><span class="badge ${badgeClass}">${item.classification}</span></td>
        <td style="font-family: monospace; font-weight:700; color:${item.score > 0.05 ? 'var(--color-positive)' : (item.score < -0.05 ? 'var(--color-negative)' : 'var(--color-neutral)')};">
          ${item.score >= 0 ? '+' : ''}${item.score.toFixed(4)}
        </td>
        <td style="font-style: italic; color:var(--text-muted);">${escapeHtml(item.primaryKeywords || "None")}</td>
      `;

      bulkTableBody.appendChild(tr);
    });

    // Update buttons & info labels
    tablePageInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${totalRecords} records (Page ${bulkTablePage}/${totalPages})`;
    pagPrevBtn.disabled = bulkTablePage === 1;
    pagNextBtn.disabled = bulkTablePage === totalPages;
  }

  // Pagination Actions
  pagPrevBtn.addEventListener("click", () => {
    if (bulkTablePage > 1) {
      bulkTablePage--;
      displayBulkGridTable();
    }
  });

  pagNextBtn.addEventListener("click", () => {
    const totalFiltered = bulkAnalyzedData.filter(item => {
      const searchQuery = bulkTableSearch.value.toLowerCase().trim();
      const classFilter = bulkTableFilter.value;
      const matchSearch = item.rawText.toLowerCase().includes(searchQuery) || item.primaryKeywords.toLowerCase().includes(searchQuery);
      const matchClass = classFilter === "all" || item.classification === classFilter;
      return matchSearch && matchClass;
    }).length;

    const totalPages = Math.ceil(totalFiltered / BULK_ROWS_PER_PAGE);
    if (bulkTablePage < totalPages) {
      bulkTablePage++;
      displayBulkGridTable();
    }
  });

  bulkTableSearch.addEventListener("input", () => {
    bulkTablePage = 1;
    displayBulkGridTable();
  });

  bulkTableFilter.addEventListener("change", () => {
    bulkTablePage = 1;
    displayBulkGridTable();
  });

  // Export CSV Action
  bulkExportCsvBtn.addEventListener("click", () => {
    if (bulkAnalyzedData.length === 0) {
      alert("No data available to export. Please parse a dataset first.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Form headers (original columns + output classifications)
    const originalHeaders = Object.keys(bulkRawData[0]);
    const headers = [...originalHeaders, "Linguistic_Classification", "Compound_Sentiment_Score"];
    
    csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";

    bulkAnalyzedData.forEach(item => {
      const rowVals = [];
      originalHeaders.forEach(col => {
        const val = item.originalRow[col] || "";
        rowVals.push(`"${val.replace(/"/g, '""')}"`);
      });
      rowVals.push(`"${item.classification}"`);
      rowVals.push(`"${item.score.toFixed(4)}"`);
      
      csvContent += rowVals.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "SentiFlow_Linguistic_Report.csv");
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
  });

  // Draw Pie Chart (Zero Blue!)
  function renderBulkPieChart(pos, neu, neg) {
    const ctx = document.getElementById("bulk-sentiment-pie").getContext("2d");

    if (bulkSentimentPie) {
      bulkSentimentPie.destroy();
    }

    bulkSentimentPie = new Chart(ctx, {
      type: "pie",
      data: {
        labels: ["Positive", "Neutral", "Negative"],
        datasets: [{
          data: [pos, neu, neg],
          backgroundColor: [
            "hsl(145, 60%, 48%)", // Emerald
            "hsl(38, 90%, 55%)",  // Amber
            "hsl(355, 75%, 55%)"  // Crimson
          ],
          borderColor: "hsl(270, 4%, 9%)",
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "hsl(0, 0%, 90%)", boxWidth: 12, font: { weight: "600" } }
          },
          tooltip: {
            backgroundColor: "hsl(270, 4%, 9%)",
            borderColor: "hsla(280, 75%, 60%, 0.4)",
            borderWidth: 1
          }
        }
      }
    });
  }

  // Draw themes bar chart (Zero Blue!)
  function renderBulkKeywordsBar(themes) {
    const ctx = document.getElementById("bulk-keyword-chart").getContext("2d");

    if (bulkKeywordChart) {
      bulkKeywordChart.destroy();
    }

    if (themes.length === 0) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      return;
    }

    bulkKeywordChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: themes.map(t => t.text),
        datasets: [{
          data: themes.map(t => t.value),
          backgroundColor: "hsla(280, 75%, 60%, 0.6)",
          borderColor: "hsl(280, 75%, 60%)",
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "hsl(270, 4%, 9%)",
            borderColor: "hsla(280, 75%, 60%, 0.4)",
            borderWidth: 1
          }
        },
        scales: {
          x: {
            grid: { color: "hsla(270, 4%, 20%, 0.2)" },
            ticks: { color: "hsl(270, 2%, 60%)" }
          },
          y: {
            grid: { display: false },
            ticks: { color: "hsl(0, 0%, 90%)", font: { weight: "600" } }
          }
        }
      }
    });
  }

  // Generates e-commerce reviews dataset for immediate sandbox load
  function generateAndLoadMockDataset() {
    const mockCategories = ["tech", "food", "movies", "ecommerce"];
    const rows = [];

    // Loop and synthesize 50 rows
    for (let i = 0; i < 50; i++) {
      const cat = mockCategories[i % mockCategories.length];
      const categoryFeed = window.MOCK_STREAMS[cat];
      const baseItem = categoryFeed[Math.floor(Math.random() * categoryFeed.length)];
      
      rows.push({
        "Feedback_ID": `ID_${1000 + i}`,
        "User_Handle": baseItem.user,
        "Customer_Review": baseItem.text,
        "Review_Sector": cat.toUpperCase()
      });
    }

    bulkRawData = rows;
    
    // Set file label properties
    fileLblName.textContent = "Synthesized_Customer_Reviews.csv";
    fileLblSize.textContent = "7.8 KB";
    fileLblRows.textContent = rows.length;

    // Set columns selector
    columnSelector.innerHTML = "";
    const colKeys = Object.keys(rows[0]);
    colKeys.forEach(col => {
      const o = document.createElement("option");
      o.value = col;
      o.textContent = col;
      if (col === "Customer_Review") o.selected = true;
      columnSelector.appendChild(o);
    });

    fileInfoContainer.classList.remove("hidden");
    bulkResultsBadge.textContent = "Mock Data Generated";
    bulkResultsBadge.className = "badge badge-purple";
  }

  // Formatting utility
  function formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // ----------------------------------------------------
  // 5. LEXICON TUNING STUDIO CONTROLLER
  // ----------------------------------------------------
  const customWordInput = document.getElementById("custom-word-input");
  const customValenceInput = document.getElementById("custom-valence-input");
  const valenceSliderValue = document.getElementById("valence-slider-value");
  const addCustomWordBtn = document.getElementById("add-custom-word-btn");
  const resetLexiconBtn = document.getElementById("reset-lexicon-btn");
  const dictSearchInput = document.getElementById("dict-search-input");
  const dictFilterSelect = document.getElementById("dict-filter-select");
  const dictTableBody = document.getElementById("dict-table-body");

  const dictPrevBtn = document.getElementById("dict-prev");
  const dictNextBtn = document.getElementById("dict-next");
  const dictPageInfo = document.getElementById("dict-page-info");

  // General Settings toggles
  const paramNegations = document.getElementById("param-negations");
  const paramIntensifiers = document.getElementById("param-intensifiers");
  const paramContrastive = document.getElementById("param-contrastive");

  customValenceInput.addEventListener("input", (e) => {
    valenceSliderValue.textContent = parseFloat(e.target.value).toFixed(1);
  });

  // Config toggles
  paramNegations.addEventListener("change", (e) => {
    configOptions.applyNegations = e.target.checked;
    runSandboxAnalysis();
  });
  paramIntensifiers.addEventListener("change", (e) => {
    configOptions.applyIntensifiers = e.target.checked;
    runSandboxAnalysis();
  });
  paramContrastive.addEventListener("change", (e) => {
    configOptions.applyContrastive = e.target.checked;
    runSandboxAnalysis();
  });

  // Search input triggers
  dictSearchInput.addEventListener("input", () => {
    lexiconTablePage = 1;
    renderLexiconBrowser();
  });

  dictFilterSelect.addEventListener("change", () => {
    lexiconTablePage = 1;
    renderLexiconBrowser();
  });

  // Save Custom Word weight override
  addCustomWordBtn.addEventListener("click", () => {
    const word = customWordInput.value.toLowerCase().trim();
    const score = parseFloat(customValenceInput.value);

    if (!word) {
      alert("Please enter a valid word or emoji.");
      return;
    }

    customLexicon[word] = score;
    customWordInput.value = "";
    customValenceInput.value = 0.0;
    valenceSliderValue.textContent = "0.0";

    renderLexiconBrowser();
    
    // Automatically re-run active sandbox analyses
    runSandboxAnalysis();
  });

  // Restore Lexicon defaults
  resetLexiconBtn.addEventListener("click", () => {
    if (confirm("Restore the default dictionary parameters? This clears custom overrides.")) {
      customLexicon = { ...window.SENTIMENT_LEXICON };
      renderLexiconBrowser();
      runSandboxAnalysis();
    }
  });

  // Browser List dictionary contents
  function renderLexiconBrowser() {
    dictTableBody.innerHTML = "";
    
    const query = dictSearchInput.value.toLowerCase().trim();
    const filter = dictFilterSelect.value;

    // Convert object keys to list
    let wordList = Object.keys(customLexicon).map(key => ({
      word: key,
      score: customLexicon[key]
    }));

    // Apply filters
    wordList = wordList.filter(item => {
      const matchSearch = item.word.includes(query);
      
      let matchFilter = true;
      if (filter === "positive") matchFilter = item.score > 0;
      else if (filter === "negative") matchFilter = item.score < 0;
      else if (filter === "emojis") {
        // Simple emoji detection regex
        matchFilter = /\p{Emoji}/u.test(item.word) && !/[a-zA-Z]/.test(item.word);
      } else if (filter === "custom") {
        // Custom is defined as words whose score in customLexicon differs from window.SENTIMENT_LEXICON, or didn't exist in window.SENTIMENT_LEXICON
        const originalVal = window.SENTIMENT_LEXICON[item.word];
        matchFilter = originalVal === undefined || originalVal !== item.score;
      }

      return matchSearch && matchFilter;
    });

    // Sort words alphabetically
    wordList.sort((a,b) => a.word.localeCompare(b.word));

    if (wordList.length === 0) {
      dictTableBody.innerHTML = `<tr><td colspan="4" class="table-placeholder">No words match the parameters.</td></tr>`;
      dictPageInfo.textContent = "Showing 0-0 of 0 words";
      dictPrevBtn.disabled = true;
      dictNextBtn.disabled = true;
      return;
    }

    const totalWords = wordList.length;
    const totalPages = Math.ceil(totalWords / LEXICON_ROWS_PER_PAGE);

    if (lexiconTablePage > totalPages) lexiconTablePage = totalPages;
    if (lexiconTablePage < 1) lexiconTablePage = 1;

    const startIdx = (lexiconTablePage - 1) * LEXICON_ROWS_PER_PAGE;
    const endIdx = Math.min(startIdx + LEXICON_ROWS_PER_PAGE, totalWords);

    const pageSlice = wordList.slice(startIdx, endIdx);

    pageSlice.forEach(item => {
      const tr = document.createElement("tr");

      let categoryBadge = `<span class="badge badge-orange">Neutral</span>`;
      if (item.score > 0.05) categoryBadge = `<span class="badge badge-emerald">Positive</span>`;
      else if (item.score < -0.05) categoryBadge = `<span class="badge badge-crimson">Negative</span>`;

      tr.innerHTML = `
        <td style="font-weight:700;">${escapeHtml(item.word)}</td>
        <td>${categoryBadge}</td>
        <td style="font-family:monospace; font-weight:700; color:${item.score > 0.05 ? 'var(--color-positive)' : (item.score < -0.05 ? 'var(--color-negative)' : 'var(--color-neutral)')};">
          ${item.score >= 0 ? '+' : ''}${item.score.toFixed(1)}
        </td>
        <td>
          <button class="btn btn-secondary btn-mini override-edit-btn" data-word="${escapeHtml(item.word)}" data-score="${item.score}">Inspect</button>
          <button class="btn btn-secondary btn-mini override-del-btn" style="color:var(--color-negative); border-color: hsla(355, 75%, 55%, 0.3);" data-word="${escapeHtml(item.word)}">Delete</button>
        </td>
      `;

      dictTableBody.appendChild(tr);
    });

    // Hook list operations
    document.querySelectorAll(".override-edit-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        customWordInput.value = btn.dataset.word;
        const score = parseFloat(btn.dataset.score);
        customValenceInput.value = score;
        valenceSliderValue.textContent = score.toFixed(1);
        customWordInput.focus();
      });
    });

    document.querySelectorAll(".override-del-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const w = btn.dataset.word;
        if (confirm(`Delete the token "${w}" from the custom lexicon overrides?`)) {
          delete customLexicon[w];
          renderLexiconBrowser();
          runSandboxAnalysis();
        }
      });
    });

    // Update pagination labels
    dictPageInfo.textContent = `Showing ${startIdx + 1}-${endIdx} of ${totalWords} words (Page ${lexiconTablePage}/${totalPages})`;
    dictPrevBtn.disabled = lexiconTablePage === 1;
    dictNextBtn.disabled = lexiconTablePage === totalPages;
  }

  // Dictionary pagination buttons
  dictPrevBtn.addEventListener("click", () => {
    if (lexiconTablePage > 1) {
      lexiconTablePage--;
      renderLexiconBrowser();
    }
  });

  dictNextBtn.addEventListener("click", () => {
    // Get total filtered count
    const query = dictSearchInput.value.toLowerCase().trim();
    const filter = dictFilterSelect.value;
    let wordList = Object.keys(customLexicon).map(key => ({ word: key, score: customLexicon[key] }));
    wordList = wordList.filter(item => {
      const matchSearch = item.word.includes(query);
      let matchFilter = true;
      if (filter === "positive") matchFilter = item.score > 0;
      else if (filter === "negative") matchFilter = item.score < 0;
      else if (filter === "emojis") matchFilter = /\p{Emoji}/u.test(item.word) && !/[a-zA-Z]/.test(item.word);
      else if (filter === "custom") {
        const originalVal = window.SENTIMENT_LEXICON[item.word];
        matchFilter = originalVal === undefined || originalVal !== item.score;
      }
      return matchSearch && matchFilter;
    });

    const totalPages = Math.ceil(wordList.length / LEXICON_ROWS_PER_PAGE);
    if (lexiconTablePage < totalPages) {
      lexiconTablePage++;
      renderLexiconBrowser();
    }
  });


  // ----------------------------------------------------
  // UTILITIES & INITS
  // ----------------------------------------------------
  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
  }

  // Pre-load active state text and analyze
  sandboxTextarea.value = "The new product release is an absolute masterpiece! Outstanding, gorgeous design and exceptionally clean performance. Love it! 😍";
  runSandboxAnalysis();

  // Draw chart in inactive stream state as backup
  initStreamChart();
});
