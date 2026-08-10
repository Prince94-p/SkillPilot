chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchAIExplanation") {
    // // Call our async function to get the AI response
    getAIResponse(request.text)
      .then((explanation) => sendResponse({ result: explanation }))
      .catch((error) => sendResponse({ error: error.message || "Failed to fetch from AI." }));
    // Return true to tell Chrome we will send the response asynchronously
    return true;
  }
});
async function getBestModel(API_KEY) {
  const cached = await chrome.storage.local.get(["detectedModel"]);
  if (cached.detectedModel) {
    return cached.detectedModel;
  }

  try {
    const listEndpoint = "https://generativelanguage.googleapis.com/v1beta/models";
    const res = await fetch(listEndpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY
      }
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error((errData.error && errData.error.message) ? errData.error.message : `HTTP Error ${res.status}`);
    }

    const data = await res.json();
    if (!data.models || data.models.length === 0) {
      throw new Error("No models returned from Gemini API");
    }

    const availableNames = data.models
      .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
      .map(m => m.name.replace(/^models\//, ""));

    const PREFERRED_MODELS = [
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash"
    ];

    for (const pref of PREFERRED_MODELS) {
      if (availableNames.includes(pref)) {
        await chrome.storage.local.set({ detectedModel: pref });
        return pref;
      }
    }

    const flashModel = availableNames.find(name => name.toLowerCase().includes("flash"));
    if (flashModel) {
      await chrome.storage.local.set({ detectedModel: flashModel });
      return flashModel;
    }

    if (availableNames.length > 0) {
      const fallbackModel = availableNames[0];
      await chrome.storage.local.set({ detectedModel: fallbackModel });
      return fallbackModel;
    }

    throw new Error("No model found supporting generateContent");
  } catch (error) {
    console.error("Error auto-detecting model:", error);
    return "gemini-2.5-flash"; 
  }
}

async function getAIResponse(questionsArray) {
  const storageData = await chrome.storage.local.get(["userApiKey"]);
  const API_KEY = storageData.userApiKey;

  if (!API_KEY) {
    console.error("Error: Please save your API key in the extension first!");
    return null;
  }

  const modelName = await getBestModel(API_KEY);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

  // Stringify the incoming questions array so the AI can read it
  const questionsJsonString = JSON.stringify(questionsArray, null, 2);

  // The strict prompt engineered for JSON output, now with text_input rules
  const prompt = `
You are an expert subject matter assistant. I am providing you with a JSON array of quiz questions. 
Your task is to determine the correct answer(s) for each question based on the provided options or generate a short answer if it requires text input.

INPUT FORMAT:
${questionsJsonString}

OUTPUT RULES (STRICTLY ENFORCED):
1. You must respond ONLY with a valid JSON array. Do not include any introductory text, explanations, or markdown code blocks (do not use \`\`\`json).
2. The output must be an array of objects.
3. Each object must have exactly two keys: "questionNumber" (integer) and "correctOptions" (array of strings).
4. For "single_answer" and "multiple_answer" types: The strings inside "correctOptions" MUST be exact, copy-pasted matches of the correct strings from the input "options" array.
5. For "text_input" types: Generate a concise, highly accurate, and direct answer to the question. Place this generated text as a single string inside the "correctOptions" array.
6. For "essay" types: Generate a well-thought-out, comprehensive essay response (e.g. 3-4 sentences, or fulfilling the constraints of the prompt) as requested. Place this as a single string inside the "correctOptions" array.

OUTPUT FORMAT EXAMPLE:
[
  {
    "questionNumber": 1,
    "correctOptions": ["Exact text of the correct option here"]
  },
  {
    "questionNumber": 2,
    "correctOptions": ["This is a generated concise answer for a text input question"]
  }
]

Now, evaluate the input and provide the raw JSON output.
`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API HTTP Error:", data);
      throw new Error((data.error && data.error.message) ? data.error.message : `HTTP Error ${response.status}`);
    }

    if (!data.candidates || !data.candidates[0]) {
      console.error("Gemini API missing candidates. Raw response:", data);
      throw new Error("Invalid response structure from Gemini API");
    }

    const rawText = data.candidates[0].content.parts[0].text;

    // Safety check: Strip out markdown code block syntax if the AI included it anyway
    const cleanedText = rawText
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    // Parse the string into a real JavaScript Array and return it
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("API or Parsing Error:", error);
    throw error; // Rethrow to be caught in the caller
  }
}
