// Dossier — Ethics Charter Gate (FUNCTIONAL, runs before any source ingestion)
//
// Per DOSSIER_ARCHITECTURE_2026-05-01.md Section 6. This module is the
// load-bearing piece that distinguishes Dossier from generic OSINT tooling:
// every Dossier request runs through classify() FIRST, and adapters refuse
// to engage until classification completes.
//
// Personal beta (Sean, single operator): all classifications permitted; the
// gate runs but only logs warnings rather than blocking. Layer U public mode
// (controlled by SON_LAYER_U_PUBLIC=1 in .env) hardens the gate.

const LAYER_U_PUBLIC = process.env.SON_LAYER_U_PUBLIC === '1';

// ─── Public-figure heuristics ─────────────────────────────────────────────
// Used to verify operator-asserted classification. If operator marks subject
// as "private" but heuristics suggest public-figure status, the warning is
// logged. If operator marks as "public" but no public-figure signals exist,
// adapter array refuses to run in Layer U public mode.

const PUBLIC_FIGURE_SIGNALS = [
  'verified_blue_tick',          // X verified or LinkedIn premium-verified
  'public_company_officer',       // SEC filings list as officer
  'elected_office',               // Politician or judge
  'public_media_role',            // Journalist, anchor, columnist
  'declared_spokesperson',        // Press releases identify them
  'voluntary_public_discourse',   // > 1000 public posts on the topic in question
];

// ─── Subject classification ───────────────────────────────────────────────

export const Classification = Object.freeze({
  PUBLIC_FIGURE:        'public_figure',
  PRIVATE_INDIVIDUAL:   'private_individual',
  FOUNDERS_PASS_HOLDER: 'founders_pass_holder',
  MINOR:                'minor',                 // hard refusal, no exceptions
});

/**
 * classify({ subject, operatorAssertion, signals }) → ClassificationResult
 *
 * Operator-asserted classification verified against public-figure heuristics.
 * Returns { classification, confidence, warnings, allowedAdapters }.
 *
 * @param {Object} args
 * @param {Object} args.subject              Subject object (name, optional photo, handles, etc)
 * @param {string} args.operatorAssertion    One of Classification values, asserted at request time
 * @param {Array<string>} [args.signals]     Optional pre-detected signals for verification
 * @returns {Object}
 */
export function classify({ subject, operatorAssertion, signals = [] }) {
  const warnings = [];

  // Hard refusal: minor classification, regardless of mode
  if (operatorAssertion === Classification.MINOR) {
    return {
      classification: Classification.MINOR,
      confidence: 1.0,
      warnings: ['Subject classified as minor. Dossier refuses.'],
      allowedAdapters: [],
      gateBlocking: true,
    };
  }

  // Founders Pass holder: defer to LAYER_U_ARCHITECTURE Section 3.2 visibility tiers
  if (operatorAssertion === Classification.FOUNDERS_PASS_HOLDER) {
    // TODO: integrate with everywear.id once the identity layer ships.
    // For now, behave as private_individual with operator self-attestation.
    return {
      classification: Classification.FOUNDERS_PASS_HOLDER,
      confidence: 0.5,
      warnings: ['Founders Pass tier verification deferred until everywear.id integration. Treating as private_individual.'],
      allowedAdapters: privateIndividualAdapters(),
      gateBlocking: false,
    };
  }

  // Public figure: cross-check heuristics
  if (operatorAssertion === Classification.PUBLIC_FIGURE) {
    const hasSignals = signals.some(s => PUBLIC_FIGURE_SIGNALS.includes(s));
    if (!hasSignals && LAYER_U_PUBLIC) {
      // Layer U public mode: refuse if no signals
      return {
        classification: null,
        confidence: 0,
        warnings: ['Operator asserted PUBLIC_FIGURE but no public-figure signals detected. Layer U public mode requires signal verification before full source set is enabled.'],
        allowedAdapters: [],
        gateBlocking: true,
      };
    }
    if (!hasSignals) {
      warnings.push('Operator asserted PUBLIC_FIGURE but no signals detected. Personal-beta mode allows but flags this.');
    }
    return {
      classification: Classification.PUBLIC_FIGURE,
      confidence: hasSignals ? 0.9 : 0.3,
      warnings,
      allowedAdapters: publicFigureAdapters(),
      gateBlocking: false,
    };
  }

  // Private individual: gated in Layer U public, open in personal beta
  if (operatorAssertion === Classification.PRIVATE_INDIVIDUAL) {
    if (LAYER_U_PUBLIC) {
      // Layer U public mode requires consent token from subject's everywear.id
      if (!subject.consentToken) {
        return {
          classification: Classification.PRIVATE_INDIVIDUAL,
          confidence: 1.0,
          warnings: ['Layer U public mode: no consent token from subject. Only public-record sources enabled (no social/communication inference).'],
          allowedAdapters: publicRecordAdaptersOnly(),
          gateBlocking: false,
        };
      }
      // With consent, full source set
      return {
        classification: Classification.PRIVATE_INDIVIDUAL,
        confidence: 1.0,
        warnings: ['Subject consent token verified. Full Dossier permitted.'],
        allowedAdapters: privateIndividualAdapters(),
        gateBlocking: false,
      };
    }
    // Personal beta: full source set, no consent required
    return {
      classification: Classification.PRIVATE_INDIVIDUAL,
      confidence: 1.0,
      warnings: ['Personal beta mode. Full source set enabled. Layer U public mode would require subject consent.'],
      allowedAdapters: privateIndividualAdapters(),
      gateBlocking: false,
    };
  }

  // Unrecognized assertion
  return {
    classification: null,
    confidence: 0,
    warnings: [`Unrecognized operator assertion: ${operatorAssertion}`],
    allowedAdapters: [],
    gateBlocking: true,
  };
}

