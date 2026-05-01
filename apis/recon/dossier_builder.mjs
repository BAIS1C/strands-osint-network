// Dossier — Orchestrator (SCAFFOLD, Phase 0)
//
// Per DOSSIER_ARCHITECTURE_2026-05-01.md Section 2.3.
// Composes a Person Recon dossier from source ingestion + analysis layers.
//
// Status: scaffold. build() returns {status: 'not_implemented'} until Phase 1
// activation per architecture doc Section 10.
//
// Flow when activated:
//   1. classify subject via ethics.mjs (gates everything)
//   2. attestPurpose by operator (audit trail)
//   3. fan out source adapters per allowedAdapters set
//   4. analysis layer: identity_resolution → bigfive → mbti → comm_style
//      → network → timeline → red_flags
//   5. handling_strategy.compose(profile, operatorGoal)
//   6. dossier_builder assembles the final report
//   7. queueSubjectNotification (Layer U public mode only)
//   8. Return composed dossier with all source citations preserved

import { classify, attestPurpose, queueSubjectNotification, Classification } from './ethics.mjs';
import { randomUUID } from 'crypto';

// ─── Source adapter registry ──────────────────────────────────────────────
// Adapters scaffolded in apis/recon/sources/ get registered here as they ship.
// Phase 0 ships web_search as the representative example; rest follow in Phase 1.

async function ingestFromAdapter(name, subject) {
  try {
    // Dynamic import means missing adapters fail soft instead of crashing the build.
    const mod = await import(`./sources/${name}.mjs`).catch(() => null);
    if (!mod || typeof mod.briefing !== 'function') {
      return { adapter: name, status: 'not_scaffolded', data: null };
    }
    const data = await mod.briefing(subject);
    return { adapter: name, status: 'ok', data };
  } catch (e) {
    return { adapter: name, status: 'error', error: e.message };
  }
}

// ─── Analysis pipeline ────────────────────────────────────────────────────

async function runAnalysis(corpus) {
  // Phase 0: stubbed. Phase 1 wires the analysis modules in apis/recon/analysis/.
  return {
    bigfive: null,
    mbti: null,
    commStyle: null,
    network: null,
    timeline: null,
    redFlags: null,
    note: 'Analysis pipeline not yet implemented. Phase 1 activates per DOSSIER_ARCHITECTURE_2026-05-01.md Section 7.1.',
  };
}

// ─── Public entry point ───────────────────────────────────────────────────

/**
 * build({ subject, operatorAssertion, purpose, goal, signals })
 *
 * Compose a Dossier on the subject. Runs ethics gate, source ingestion,
 * analysis pipeline, handling strategy generator. Returns a structured
 * dossier object or an error explaining why classification refused.
 *
 * @param {Object} args
 * @param {Object} args.subject              {name, photoUrl?, knownHandles?, email?, ...}
 * @param {string} args.operatorAssertion    one of Classification values
 * @param {string} args.purpose              one of PURPOSE_CATEGORIES
 * @param {string} args.goal                 free-text operator goal for handling strategy
 * @param {Array<string>} [args.signals]     pre-detected public-figure signals
 */
export async function build({ subject, operatorAssertion, purpose, goal, signals = [] }) {
  const requestId = randomUUID();
  const startedAt = new Date().toISOString();

  // Step 1: ethics gate
  const gate = classify({ subject, operatorAssertion, signals });
  if (gate.gateBlocking) {
    return {
      requestId,
      status: 'refused',
      reason: 'Ethics gate blocking',
      warnings: gate.warnings,
      classification: gate.classification,
    };
  }

  // Step 2: purpose attestation
  const attest = attestPurpose({ purpose });
  if (!attest.valid) {
    return {
      requestId,
      status: 'refused',
      reason: attest.error,
    };
  }

  // Phase 0 short-circuit — return structure but no real ingestion
  return {
    requestId,
    status: 'not_implemented',
    note: 'Dossier orchestrator scaffolded but not implemented. See DOSSIER_ARCHITECTURE_2026-05-01.md §10 for activation criteria.',
    startedAt,
    subject,
    classification: gate.classification,
    confidence: gate.confidence,
    warnings: gate.warnings,
    allowedAdapters: gate.allowedAdapters,
    purpose: attest.purpose,
    goal,
  };

  /* When Phase 1 activates, the implementation looks like this:

  // Step 3: parallel source ingestion across allowed adapters
  const ingestions = await Promise.allSettled(
    gate.allowedAdapters.map(name => ingestFromAdapter(name, subject))
  );
  const sources = ingestions.map(i => i.status === 'fulfilled' ? i.value : { status: 'error', error: i.reason?.message });

  // Step 4: build a unified text corpus for personality analysis
  const corpus = buildCorpusFromSources(sources);

  // Step 5: analysis pipeline
  const analysis = await runAnalysis(corpus);

  // Step 6: handling strategy
  const strategy = await composeHandlingStrategy({ profile: analysis, goal });

  // Step 7: subject notification (Layer U public only)
  queueSubjectNotification({ subject, classification: gate.classification, requestId });

  // Step 8: assemble dossier
  return {
    requestId,
    status: 'ok',
    startedAt,
    completedAt: new Date().toISOString(),
    subject,
    classification: gate.classification,
    purpose: attest.purpose,
    goal,
    sections: {
      identity: identityResolution(sources),
      professional: extractProfessional(sources),
      education: extractEducation(sources),
      publicComms: synthesizeComms(sources),
      contributions: extractContributions(sources),
      network: analysis.network,
      financial: extractFinancial(sources),
      personality: { bigfive: analysis.bigfive, mbti: analysis.mbti },
      commStyle: analysis.commStyle,
      handlingStrategy: strategy,
      redFlags: analysis.redFlags,
      sources,
    },
  };

  */
}
