const { fetchTrials } = require('./services/trials');

async function testTrials() {
  console.log('Fetching trials for Alzheimers...');
  const trials = await fetchTrials("Alzheimer's disease", "clinical trials", 50);
  console.log(`Total trials fetched: ${trials.length}`);
  trials.slice(0, 5).forEach((t, i) => {
    console.log(`${i}: ${t.title}`);
    console.log(`   Status: ${t.status}`);
    console.log(`   URL: ${t.url}`);
    console.log(`   Location: ${t.location}`);
  });
}

testTrials().catch(console.error);
