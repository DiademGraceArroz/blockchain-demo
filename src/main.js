import { Blockchain } from './blockchain.js';

// Global error handler
window.onerror = function(msg, url, line, col, error) {
  console.error('Global error:', msg, url, line, error);
  alert('JavaScript Error: ' + msg + ' (line ' + line + '). Check console (F12) for details.');
};

console.log('main.js loaded');

// Initialize blockchain
const blockchain = new Blockchain();
let isInitialized = false;

// DOM Elements
const blockchainEl = document.getElementById("blockchain");
const validationIndicator = document.getElementById("validationIndicator");
const mineBtn = document.getElementById("mineBtn");
const autoMineBtn = document.getElementById("autoMineBtn");
const resetBtn = document.getElementById("resetBtn");
const blockDataInput = document.getElementById("blockData");
const difficultySelect = document.getElementById("difficulty");
const btnText = mineBtn ? mineBtn.querySelector(".btn-text") : null;
const spinner = mineBtn ? mineBtn.querySelector(".spinner") : null;

// Stats elements
const totalBlocksEl = document.getElementById("totalBlocks");
const lastMineTimeEl = document.getElementById("lastMineTime");
const avgMineTimeEl = document.getElementById("avgMineTime");
const currentDifficultyEl = document.getElementById("currentDifficulty");

console.log('DOM elements:', { mineBtn, autoMineBtn, resetBtn, blockchainEl });

// Render transaction ledger
function renderLedger() {
  const ledgerEl = document.getElementById("ledger");
  if (!ledgerEl) return;

  ledgerEl.innerHTML = "";
  const validation = blockchain.isChainValid();

  blockchain.chain.forEach((block, index) => {
    const item = document.createElement("div");
    const isTampered = !validation.valid && validation.invalidBlock === index;
    const isGenesis = index === 0;

    item.className = `ledger-item ${isGenesis ? "genesis" : ""} ${isTampered ? "tampered" : ""}`;
    item.innerHTML = `
      <span class="ledger-index">Block #${block.index}</span>
      <span class="ledger-data">${block.data}</span>
      <span class="ledger-hash">${block.hash.substring(0, 20)}...</span>
    `;
    ledgerEl.appendChild(item);
  });
}

