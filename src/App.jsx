import { useEffect, useMemo, useState } from 'react';
import './App.css';

const storedSessionId = localStorage.getItem('medicalSessionId');

function makeSessionId() {
  return `session-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}
const backendUrl = "https://backend-pj68.onrender.com";
function App() {
  const [sessionId, setSessionId] = useState(storedSessionId || makeSessionId());
  const [disease, setDisease] = useState('');
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [response, setResponse] = useState('');
  const [publications, setPublications] = useState([]);
  const [trials, setTrials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [finalQuery, setFinalQuery] = useState('');
  const [expandedAbstracts, setExpandedAbstracts] = useState({});
  const [expandedEligibility, setExpandedEligibility] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    if (!storedSessionId) {
      localStorage.setItem('medicalSessionId', sessionId);
    }
  }, [sessionId]);

  // Keyboard shortcuts for chat
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape' && isChatOpen) {
        setIsChatOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isChatOpen]);

 const backendUrl = useMemo(() => {
  return import.meta.env.VITE_API_URL || '';
}, []);

  const examples = [
    { text: 'Latest treatment for lung cancer', disease: 'lung cancer', query: 'latest treatment' },
    { text: 'Clinical trials for diabetes', disease: 'diabetes', query: 'clinical trials' },
    { text: "Top researchers in Alzheimer’s disease", disease: 'Alzheimer’s disease', query: 'top researchers' },
    { text: 'Recent studies on heart disease', disease: 'heart disease', query: 'recent studies' }
  ];

  const submitSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResponse('');
    setPublications([]);
    setTrials([]);
    setFinalQuery('');

    try {
      const body = {
        sessionId,
        disease: disease.trim(),
        query: query.trim(),
        location: location.trim()
      };

      const res = await fetch(`${backendUrl || ''}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Server returned ${res.status}`);
      }

      let data;
      try {
        data = await res.json();
      } catch (parseErr) {
        throw new Error('Invalid JSON response from server');
      }
      
      setResponse(data.aiResponse || 'No response generated');
      setPublications(data.publications || []);
      setTrials(data.trials || []);
      setFinalQuery(data.finalQuery || '');
    } catch (err) {
      setError(err.message || 'Unable to connect to backend');
    } finally {
      setLoading(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = { type: 'user', content: chatInput, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMessage]);
    const currentInput = chatInput;
    setChatInput('');
    setLoading(true);

    try {
      // Parse the natural language input to extract disease, query, location
      const parsed = parseNaturalLanguage(currentInput);

      const body = {
        sessionId,
        disease: parsed.disease || '',
        query: parsed.query || currentInput, // fallback to full input if no specific query
        location: parsed.location || ''
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      const res = await fetch(`${backendUrl || ''}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      let data;
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Server returned ${res.status}`);
      }

      try {
        data = await res.json();
      } catch (parseErr) {
        throw new Error('Invalid JSON response from server');
      }

      const aiMessage = {
        type: 'ai',
        content: data.aiResponse || 'No response generated',
        publications: data.publications || [],
        trials: data.trials || [],
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      const errorMessage = {
        type: 'error',
        content: err.name === 'AbortError' 
          ? 'Request timed out. The server is taking too long to respond. Please try again.'
          : (err.message || 'Unable to connect to backend'),
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const parseNaturalLanguage = (input) => {
    const lowerInput = input.toLowerCase();
    let disease = '';
    let query = input;
    let location = '';

    // Enhanced parsing for medical queries
    const diseaseKeywords = [
      'lung cancer', 'breast cancer', 'prostate cancer', 'colon cancer', 'pancreatic cancer',
      'diabetes', 'type 2 diabetes', 'type 1 diabetes', 'alzheimer', 'dementia',
      'heart disease', 'cardiovascular disease', 'stroke', 'hypertension',
      'asthma', 'copd', 'arthritis', 'rheumatoid arthritis', 'osteoarthritis',
      'depression', 'anxiety', 'parkinson', 'multiple sclerosis', 'epilepsy'
    ];

    const locationKeywords = [
      'in toronto', 'in vancouver', 'in montreal', 'in calgary', 'in edmonton',
      'in canada', 'in ontario', 'in british columbia', 'in alberta', 'in quebec',
      'in usa', 'in america', 'in new york', 'in california', 'in texas',
      'in florida', 'in illinois', 'in pennsylvania', 'in ohio'
    ];

    // Extract disease
    for (const keyword of diseaseKeywords) {
      if (lowerInput.includes(keyword)) {
        disease = keyword;
        query = input.replace(new RegExp(keyword, 'i'), '').trim();
        break;
      }
    }

    // Extract location
    for (const keyword of locationKeywords) {
      if (lowerInput.includes(keyword)) {
        location = keyword.replace('in ', '');
        query = query.replace(new RegExp(keyword, 'i'), '').trim();
        break;
      }
    }

    return { disease, query, location };
  };
console.log("Backend URL:", import.meta.env.VITE_API_URL);
  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Medical Research Assistant</p>
          <h1>Research-backed publications and clinical trials</h1>
          <p>Enter a condition, query, and optional location to retrieve publications and trials from OpenAlex, PubMed, and ClinicalTrials.gov.</p>
        </div>
      </header>

      <main className="container">
        <section className="panel">
          <form className="query-form" onSubmit={submitSearch}>
            <div className="field-group">
              <label htmlFor="disease">Disease / Condition</label>
              <input id="disease" value={disease} onChange={(e) => setDisease(e.target.value)} placeholder="e.g. lung cancer" />
            </div>
            <div className="field-group">
              <label htmlFor="query">Research Query</label>
              <input id="query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Vitamin D interaction" />
            </div>
            <div className="field-group">
              <label htmlFor="location">Location (optional)</label>
              <input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Toronto" />
            </div>
            <button type="submit" disabled={loading}>Run Research</button>
          </form>

          <div className="meta-row">
            <span>Session ID: {sessionId}</span>
            <span>{loading ? 'Searching databases and analyzing results...' : finalQuery ? `Query: ${finalQuery}` : 'Ready'}</span>
          </div>
          {error && <div className="alert">{error}</div>}
        </section>

        <section className="panel">
          <h2>Assistant Response</h2>
          <pre className="assistant-response">{response || 'Submit the form to generate an answer.'}</pre>
        </section>

        <section className="panel split">
          <div>
            <h2>
              Publications
              <span className="badge">{publications.length}</span>
            </h2>
            {publications.length === 0 ? (
              <p>No publications available yet.</p>
            ) : (
              publications.map((pub, index) => {
                const pubKey = pub.url || `${pub.title}-${index}`;
                const isExpanded = expandedAbstracts[pubKey];
                const abstractText = pub.abstract || 'No abstract available';
                const showToggle = pub.abstract && pub.abstract.length > 220;

                return (
                  <article key={pubKey} className="publication-card">
                    <div className="card-header">
                      <h3 className="pub-title">{pub.title}</h3>
                    </div>
                    <div className="card-body">
                      <div className="pub-field">
                        <span className="field-label">Authors:</span>
                        <span className="field-value">{pub.authors || 'N/A'}</span>
                      </div>
                      <div className="pub-field">
                        <span className="field-label">Year:</span>
                        <span className="field-value">{pub.year || 'N/A'}</span>
                      </div>
                      <div className="pub-field">
                        <span className="field-label">Source:</span>
                        <span className="field-value">{pub.source || 'N/A'}</span>
                      </div>
                      <div className="pub-abstract">
                        <span className="field-label">Abstract:</span>
                        <p className={`abstract-text${isExpanded ? ' expanded' : ''}`}>{abstractText}</p>
                        {showToggle && (
                          <button
                            type="button"
                            className="read-more"
                            onClick={() => setExpandedAbstracts(prev => ({
                              ...prev,
                              [pubKey]: !prev[pubKey]
                            }))}
                          >
                            {isExpanded ? 'Show less' : 'Read more'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="card-footer">
                      <a href={pub.url} target="_blank" rel="noreferrer" className="read-link">Read Full Publication →</a>
                    </div>
                  </article>
                );
              })
            )}
          </div>
          <div>
            <h2>
              Clinical Trials
              <span className="badge">{trials.length}</span>
            </h2>
            {trials.length === 0 ? (
              <p>No trials available yet.</p>
            ) : (
              trials.map((trial, index) => {
                const trialKey = trial.url || `${trial.title}-${index}`;
                const isExpanded = expandedEligibility[trialKey];
                const eligibilityText = trial.eligibility || 'Not available';
                const showToggle = trial.eligibility && trial.eligibility.length > 220;

                return (
                  <article key={trialKey} className="trial-card">
                    <div className="card-header">
                      <h3 className="trial-title">{trial.title}</h3>
                    </div>
                    <div className="card-body">
                      <div className="trial-field">
                        <span className="field-label">Status:</span>
                        <span className="field-value status-badge" data-status={trial.status?.toLowerCase()}>{trial.status || 'Unknown'}</span>
                      </div>
                      <div className="trial-field">
                        <span className="field-label">Location:</span>
                        <span className="field-value">{trial.location || 'N/A'}</span>
                      </div>
                      <div className="trial-field">
                        <span className="field-label">Contact:</span>
                        <span className="field-value">{trial.contact || 'N/A'}</span>
                      </div>
                      <div className="trial-eligibility">
                        <span className="field-label">Eligibility Criteria:</span>
                        <p className={`eligibility-text${isExpanded ? ' expanded' : ''}`}>{eligibilityText}</p>
                        {showToggle && (
                          <button
                            type="button"
                            className="read-more"
                            onClick={() => setExpandedEligibility(prev => ({
                              ...prev,
                              [trialKey]: !prev[trialKey]
                            }))}
                          >
                            {isExpanded ? 'Show less' : 'Read more'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="card-footer">
                      <a href={trial.url} target="_blank" rel="noreferrer" className="read-link">View Trial on ClinicalTrials.gov →</a>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </main>

      {/* Sticky Chat Overlay */}
      <div className={`chat-overlay ${isChatOpen ? 'open' : ''}`}>
        <div className="chat-toggle" onClick={() => setIsChatOpen(!isChatOpen)}>
          <span className="chat-icon">{isChatOpen ? '✕' : '💬'}</span>
          <span className="chat-label">{isChatOpen ? 'Close Chat' : 'Ask AI Assistant'}</span>
        </div>

        {isChatOpen && (
          <div className="chat-container">
            <div className="chat-header">
              <h3>🩺 Medical Research Assistant</h3>
              <p>Ask me anything about medical conditions, treatments, or clinical trials</p>
            </div>

            <div className="chat-messages">
              {chatMessages.length === 0 && (
                <div className="chat-welcome">
                  <p>👋 Hi! I'm your medical research assistant. I can help you find:</p>
                  <ul>
                    <li>📚 Latest research publications</li>
                    <li>🧪 Clinical trials and studies</li>
                    <li>💊 Treatment options and medications</li>
                    <li>🔬 Medical research insights</li>
                  </ul>
                  <div className="chat-examples">
                    <button onClick={() => setChatInput("Latest treatment for lung cancer")}>
                      Latest treatment for lung cancer
                    </button>
                    <button onClick={() => setChatInput("Clinical trials for diabetes")}>
                      Clinical trials for diabetes
                    </button>
                    <button onClick={() => setChatInput("Top researchers in Alzheimer's disease")}>
                      Top researchers in Alzheimer's disease
                    </button>
                    <button onClick={() => setChatInput("Recent studies on heart disease")}>
                      Recent studies on heart disease
                    </button>
                  </div>
                </div>
              )}

              {chatMessages.map((message, index) => (
                <div key={index} className={`chat-message ${message.type}`}>
                  <div className="message-avatar">
                    {message.type === 'user' ? '👤' : message.type === 'error' ? '⚠️' : '🩺'}
                  </div>
                  <div className="message-content">
                    <div className="message-text">
                      {message.type === 'user' && message.content}

                      {message.type === 'ai' && (
                        <>
                          <div className="ai-response">{message.content}</div>
                          {message.publications && message.publications.length > 0 && (
                            <div className="message-resources">
                              <h4>📚 Publications ({message.publications.length})</h4>
                              <div className="resource-list">
                                {message.publications.slice(0, 3).map((pub, idx) => (
                                  <div key={idx} className="resource-item">
                                    <h5>{pub.title}</h5>
                                    <p className="resource-meta">{pub.authors} · {pub.year}</p>
                                    <a href={pub.url} target="_blank" rel="noreferrer" className="resource-link">Read →</a>
                                  </div>
                                ))}
                                {message.publications.length > 3 && (
                                  <p className="more-results">+{message.publications.length - 3} more publications</p>
                                )}
                              </div>
                            </div>
                          )}
                          {message.trials && message.trials.length > 0 && (
                            <div className="message-resources">
                              <h4>🧪 Clinical Trials ({message.trials.length})</h4>
                              <div className="resource-list">
                                {message.trials.slice(0, 3).map((trial, idx) => (
                                  <div key={idx} className="resource-item">
                                    <h5>{trial.title}</h5>
                                    <p className="resource-meta">{trial.status} · {trial.location}</p>
                                    <a href={trial.url} target="_blank" rel="noreferrer" className="resource-link">View Trial →</a>
                                  </div>
                                ))}
                                {message.trials.length > 3 && (
                                  <p className="more-results">+{message.trials.length - 3} more trials</p>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {message.type === 'error' && <div className="error-message">{message.content}</div>}
                    </div>
                    <div className="message-time">
                      {message.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="chat-message ai loading">
                  <div className="message-avatar">🩺</div>
                  <div className="message-content">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="chat-input-area">
              <form onSubmit={(e) => { e.preventDefault(); sendChatMessage(); }}>
                <div className="chat-input-group">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about medical conditions, treatments, or clinical trials..."
                    disabled={loading}
                  />
                  <button type="submit" disabled={loading || !chatInput.trim()}>
                    {loading ? '...' : 'Send'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
