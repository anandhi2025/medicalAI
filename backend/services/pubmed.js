const axios = require("axios");
const xml2js = require("xml2js");

async function searchPubMed(query, retmax = 200) {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${retmax}&sort=pub+date&retmode=json`;
  const res = await axios.get(url);
  return res.data.esearchresult?.idlist || [];
}

function getText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(getText).join(" ");
  return node._ || "";
}

function parsePubmedArticle(article) {
  const medline = article.MedlineCitation?.[0];
  if (!medline) return null;

  const pmid = getText(medline.PMID?.[0]) || "";
  const articleNode = medline.Article?.[0] || {};

  const title = getText(articleNode.ArticleTitle) || "No title available";

  let abstract = "";
  const abstractNode = articleNode.Abstract?.[0];
  if (abstractNode && abstractNode.AbstractText) {
    abstract = abstractNode.AbstractText.map(getText).join(" ");
  }

  const authors = (articleNode.AuthorList?.[0]?.Author || [])
    .map(author => {
      const last = getText(author.LastName?.[0]);
      const initials = getText(author.Initials?.[0]);
      return [last, initials].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .slice(0, 10)
    .join(", ");

  let year = getText(articleNode.Journal?.[0]?.JournalIssue?.[0]?.PubDate?.[0]?.Year?.[0]) || "";
  if (!year) {
    const medlineDate = getText(articleNode.Journal?.[0]?.JournalIssue?.[0]?.PubDate?.[0]?.MedlineDate?.[0]);
    if (medlineDate) {
      year = medlineDate.slice(0, 4);
    }
  }

  return {
    title,
    abstract,
    authors,
    year,
    source: "PubMed",
    url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
  };
}

async function fetchPubMed(query) {
  const ids = await searchPubMed(query, 100);
  if (!ids.length) return [];

  const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${encodeURIComponent(ids.join(","))}&retmode=xml`;
  const res = await axios.get(efetchUrl);
  const parsed = await xml2js.parseStringPromise(res.data);
  const articles = parsed.PubmedArticleSet?.PubmedArticle || [];
  return articles
    .map(parsePubmedArticle)
    .filter(Boolean);
}

module.exports = { fetchPubMed };