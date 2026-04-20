const express = require("express");
const router = express.Router();
const Chat = require("../models/Chat");
const { fetchOpenAlex } = require("../services/openalex");
const { fetchPubMed } = require("../services/pubmed");
const { fetchTrials } = require("../services/trials");
const { askLLM } = require("../services/llm");

function buildSmartQuery(disease, query, location = "") {
  const parts = [query, disease, "latest research", "clinical trials"];
  if (location) parts.push(`in ${location}`);
  return parts.filter(Boolean).join(" ");
}

function buildPersonalizationInstructions(disease, location = "") {
  if (!disease) {
    return "Answer in a health companion tone, adapt to the user's medical concern, and avoid generic statements.";
  }
  let note = `The user is asking about ${disease}. `;
  if (location) {
    note += `Consider the user's location: ${location}. `;
  }
  note += `Frame insights specifically for patients with ${disease}, using phrases like 'Based on studies in ${disease} patients...' or 'For people living with ${disease}...'.`;
  return note;
}

function normalizeText(text) {
  return (text || "").toString().toLowerCase();
}

function countMatches(text, terms) {
  const lower = normalizeText(text);
  return terms.reduce((count, term) => {
    if (!term) return count;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "g");
    const matches = lower.match(regex);
    return count + (matches ? matches.length : 0);
  }, 0);
}

