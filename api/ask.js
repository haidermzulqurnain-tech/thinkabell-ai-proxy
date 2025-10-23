// api/ask.js
import { GoogleGenerativeAI } from "@google/generative-ai";

// Get secrets from environment variables (never in code!)
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const SEARCH_ENGINE_ID = process.env.SEARCH_ENGINE_ID;

// Enable CORS for your domain
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://thinkabell.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).json({});
  }

  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { question, history } = req.body;

  // Validate input
  if (!question || typeof question !== "string" || question.length > 300) {
    return res.status(400).json({ error: "Invalid question" });
  }

  try {
    // 🔍 Step 1: Search your site
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(question)}&num=2`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    let context = "No relevant content found on ThinkaBell.com.";
    if (searchData.items?.length) {
      context = searchData.items.map(item => 
        `Title: ${item.title}\nURL: ${item.link}\nSnippet: ${item.snippet}`
      ).join('\n\n---\n\n');
    }

    // 💬 Step 2: Generate answer with Gemini
    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    });

    const prompt = `You are the official AI assistant for ThinkaBell.com. 
Answer using ONLY the context below. If unsure, say: "I couldn't find specific information about that on ThinkaBell.com."

Context:
${context}

User Question: ${question}

Answer in 1–3 concise, professional sentences.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const answer = response.text().trim() || "I couldn't generate a response.";

    // ✅ Success
    res.status(200).json({ answer });
    
  } catch (error) {
    console.error("Proxy Error:", error);
    res.status(500).json({ error: "Failed to generate response" });
  }
}

// Vercel config
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};
