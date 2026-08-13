# ADR 0006: Verified quotes instead of API citations

- **Status:** Accepted
- **Date:** 2026-08-13
- **Milestone:** M7
- **Deciders:** equipo Olbun

## Context

Detection reads other people's correspondence and proposes that something in it
matters — a notice of penalty, the opening of a sanctioning procedure, a
deadline. SPEC §4.4 requires two things of every proposal at once:

1. **A typed object.** The detection has a type from a closed catalogue, a
   confidence, and extracted data (amounts, dates, articles cited). The queue,
   the ordering and the confirmation path all read those fields.
2. **A checkable quote.** The reviewer has to see the words in the document
   that justify the claim, not a summary of them. This is what makes fifty
   detections reviewable in fifteen minutes, and it is what stops a plausible
   paraphrase from opening an expediente.

The Anthropic API offers a citations feature that returns character-level
references into a source document. It cannot be combined with structured JSON
output: enabling `citations` on a document block together with
`output_config.format` returns a 400. The two features are mutually exclusive.

So we cannot have the API give us both. We have to choose which one the API
provides and how we obtain the other.

A further constraint shaped this more than the API did. A quote is not evidence
because a model says it is a quote. Even with the citations feature, the trust
model would be "the API told us these offsets are right". For a product whose
output can start a legal procedure, the property we want is stronger: _the
words we show a reviewer appear in the document, and we checked_.

## Decision

We will use **structured output**, ask the model to return quotes as ordinary
string fields of the schema, and **verify every quote on the server by exact
substring match against the source text before persisting it**.

Concretely:

- The engine returns `{tipo, confianza, extractos: string[], datos}` under a
  JSON schema enforced by the API.
- `lib/domain/detecciones/verificacion.ts` checks each proposed quote against
  the exact text the engine was shown. A quote that does not appear is dropped.
- **The server computes the character offsets itself.** The model is never
  asked for them. The stored quote is the source's own text, sliced at the
  offsets we found, so the highlight in the triage screen cannot drift from
  what the document says.
- Dropping a quote lowers the detection's confidence in proportion to how many
  were lost. A detection left with no verified quote is recorded as
  automatically discarded and never shown as a finding — and kept, because a
  prompt that invents quotes is something we want to be able to measure.
- Whitespace differences are forgiven and nothing else is. A model transcribing
  from an email reflows line breaks; that does not change which words are in
  the document. Case, accents and punctuation are all significant.
- Every detection stores `modelId`, `promptVersion`, `confianzaModelo` (what
  was claimed) alongside `confianza` (what survived), and how many quotes were
  dropped.

This is written down in AGENTS.md as a rule, because the failure mode is a
future contributor "fixing" the missing citations by enabling both features and
meeting a 400 in production.

## Consequences

### Positive

- The guarantee comes from our own check, not from the model's good faith. It
  holds identically for the Claude engine, the local rule engine, and anything
  we write later — verification lives in the domain layer and knows nothing
  about who proposed the quote.
- Hallucinated quotes cannot reach a reviewer. The worst case is a detection
  that disappears, not one that shows words the document does not contain.
- The gap between `confianzaModelo` and `confianza`, aggregated over time, is a
  direct measurement of how often the engine invents quotes. Citations would
  have given us no equivalent signal.
- Verification is pure, synchronous and exhaustively testable without a network
  call or an API key.

### Negative / accepted trade-offs

- We lose the API's own offsets and re-derive them. That is a real cost in code
  (the offset mapping through whitespace normalisation is fiddly) paid for the
  ability to state the guarantee ourselves.
- A quote the model _shortened_ correctly — dropping an inner clause but
  keeping the sense — is discarded like an invented one. That is the intended
  bias: it costs recall to buy the property that anything shown is verbatim.
- Confidence penalties are a heuristic, not a calibrated probability. The
  proportional formula and the 0.15 floor are judgement, and the reason the
  reviewer sees both numbers rather than only the adjusted one.

### Revisit when

The API supports citations together with structured output, **and** we have
data showing our own verification is the thing limiting recall. Even then, the
server-side check should stay: it costs microseconds and it is the reason we
can describe a quote as verified rather than as claimed.

## Alternatives considered

### Citations, with types inferred afterwards

Use the citations feature and derive the detection type from a second call or
from keywords over the cited text. Rejected: two calls doubles cost and
latency, and the second call would be classifying a fragment without the
context that made it meaningful.

### Two calls — one for JSON, one for citations

Same document, two requests, join the results. Rejected: nothing guarantees the
two runs agree, so the reviewer could be shown a quote that belongs to a
finding the other call did not make. It doubles cost for a weaker property than
the one substring matching gives us for free.

### Trust the model's offsets without checking

Ask for `{texto, inicioChar, finChar}` and store them as given. Rejected on the
evidence: offsets are exactly the kind of output a model produces confidently
and approximately, and a highlight landing on the wrong sentence would
undermine the one feature the whole screen exists to provide.
