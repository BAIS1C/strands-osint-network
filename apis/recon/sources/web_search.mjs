// Dossier Source — Web Search via Google Custom Search dorks
// (SCAFFOLD, representative example; rest of source adapters follow this shape)
//
// Per DOSSIER_ARCHITECTURE_2026-05-01.md Section 2.1 + OSINT_DORK_ARCHITECTURE.
//
// Status: scaffold. briefing() returns {status: 'not_implemented'} until Phase 1
// activation. When activated, this adapter:
//   1. Constructs name-targeted dorks: "FullName" + filetype:pdf, "FullName" site:.gov, etc.
//   2. Hits Google Custom Search API at /customsearch/v1
//   3. Parses results, extracts title/link/snippet/displayLink
//   4. Returns normalized { adapter, status, hits[], totalHits }
//
// Output contract (when shipped):
//   {
//     adapter: 'web_search',
//     status: 'active',
//     hits: [{ title, link, snippet, displayLink, dork }],
//     totalHits: <number>,
//     dorksRun: <number>,
//   }

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY; // shared across Maps + Custom Search
const CUSTOM_SEARCH_CX = process.env.GOOGLE_CSE_ID;     // operator must create a Programmable Search Engine

function buildDorks(subject) {
  const name = subject.name || '';
  if (!name) return [];
  const quoted = `"${name}"`;
  return [
    quoted,
    `${quoted} filetype:pdf`,
    `${quoted} site:linkedin.com/in`,
    `${quoted} site:github.com`,
    `${quoted} site:scholar.google.com`,
    `${quoted} site:medium.com`,
    `${quoted} site:substack.com`,
    `${quoted} -site:x.com -site:twitter.com -site:facebook.com -site:instagram.com`,
  ];
}

export async function briefing(subject) {
  if (!subject?.name) {
    return {
      adapter: 'web_search',
      status: 'no_subject',
      error: 'Subject name required.',
    };
  }
  if (!GOOGLE_API_KEY || !CUSTOM_SEARCH_CX) {
    return {
      adapter: 'web_search',
      status: 'no_credentials',
      error: 'Missing GOOGLE_MAPS_API_KEY or GOOGLE_CSE_ID. Create a Programmable Search Engine at programmablesearchengine.google.com.',
      hits: [],
      totalHits: 0,
    };
  }
  return {
    adapter: 'web_search',
    status: 'not_implemented',
    note: 'Web search adapter scaffolded but not implemented. Phase 1 activation per DOSSIER_ARCHITECTURE_2026-05-01.md §10.',
    dorksPlanned: buildDorks(subject),
    hits: [],
    totalHits: 0,
  };
}

if (process.argv[1]?.endsWith('web_search.mjs')) {
  const data = await briefing({ name: 'Sean Uddin' });
  console.log(JSON.stringify(data, null, 2));
}