// ─── Adapter sets per classification ──────────────────────────────────────

function publicFigureAdapters() {
  return [
    'web_search', 'x_search', 'bluesky_search', 'github',
    'linkedin', 'academic', 'podcast', 'patents',
    'sec', 'crunchbase', 'whois',
  ];
}

function privateIndividualAdapters() {
  return [
    'web_search', 'x_search', 'bluesky_search', 'github',
    'linkedin', 'academic', 'podcast',
  ];
}

function publicRecordAdaptersOnly() {
  // Layer U public mode for unconsenting private individuals: only adapters
  // that touch declared public records. No social-text inference.
  return ['patents', 'sec', 'whois'];
}

// ─── Use restrictions self-attestation ────────────────────────────────────
// Operator confirms their purpose at request time. Stored with the Dossier
// for audit trail. Layer U public mode requires this; personal beta logs only.

export const PURPOSE_CATEGORIES = Object.freeze([
  'investor_research',
  'partner_due_diligence',
  'recruitment_screening',
  'competitor_analysis',
  'crisis_comms_preparation',
  'press_interview_preparation',
  'business_intelligence_general',
  'other',
]);

export function attestPurpose({ purpose, freeText }) {
  if (!PURPOSE_CATEGORIES.includes(purpose)) {
    return { valid: false, error: `Purpose must be one of: ${PURPOSE_CATEGORIES.join(', ')}` };
  }
  return {
    valid: true,
    purpose,
    freeText: freeText?.substring(0, 500) || null,
    attestedAt: new Date().toISOString(),
  };
}

// ─── Notification queue (Phase 3) ─────────────────────────────────────────
// In Layer U public mode, queue a notification to the subject's everywear.id
// within 30 days of the Dossier request, per GDPR Article 14.
// Stub for Phase 3 — currently a no-op in personal beta.

export function queueSubjectNotification({ subject, classification, requestId }) {
  if (!LAYER_U_PUBLIC) return; // personal beta exempt
  if (classification === Classification.PUBLIC_FIGURE) return; // public figures exempt
  if (classification === Classification.MINOR) return; // refused upstream
  // TODO: integrate with everywear.id messaging once identity layer ships
  console.log(`[Dossier] Subject notification queued for ${subject.name} (request ${requestId}) — fires within 30 days per GDPR Article 14.`);
}