function filterPublications(publications) {
  const seen = new Set();
  return publications.filter(pub => {
    if (!pub.title || !pub.url) return false;
    if (!pub.abstract || pub.abstract.trim().length < 20) return false;
    const key = normalizeText(pub.title).slice(0, 120) + "|" + normalizeText(pub.url).slice(-50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scorePublication(pub, queryTerms) {
  let score = 0;
  score += pub.relevance_score || 0;

  if (pub.abstract && pub.abstract.length > 120) score += 22;
  else if (pub.abstract && pub.abstract.length > 60) score += 10;
  if (pub.authors) score += 14;

  score += pub.source === "PubMed" ? 18 : 12;

  const titleMatches = countMatches(pub.title, queryTerms);
  const abstractMatches = countMatches(pub.abstract, queryTerms);
  score += titleMatches * 30;
  score += abstractMatches * 8;

  const year = parseInt(pub.year) || 0;
  const currentYear = new Date().getFullYear();
  if (year >= currentYear - 1) score += 24;
  else if (year >= currentYear - 3) score += 16;
  else if (year >= currentYear - 6) score += 8;
  else score += 2;

  return score;
}

function rankPublications(publications, query) {
  const queryTerms = normalizeText(query)
    .split(/\W+/)
    .filter(Boolean)
    .slice(0, 12);

  return filterPublications(publications)
    .map(pub => ({
      ...pub,
      score: scorePublication(pub, queryTerms)
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const yearA = parseInt(a.year) || 0;
      const yearB = parseInt(b.year) || 0;
      if (yearA !== yearB) return yearB - yearA;
      return (b.relevance_score || 0) - (a.relevance_score || 0);
    })
    .map(pub => {
      const { score, ...rest } = pub;
      return rest;
    });
}

function filterTrials(trials) {
  const seen = new Set();
  return trials.filter(trial => {
    if (!trial.title || !trial.status || !trial.url) return false;
    const key = `${normalizeText(trial.title).slice(0, 120)}|${normalizeText(trial.location)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scoreTrial(trial, queryTerms) {
  let score = 0;
  const status = (trial.status || "").toUpperCase();

  if (status === "RECRUITING") score += 40;
  else if (status === "ACTIVE") score += 26;
  else if (status === "COMPLETED") score += 12;
  else score += 4;

  if (trial.eligibility && trial.eligibility.length > 120) score += 18;
  else if (trial.eligibility && trial.eligibility.length > 60) score += 10;
  if (trial.location && trial.location !== "N/A") score += 12;
  if (trial.contact && trial.contact !== "N/A") score += 8;

  const titleMatches = countMatches(trial.title, queryTerms);
  const eligibilityMatches = countMatches(trial.eligibility, queryTerms);
  score += titleMatches * 28;
  score += eligibilityMatches * 8;

  const locationMatches = queryTerms.reduce((sum, term) => {
    return sum + (trial.location?.toLowerCase().includes(term) ? 1 : 0);
  }, 0);
  score += locationMatches * 8;

  score += trial.source === "ClinicalTrials.gov" ? 18 : 0;

  return score;
}

function rankTrials(trials, query) {
  const queryTerms = normalizeText(query)
    .split(/\W+/)
    .filter(Boolean)
    .slice(0, 14);

  return filterTrials(trials)
    .map(trial => ({
      ...trial,
      score: scoreTrial(trial, queryTerms)
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const statusOrder = { RECRUITING: 1, ACTIVE: 2, COMPLETED: 3, UNKNOWN: 4 };
      const orderA = statusOrder[a.status?.toUpperCase()] || 5;
      const orderB = statusOrder[b.status?.toUpperCase()] || 5;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title);
    })
    .map(({ score, ...rest }) => rest);
}

router.post("/", async (req, res) => {
  const requestStartTime = Date.now();
  try {
    const { disease, query, location, sessionId, userId } = req.body;
    const finalSessionId = sessionId || "demo-session";
    const finalUserId = userId || "demo-user";
    const rawQuery = (query || "").trim();
    let currentDisease = (disease || "").trim();
    const currentLocation = (location || "").trim();

    const previousContext = await Chat.findOne({ sessionId: finalSessionId }).sort({ createdAt: -1 }).lean();
    if (!currentDisease && previousContext?.disease) {
      currentDisease = previousContext.disease;
    }

    const finalQuery = buildSmartQuery(currentDisease, rawQuery, currentLocation);
    console.log(`🔍 Searching for: "${finalQuery}"`);

    // Run API calls in parallel for better performance
    const startTime = Date.now();
    const [openalexResult, pubmedResult, trialsResult] = await Promise.allSettled([
      fetchOpenAlex(finalQuery).catch(err => { console.error("OpenAlex failed:", err.message); return []; }),
      fetchPubMed(finalQuery).catch(err => { console.error("PubMed failed:", err.message); return []; }),
      fetchTrials(currentDisease, rawQuery, 25).catch(err => { console.error("Trials failed:", err.message); return []; }) // Reduced to 25 trials
    ]);

    const openalex = openalexResult.status === 'fulfilled' ? openalexResult.value : [];
    const pubmed = pubmedResult.status === 'fulfilled' ? pubmedResult.value : [];
    const trials = trialsResult.status === 'fulfilled' ? trialsResult.value : [];

    console.log(`📊 API calls completed in ${Date.now() - startTime}ms`);
    console.log(`📚 Publications: OpenAlex(${openalex.length}) + PubMed(${pubmed.length})`);
    console.log(`🧪 Trials: ${trials.length}`);

    const publications = [...openalex, ...pubmed];
    const candidatePublications = rankPublications(publications, finalQuery).map(pub => ({
      title: pub.title || "",
      abstract: pub.abstract || "",
      authors: pub.authors || "",
      year: pub.year || "",
      source: pub.source || "",
      url: pub.url || ""
    }));
    const displayPublications = candidatePublications.slice(0, 8);
    const candidateTrials = rankTrials(trials, finalQuery).map(trial => ({
      title: trial.title || "",
      status: trial.status || "",
      eligibility: trial.eligibility || "",
      location: trial.location || "",
      contactName: trial.contactName || "",
      contactPhone: trial.contactPhone || "",
      contactEmail: trial.contactEmail || "",
      contact: trial.contact || "",
      source: trial.source || "",
      url: trial.url || ""
    }));
    const displayTrials = candidateTrials.slice(0, 8);

    console.log(`\n=== RESPONSE DEBUG ===`);
    console.log(`Candidate Trials: ${candidateTrials.length}`);
    console.log(`Display Trials: ${displayTrials.length}`);
    displayTrials.forEach((t, i) => {
      console.log(`  ${i}: ${t.title.slice(0, 40)}... | ${t.status}`);
    });

    const previousFragment = previousContext
      ? `Previous context: ${previousContext.disease} - ${previousContext.query}\n`
      : "";

    const personalizationInstructions = buildPersonalizationInstructions(currentDisease, currentLocation);

    // Simplified and shorter prompt for faster LLM response
    const prompt = `You are a medical research assistant. Answer based ONLY on provided data.

Condition: ${currentDisease}
Query: ${rawQuery}
${personalizationInstructions}

Publications (${displayPublications.length} found):
${displayPublications.slice(0, 2).map(p => `- ${p.title} (${p.year})`).join('\n')}

Clinical Trials (${displayTrials.length} found):
${displayTrials.slice(0, 2).map(t => `- ${t.title} (${t.status})`).join('\n')}

Provide a brief answer in 2 sections:
1. Research Summary
2. Available Resources

Keep under 150 words.`;

    console.log(`🤖 Calling LLM with ${prompt.length} char prompt`);
    const llmStartTime = Date.now();
    let aiResponse;
    try {
      aiResponse = await askLLM(prompt);
      console.log(`✅ LLM completed in ${Date.now() - llmStartTime}ms`);
    } catch (llmError) {
      console.log(`❌ LLM failed after ${Date.now() - llmStartTime}ms: ${llmError.message}`);
      // Provide instant fallback response
      aiResponse = `Research Summary:
Based on available data for ${currentDisease || 'your query'}, here are key findings from ${displayPublications.length} publications and ${displayTrials.length} clinical trials.

Available Resources:
${displayPublications.length > 0 ? `📚 ${displayPublications.length} publications found` : 'No publications found'}
${displayTrials.length > 0 ? `🧪 ${displayTrials.length} clinical trials found` : 'No clinical trials found'}

For more detailed analysis, please try again in a moment.`;
    }
    let cleanedResponse = (aiResponse || "").replace("Respond ONLY in English.", "").trim();

    if (cleanedResponse === "LLM failed, showing raw data.") {
      cleanedResponse = `Condition Overview:
The condition is ${currentDisease}. The user is asking about ${rawQuery}.

Research Insights:
Based on available publications, here are key findings. (Note: LLM is unavailable, showing summary of data.)

Clinical Trials:
${displayTrials.length > 0 ? `Found ${displayTrials.length} relevant trials.` : 'No relevant clinical trials found.'}

Source Attribution:
Publications: ${displayPublications.map(p => p.title).join(', ')}
Trials: ${displayTrials.map(t => t.title).join(', ')}
`;
    }

    await Chat.create({
      sessionId: finalSessionId,
      userId: finalUserId,
      disease: currentDisease,
      query: rawQuery,
      response: cleanedResponse,
      publicationsCount: candidatePublications.length,
      trialsCount: candidateTrials.length
    });

    console.log(`✅ Total response time: ${Date.now() - requestStartTime}ms`);
    res.json({
      finalQuery,
      allPublications: candidatePublications,
      publications: displayPublications,
      allTrials: candidateTrials,
      trials: displayTrials,
      aiResponse: cleanedResponse
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error processing request" });
  }
});

module.exports = router;