function createBlockCard(block, index, validation) {
  const isValid = validation.valid || validation.invalidBlock !== index;
  const isTampered = !isValid;

  const card = document.createElement("div");
  card.className = `block-card ${isTampered ? "tampered" : ""}`;
  card.dataset.index = index;

  const date = new Date(block.timestamp).toLocaleString();
  const shortHash = block.hash ? (block.hash.substring(0, 15) + "...") : "calculating...";
  const shortPrevHash = block.previousHash ? (block.previousHash.substring(0, 15) + "...") : "0";

  // Check hash link validity for visual feedback
  let prevHashClass = "field-value previous-hash";
  if (index > 0) {
    const prevBlock = blockchain.chain[index - 1];
    if (block.previousHash === prevBlock.hash) {
      prevHashClass += " hash-match";
    } else {
      prevHashClass += " hash-mismatch";
    }
  }

  card.innerHTML = `
        <div class="block-header">
            <span class="block-number">Block #${block.index}</span>
            <span class="block-badge">${index === 0 ? "Genesis" : "Mined"}</span>
        </div>
        <div class="block-content">
            <div class="field">
                <span class="field-label">Timestamp</span>
                <span class="field-value">${date}</span>
            </div>
            <div class="field">
                <span class="field-label">Data</span>
                <span class="field-value editable" contenteditable="${index > 0}" data-field="data" title="Click and type to edit">${block.data}</span>
            </div>
            <div class="field">
                <span class="field-label">Previous Hash</span>
                <span class="${prevHashClass}">${shortPrevHash}</span>
            </div>
            <div class="field">
                <span class="field-label">Nonce</span>
                <span class="field-value">${block.nonce.toLocaleString()}</span>
            </div>
            <div class="field">
                <span class="field-label">Hash</span>
                <span class="field-value hash">${shortHash}</span>
            </div>
            ${
              block.miningTime > 0
                ? `
                <div class="mining-info">
                    Mined in ${block.miningTime}ms | ${block.nonce.toLocaleString()} attempts
                </div>
            `
                : ""
            }
        </div>
        ${
          index > 0
            ? `
            <div class="block-actions">
                <button class="btn-small btn-edit" onclick="tamperBlock(${index})">Edit Data</button>
                <button class="btn-small btn-mine-again" onclick="remineBlock(${index})">Re-mine Block</button>
            </div>
        `
            : ""
        }
    `;

  // Add input listener for editable fields
  const editableField = card.querySelector('[contenteditable="true"]');
  if (editableField) {
    // Track if content was edited
    let contentEdited = false;
    
    // Update data on input (silently, no re-render)
    editableField.addEventListener("input", (e) => {
      blockchain.tamperBlock(index, e.target.innerText);
      contentEdited = true;
    });
    
    // Auto re-mine when user presses Enter (fixes the tampered block)
    editableField.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault(); // Prevent new line
        if (contentEdited) {
          // Lock the field
          editableField.contentEditable = "false";
          editableField.classList.remove("editable");
          // Auto re-mine to fix the block
          await blockchain.remineBlock(index);
          renderBlockchain();
          contentEdited = false;
        }
      }
    });
    
    // Also auto re-mine on blur (clicking away)
    editableField.addEventListener("blur", async () => {
      if (contentEdited) {
        // Lock the field
        editableField.contentEditable = "false";
        editableField.classList.remove("editable");
        // Auto re-mine to fix the block
        await blockchain.remineBlock(index);
        renderBlockchain();
        contentEdited = false;
      }
    });
  }

  return card;
}

function updateValidationIndicator(validation) {
  const isValid = validation.valid;
  validationIndicator.className = `validation-indicator ${isValid ? "" : "invalid"}`;
  validationIndicator.innerHTML = `
        <span class="status-icon">${isValid ? "✓" : "✗"}</span>
        <span class="status-text">Chain ${isValid ? "Valid" : "Invalid"}</span>
    `;
}

function updateStats() {
  if (totalBlocksEl) totalBlocksEl.textContent = blockchain.chain.length;
  if (currentDifficultyEl) currentDifficultyEl.textContent = blockchain.difficulty;

  const lastTime = blockchain.miningTimes[blockchain.miningTimes.length - 1];
  if (lastMineTimeEl) lastMineTimeEl.textContent = lastTime ? `${lastTime}ms` : "-";

  const avgTime = blockchain.getAverageMiningTime();
  if (avgMineTimeEl) avgMineTimeEl.textContent = avgTime > 0 ? `${avgTime}ms` : "-";
}

// Render the blockchain
function renderBlockchain() {
  if (!blockchainEl) {
    console.error('blockchainEl not found!');
    return;
  }
  
  blockchainEl.innerHTML = "";
  const validation = blockchain.isChainValid();

  blockchain.chain.forEach((block, index) => {
    // Add link arrow (except for first block)
    if (index > 0) {
      const arrow = document.createElement("div");
      arrow.className = "link-arrow";
      arrow.innerHTML = "⬇️";
      blockchainEl.appendChild(arrow);
    }

    const blockCard = createBlockCard(block, index, validation);
    blockchainEl.appendChild(blockCard);
  });

  updateValidationIndicator(validation);
  updateStats();
  renderLedger();
}

// Initialize the app
async function init() {
  console.log('Initializing blockchain...');
  try {
    await blockchain.init();
    isInitialized = true;
    console.log('Blockchain initialized with', blockchain.chain.length, 'blocks');
    renderBlockchain();
    setupEventListeners();
  } catch (e) {
    console.error('Failed to initialize:', e);
    alert('Failed to initialize blockchain: ' + e.message);
  }
}

