// const axios = require("axios");

// function buildAbstract(abstractIndex) {
//   if (!abstractIndex || typeof abstractIndex !== "object") return "";
//   const positions = [];
//   for (const [word, idxs] of Object.entries(abstractIndex)) {
//     for (const idx of idxs) {
//       positions[idx] = word;
//     }
//   }
//   return positions.filter(Boolean).join(" ");
// }

// function normalizeOpenAlex(item) {
//   const authors = (item.authorships || [])
//     .map(a => a.author?.display_name)
//     .filter(Boolean)
//     .slice(0, 8)
//     .join(", ");

//   const url = item.doi ? `https://doi.org/${item.doi}` : item.id;

//   return {
//     title: item.title || "Unknown title",
//     abstract: item.abstract_inverted_index ? buildAbstract(item.abstract_inverted_index) : "",
//     authors,
//     year: item.publication_year || "",
//     source: "OpenAlex",
//     url
//   };
// }

// async function fetchOpenAlex(query, perPage = 100) {
//   const encodedQuery = encodeURIComponent(query);
//   const url = `https://api.openalex.org/works?search=${encodedQuery}&per-page=${perPage}&page=1&sort=relevance_score:desc`;
//   const res = await axios.get(url);
//   const results = Array.isArray(res.data.results) ? res.data.results : [];
//   return results.map(normalizeOpenAlex);
// }

// module.exports = { fetchOpenAlex };

const axios = require("axios");

function buildAbstract(abstractIndex) {
  if (!abstractIndex || typeof abstractIndex !== "object") return "";
  const words = [];
  Object.entries(abstractIndex).forEach(([word, positions]) => {
    positions.forEach(pos => {
      words[pos] = word;
    });
  });
  return words.filter(Boolean).join(" ");
}

function buildAuthors(authorships) {
  return (authorships || [])
    .map(a => a.author?.display_name)
    .filter(Boolean)
    .slice(0, 15)
    .join(", ");
}

function normalizeOpenAlex(item) {
  return {
    title: item.title || "",
    abstract: buildAbstract(item.abstract_inverted_index) || "",
    authors: buildAuthors(item.authorships),
    year: item.publication_year || 0,
    source: "OpenAlex",
    url: item.id || "",
    relevance_score: item.relevance_score || 0
  };
}

exports.fetchOpenAlex = async (query, perPage = 100) => {
  const encodedQuery = encodeURIComponent(query);
  const baseUrl = `https://api.openalex.org/works?search=${encodedQuery}&per-page=${perPage}&sort=relevance_score:desc`;
  const requests = [1, 2].map(page => axios.get(`${baseUrl}&page=${page}`));
  const responses = await Promise.allSettled(requests);
  const results = responses.flatMap(r => {
    if (r.status === "fulfilled" && Array.isArray(r.value.data.results)) {
      return r.value.data.results;
    }
    return [];
  });
  const seen = new Set();
  return results
    .map(normalizeOpenAlex)
    .filter(pub => {
      if (!pub.title || !pub.url) return false;
      const key = pub.url || pub.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};