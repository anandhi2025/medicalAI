const axios = require('axios');

const baseURL = 'http://localhost:3000'; // Adjust if different

const examples = [
  { disease: 'lung cancer', query: 'latest treatment' },
  { disease: 'diabetes', query: 'clinical trials' },
  { disease: 'Alzheimer’s disease', query: 'top researchers' },
  { disease: 'heart disease', query: 'recent studies' }
];

async function testExample(example) {
  try {
    const response = await axios.post(`${baseURL}/ask`, {
      disease: example.disease,
      query: example.query,
      sessionId: 'test-session',
      userId: 'test-user'
    });
    console.log(`Query: "${example.query}" for "${example.disease}"`);
    console.log('AI Response:', response.data.aiResponse);
    console.log('Publications:', response.data.publications.length);
    console.log('Trials:', response.data.trials.length);
    console.log('---');
  } catch (error) {
    console.error(`Error for "${example.query}":`, error.message);
  }
}

async function runTests() {
  for (const example of examples) {
    await testExample(example);
  }
}

runTests();