function setupEventListeners() {
  console.log('Setting up event listeners...');
  
  // Mining functionality
  if (mineBtn) {
    mineBtn.addEventListener("click", async () => {
      console.log('Mine button clicked!');
      if (!isInitialized) {
        alert('Blockchain not initialized yet. Please wait.');
        return;
      }
      
      const data = blockDataInput.value.trim() || "Empty Block";

      // Show loading state
      mineBtn.disabled = true;
      if (btnText) btnText.classList.add("hidden");
      if (spinner) spinner.classList.remove("hidden");

      try {
        // Mine the block
        await blockchain.addBlock(data);

        // Clear input and render
        blockDataInput.value = "";
        renderBlockchain();

        // Scroll to new block
        setTimeout(() => {
          window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        }, 100);
      } catch (e) {
        console.error('Mining failed:', e);
        alert('Mining failed: ' + e.message);
      } finally {
        // Reset button
        mineBtn.disabled = false;
        if (btnText) btnText.classList.remove("hidden");
        if (spinner) spinner.classList.add("hidden");
      }
    });
    console.log('Mine button listener attached');
  }

  // Auto mine functionality
  if (autoMineBtn) {
    autoMineBtn.addEventListener("click", async () => {
      console.log('Auto mine clicked!');
      if (!isInitialized) return;
      
      autoMineBtn.disabled = true;
      const transactions = [
        "Bob pays Charlie 5 BTC",
        "Charlie pays Dave 3 BTC",
        "Dave pays Eve 1 BTC",
        "Eve pays Frank 0.5 BTC",
        "Frank pays Grace 2 BTC",
      ];

      try {
        for (let i = 0; i < 5; i++) {
          blockDataInput.value = transactions[i] || `Auto Block ${i + 1}`;
          await blockchain.addBlock(blockDataInput.value);
          renderBlockchain();
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        blockDataInput.value = "";
        renderBlockchain();
      } catch (e) {
        console.error('Auto mine failed:', e);
      } finally {
        autoMineBtn.disabled = false;
      }
    });
    console.log('Auto mine listener attached');
  }

  // Reset functionality
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      console.log('Reset clicked!');
      if (confirm("Are you sure you want to reset the blockchain? All data will be lost.")) {
        await blockchain.reset();
        renderBlockchain();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
    console.log('Reset button listener attached');
  }

  // Difficulty selector
  if (difficultySelect) {
    difficultySelect.addEventListener("change", (e) => {
      blockchain.updateDifficulty(e.target.value);
      if (currentDifficultyEl) currentDifficultyEl.textContent = e.target.value;
    });
  }
}

// Tamper functionality (exposed to window for onclick handlers)
window.tamperBlock = function (index, newData) {
  console.log('Tampering block', index, 'with data:', newData);
  if (newData !== undefined) {
    blockchain.tamperBlock(index, newData);
  } else {
    // If no newData provided (button click), focus the editable field
    const card = document.querySelector(`.block-card[data-index="${index}"]`);
    if (card) {
      const editable = card.querySelector('[contenteditable="true"]');
      if (editable) {
        editable.focus();
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(editable);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }
  renderBlockchain();
};

// Remine functionality
window.remineBlock = async function (index) {
  console.log('Re-mining block', index);
  
  // Show loading feedback
  const card = document.querySelector(`.block-card[data-index="${index}"]`);
  if (card) {
    card.style.opacity = '0.5';
  }
  
  try {
    await blockchain.remineBlock(index);

    // Remine all subsequent blocks to fix the chain
    for (let i = index + 1; i < blockchain.chain.length; i++) {
      await blockchain.remineBlock(i);
    }
  } catch (e) {
    console.error('Re-mining failed:', e);
    alert('Re-mining failed: ' + e.message);
  } finally {
    if (card) {
      card.style.opacity = '1';
    }
    renderBlockchain();
  }
};

// Start the app
init();
