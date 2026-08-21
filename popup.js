chrome.storage.local.get(["userApiKey"], (result) => {
  if (result.userApiKey) {
    document.getElementById("apiKeyInput").value = result.userApiKey;
  }
});

// Toggle Password Visibility
const togglePasswordBtn = document.getElementById("togglePasswordBtn");
if (togglePasswordBtn) {
  togglePasswordBtn.addEventListener("click", () => {
    const input = document.getElementById("apiKeyInput");
    if (input.type === "password") {
      input.type = "text";
      togglePasswordBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    } else {
      input.type = "password";
      togglePasswordBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    }
  });
}

document.getElementById("saveBtn").addEventListener("click", () => {
  const key = document.getElementById("apiKeyInput").value.trim();
  chrome.storage.local.set({ userApiKey: key, detectedModel: "" }, () => {
    const status = document.getElementById("status");
    status.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Saved!`;
    setTimeout(() => (status.innerText = ""), 2500);
  });
});

document.getElementById("explainBtn").addEventListener("click", async () => {
  const explainBtn = document.getElementById("explainBtn");
  const resultDiv = document.getElementById("result");

  const resetButton = () => {
    explainBtn.disabled = false;
    explainBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Solve Current Quiz`;
    explainBtn.style.opacity = "1";
    explainBtn.style.cursor = "pointer";
  };

  const showResult = (text, type = "default") => {
    resultDiv.style.display = "block";
    resultDiv.innerText = text;
    
    if (type === "error") {
      resultDiv.style.color = "#f87171";
      resultDiv.style.borderColor = "rgba(248, 113, 113, 0.4)";
      resultDiv.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
    } else if (type === "success") {
      resultDiv.style.color = "#34d399";
      resultDiv.style.borderColor = "rgba(52, 211, 153, 0.4)";
      resultDiv.style.backgroundColor = "rgba(16, 185, 129, 0.1)";
    } else {
      resultDiv.style.color = "var(--text-main)";
      resultDiv.style.borderColor = "var(--card-border)";
      resultDiv.style.backgroundColor = "rgba(15, 23, 42, 0.6)";
    }
  };

  explainBtn.disabled = true;
  explainBtn.innerHTML = `<span class="spinner"></span> Starting AI Solver...`;
  explainBtn.style.opacity = "0.75";
  explainBtn.style.cursor = "not-allowed";
  resultDiv.style.display = "none";

  try {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { action: "solveQuizDirectly" }, (response) => {
      if (chrome.runtime.lastError) {
        showResult("Please refresh the Coursera page to use the extension.", "error");
        resetButton();
        return;
      }

      showResult("AI Solver triggered! You can close this popup while it works in the background.", "success");
      resetButton();
    });
  } catch (error) {
    showResult("An unexpected error occurred.", "error");
    resetButton();
  }
});

document.getElementById("completeVideosBtn").addEventListener("click", async () => {
  const btn = document.getElementById("completeVideosBtn");
  const resultDiv = document.getElementById("result");
  
  const resetButton = () => {
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Complete Materials`;
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
  };

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Processing...`;
  btn.style.opacity = "0.75";
  btn.style.cursor = "not-allowed";
  resultDiv.style.display = "none";
  
  try {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: "completeVideos" }, (response) => {
      if (chrome.runtime.lastError) {
        resultDiv.style.display = "block";
        resultDiv.innerText = "Please wait a moment or refresh the Coursera page to use this feature.";
        resultDiv.style.color = "#f87171";
        resetButton();
        return;
      }
      if (response && response.status === "started") {
        resultDiv.style.display = "block";
        resultDiv.innerText = "Automagically completing course! Wait for completion notice on the page.";
        resultDiv.style.color = "#34d399";
      } else if (response && response.error) {
        resultDiv.style.display = "block";
        resultDiv.innerText = response.error;
        resultDiv.style.color = "#f87171";
      }
      resetButton();
    });
  } catch (e) {
    resetButton();
  }
});

document.getElementById("showQuestionsBtn").addEventListener("click", async () => {
  const resultDiv = document.getElementById("result");
  resultDiv.style.display = "block";
  resultDiv.innerText = "Extracting questions...";

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: "getSelection" }, (response) => {
    if (chrome.runtime.lastError) {
      resultDiv.innerText = "Please refresh the Coursera page to use the extension.";
      resultDiv.style.color = "#f87171";
      return;
    }
    
    if (response && response.data && response.data.length > 0) {
      resultDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid var(--card-border); padding-bottom: 8px;">
          <strong style="font-size: 11px; color: var(--text-main);">Extracted Content (${response.data.length} items):</strong>
          <button id="copyContentBtn" class="btn btn-primary" style="height: 24px; padding: 0 10px; width: auto; font-size: 11px; margin: 0;">Copy</button>
        </div>
        <div style="white-space: pre-wrap; font-size: 11px; color: var(--text-muted); user-select: all;">${JSON.stringify(response.data, null, 2)}</div>
      `;

      document.getElementById("copyContentBtn").addEventListener("click", (e) => {
        navigator.clipboard.writeText(JSON.stringify(response.data, null, 2)).then(() => {
          e.target.innerText = "Copied!";
          e.target.style.background = "var(--accent-gradient)";
          
          setTimeout(() => {
            e.target.innerText = "Copy";
            e.target.style.background = "var(--primary-gradient)";
          }, 2000);
        });
      });

    } else {
      resultDiv.innerText = "No questions found or extraction failed.";
      resultDiv.style.color = "#f87171";
    }
  });
});