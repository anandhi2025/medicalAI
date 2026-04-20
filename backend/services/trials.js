const axios = require("axios");

function simplifyLocation(locations) {
  if (!Array.isArray(locations) || !locations.length) return "N/A";
  const places = locations
    .slice(0, 3)
    .map(loc => [loc.city, loc.state, loc.country].filter(Boolean).join(", "))
    .filter(Boolean);
  return places.join("; ") || "N/A";
}

function buildContact(protocol) {
  const contact = protocol.contactsLocationsModule?.overallContact || {};
  const name = contact.contactName || "";
  const phone = contact.phone || "";
  const email = contact.email || "";
  const parts = [name, phone, email].filter(Boolean);
  return {
    contactName: name || "N/A",
    contactPhone: phone || "N/A",
    contactEmail: email || "N/A",
    contact: parts.length ? parts.join(" | ") : "N/A"
  };
}

function normalizeText(text) {
  return (text || "").toString().toLowerCase();
}

async function fetchTrialsPage(disease, query, pageSize = 50) {
  const searchText = [disease, query].filter(Boolean).join(" ");
  const encodedTerm = encodeURIComponent(searchText);
  const searchParams = [`query.term=${encodedTerm}`];
  searchParams.push(`pageSize=${pageSize}`);
  searchParams.push(`format=json`);

  const url = `https://clinicaltrials.gov/api/v2/studies?${searchParams.join("&")}`;
  const res = await axios.get(url);
  return Array.isArray(res.data.studies) ? res.data.studies : [];
}

async function fetchTrials(disease, query = "", pageSize = 100) {
  let allStudies = [];

  try {
    allStudies = await fetchTrialsPage(disease, query, pageSize);
  } catch (error) {
    console.error("ClinicalTrials.gov fetch failed:", error.message);
  }

  const seen = new Set();
  return allStudies
    .map(study => {
      const protocol = study.protocolSection || {};
      const title = protocol.identificationModule?.briefTitle || "No title available";
      const statusText = protocol.statusModule?.overallStatus || "UNKNOWN";
      const eligibility = protocol.eligibilityModule?.eligibilityCriteria?.textBlock || "Not available";
      const location = simplifyLocation(protocol.contactsLocationsModule?.locations);
      const contactFields = buildContact(protocol);
      const nctId = protocol.identificationModule?.nctId || "";
      const url = nctId ? `https://clinicaltrials.gov/study/${nctId}` : "";
      const key = `${normalizeText(title)}|${url}`;

      return {
        title,
        status: statusText,
        eligibility,
        location,
        ...contactFields,
        source: "ClinicalTrials.gov",
        url,
        query,
        key
      };
    })
    .filter(trial => {
      if (!trial.title || !trial.status || !trial.url) return false;
      if (seen.has(trial.key)) return false;
      seen.add(trial.key);
      return true;
    });
}

module.exports = { fetchTrials };