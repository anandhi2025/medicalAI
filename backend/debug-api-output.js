const axios = require('axios');
const { fetchOpenAlex } = require('./services/openalex');
const { fetchPubMed } = require('./services/pubmed');

(async () => {
  const q = 'latest treatment lung cancer clinical trials in Toronto Canada';
  console.log('QUERY:', q);

  console.log('\n--- OPENALEX RAW ---');
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=2&page=1&sort=relevance_score:desc`;
  const raw = await axios.get(url);
  console.log(JSON.stringify(raw.data.results.map(item => ({
    title: item.title,
    hasAbstract: !!item.abstract_inverted_index,
    authorshipCount: (item.authorships || []).length,
    doi: item.doi,
    id: item.id,
    abstractIndexKeys: item.abstract_inverted_index ? Object.keys(item.abstract_inverted_index).slice(0,5) : []
  })), null, 2));

  console.log('\n--- OPENALEX NORMALIZED ---');
  const open = await fetchOpenAlex(q);
  console.log(JSON.stringify(open, null, 2));

  console.log('\n--- PUBMED NORMALIZED ---');
  const pub = await fetchPubMed(q);
  console.log(JSON.stringify(pub.slice(0,2), null, 2));
})();
