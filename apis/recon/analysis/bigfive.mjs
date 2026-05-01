// Dossier Analysis — Big Five OCEAN Scoring (SCAFFOLD)
// (representative example; mbti.mjs, comm_style.mjs, handling_strategy.mjs follow this shape)
//
// Per DOSSIER_ARCHITECTURE_2026-05-01.md Section 4.1.
//
// Status: scaffold. score() returns {status: 'not_implemented'} until Phase 1
// activation. When activated, this module:
//   1. Takes a corpus of ≥30 posts (under 30 = low confidence flagged)
//   2. Batches text and runs LM Studio (local Qwen 3.5 9B) with a Big Five
//      scoring prompt drawn from the Park et al. 2015 methodology
//   3. Returns five 0-to-100 scores + per-trait confidence band + corpus stats
//
// All inference runs LOCAL. Subject's text never leaves the machine.

const MIN_CORPUS_SIZE = 30;

const TRAITS = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];

/**
 * score({ corpus, llmProvider }) → { traits: { ... }, confidence, corpusStats }
 *
 * @param {Object} args
 * @param {Array<{text: string, source: string, ts: string}>} args.corpus
 * @param {Object} args.llmProvider  LM Studio provider instance from lib/llm
 * @returns {Object}
 */
export async function score({ corpus, llmProvider }) {
  if (!Array.isArray(corpus) || corpus.length === 0) {
    return {
      status: 'no_corpus',
      error: 'No text corpus provided. Big Five scoring requires ≥30 posts for reliable inference.',
    };
  }

  const corpusStats = {
    postCount: corpus.length,
    totalChars: corpus.reduce((sum, p) => sum + (p.text?.length || 0), 0),
    sourceBreakdown: countBySource(corpus),
    timespan: computeTimespan(corpus),
  };

  const lowConfidence = corpus.length < MIN_CORPUS_SIZE;

  // Phase 0 short-circuit
  return {
    status: 'not_implemented',
    note: 'Big Five analysis scaffolded but not implemented. Phase 1 activation per DOSSIER_ARCHITECTURE_2026-05-01.md §7.1.',
    corpusStats,
    lowConfidence,
    traits: Object.fromEntries(TRAITS.map(t => [t, null])),
  };

  /* Phase 1 implementation outline:

  if (!llmProvider?.complete) {
    return { status: 'no_llm', error: 'LM Studio provider required.' };
  }

  // Batch corpus into 5K-char chunks, score each chunk, average per trait
  const chunks = chunkCorpus(corpus, 5000);
  const chunkScores = await Promise.all(chunks.map(chunk => scoreChunk(chunk, llmProvider)));

  // Aggregate
  const traits = TRAITS.reduce((acc, trait) => {
    const values = chunkScores.map(c => c[trait]).filter(v => typeof v === 'number');
    acc[trait] = {
      score: average(values),
      stddev: stddev(values),
      confidence: lowConfidence ? 0.4 : Math.max(0.5, 1 - stddev(values) / 30),
    };
    return acc;
  }, {});

  return { status: 'ok', traits, corpusStats, lowConfidence };

  */
}

function countBySource(corpus) {
  return corpus.reduce((acc, p) => {
    const src = p.source || 'unknown';
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {});
}

function computeTimespan(corpus) {
  const ts = corpus.map(p => new Date(p.ts).getTime()).filter(t => !isNaN(t));
  if (ts.length === 0) return null;
  return {
    earliest: new Date(Math.min(...ts)).toISOString(),
    latest: new Date(Math.max(...ts)).toISOString(),
  };
}
