// Pure-function editorial grader for the eval bench.
// Imported by both scripts/eval-editorial-quality.mjs and tests/unit/eval-editorial-grader.test.ts.
//
// Contract: see specs/006-editorial-quality-evaluation/contracts/grading-grid.md.
// No filesystem access, no clock, no network. Same input, same output.

const SENTENCE_BOUNDARY = /[.!?]/;
const EXCERPT_LIMIT = 200;

function normalizeSkillOutput(output) {
  if (!output || typeof output !== "object") {
    return { headline: "", body: "" };
  }
  if (output.status === "failed") {
    return { headline: "", body: "" };
  }

  const data = output.data ?? {};

  if (data.editedDraft && typeof data.editedDraft === "object") {
    return {
      headline: String(data.editedDraft.headline ?? ""),
      body: String(data.editedDraft.bodyMarkdown ?? "")
    };
  }
  if (data.draft && typeof data.draft === "object") {
    return {
      headline: String(data.draft.headline ?? ""),
      body: String(data.draft.bodyMarkdown ?? "")
    };
  }
  return { headline: "", body: "" };
}

function firstSentence(body) {
  const idx = body.search(SENTENCE_BOUNDARY);
  if (idx === -1) return body;
  return body.slice(0, idx + 1);
}

function firstTwoSentences(body) {
  let consumed = 0;
  let count = 0;
  while (count < 2) {
    const slice = body.slice(consumed);
    const idx = slice.search(SENTENCE_BOUNDARY);
    if (idx === -1) {
      consumed = body.length;
      break;
    }
    consumed += idx + 1;
    count += 1;
  }
  return body.slice(0, consumed);
}

function containsAnyKeyword(haystack, keywords) {
  const lower = haystack.toLowerCase();
  for (const keyword of keywords) {
    if (lower.includes(String(keyword).toLowerCase())) {
      return true;
    }
  }
  return false;
}

function matchesNumber(haystack, regex) {
  const fresh = new RegExp(regex.source, regex.flags);
  return fresh.test(haystack);
}

function hasConcreteElement(body, doctrine) {
  if (matchesNumber(body, doctrine.concreteHeuristics.numberRegex)) return true;
  if (containsAnyKeyword(body, doctrine.concreteHeuristics.operationalCostKeywords)) return true;
  if (containsAnyKeyword(body, doctrine.concreteHeuristics.businessConsequenceKeywords)) return true;
  if (containsAnyKeyword(body, doctrine.concreteHeuristics.arbitrageKeywords)) return true;
  return false;
}

function quoteExcerpt(body, max = EXCERPT_LIMIT) {
  const trimmed = body.trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max) + "...";
}

function extractQualityScore(output) {
  const data = output.data ?? {};
  if (typeof data.qualityScore === "number") return data.qualityScore;
  const signals = data.qualitySignals;
  if (signals && typeof signals === "object") {
    const values = [signals.clarity, signals.specificity, signals.antiHypeAlignment]
      .filter((v) => typeof v === "number");
    if (values.length === 0) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }
  return null;
}

export function gradeOutput(output, doctrine, config) {
  const violatedRules = [];

  // Rule 1 — skill refused
  if (!output || output.status === "failed") {
    return {
      fixtureId: output?.fixtureId ?? "",
      fixtureType: output?.fixtureType ?? "",
      skill: output?.skillName ?? "",
      verdict: "fail",
      violatedRules: [
        {
          rule: "skill-refused",
          detail: output?.error?.message ?? "Skill returned failed status"
        }
      ],
      bodyLength: 0,
      qualityScore: null
    };
  }

  const { headline, body } = normalizeSkillOutput(output);
  const bodyLength = body.length;
  const qualityScore = extractQualityScore(output);

  // Rule 2 — banned opening (rescue if same first sentence has a concrete element)
  const opening = firstSentence(body);
  for (const phrase of doctrine.bannedOpenings) {
    if (opening.toLowerCase().includes(String(phrase).toLowerCase())) {
      const rescued = hasConcreteElement(opening, doctrine);
      if (!rescued) {
        violatedRules.push({
          rule: "banned-opening",
          detail: `Detected banned opening "${phrase}" at sentence 1 with no concrete anchor`,
          excerpt: quoteExcerpt(opening)
        });
        break;
      }
    }
  }

  // Rule 3 — banned meta phrase (no rescue clause)
  for (const phrase of doctrine.bannedMetaPhrases) {
    if (body.toLowerCase().includes(String(phrase).toLowerCase())) {
      violatedRules.push({
        rule: "banned-meta-phrase",
        detail: `Detected banned meta phrase "${phrase}"`,
        excerpt: quoteExcerpt(body)
      });
      break;
    }
  }

  // Rule 4 — headline not repeated in first two sentences
  if (headline.length > 0) {
    const opening2 = firstTwoSentences(body);
    if (opening2.toLowerCase().includes(headline.toLowerCase())) {
      violatedRules.push({
        rule: "headline-repeated",
        detail: "Headline appears verbatim in the first two sentences",
        excerpt: quoteExcerpt(opening2)
      });
    }
  }

  // Rule 5 — body length range
  if (bodyLength < config.bodyLengthMin || bodyLength > config.bodyLengthMax) {
    violatedRules.push({
      rule: "body-length-out-of-range",
      detail: `Body is ${bodyLength} chars, expected ${config.bodyLengthMin}-${config.bodyLengthMax}`
    });
  }

  // Rule 6 — at least one concrete element
  if (!hasConcreteElement(body, doctrine)) {
    violatedRules.push({
      rule: "no-concrete-element",
      detail:
        "Body contains no number, operational cost, business consequence, or arbitrage keyword"
    });
  }

  // Rule 7 — quality score above threshold
  if (qualityScore === null) {
    violatedRules.push({
      rule: "quality-score-below-threshold",
      detail: `Quality score missing, expected >= ${config.qualityScoreThreshold}`
    });
  } else if (qualityScore < config.qualityScoreThreshold) {
    violatedRules.push({
      rule: "quality-score-below-threshold",
      detail: `Quality score ${qualityScore.toFixed(2)} is below threshold ${config.qualityScoreThreshold}`
    });
  }

  return {
    fixtureId: output.fixtureId ?? "",
    fixtureType: output.fixtureType ?? "",
    skill: output.skillName ?? "",
    verdict: violatedRules.length === 0 ? "pass" : "fail",
    violatedRules,
    bodyLength,
    qualityScore
  };
}
