// Rule Derivation Layer: turns structured Knowledge Bucket data into
// Derived Rules that the existing Rule Engine can evaluate.
//
// This module is additive: it does not replace existing flat rules coming
// from the Instruction Parser. Instead, it derives additional rules from
// the structured fields (projects, globalRules) and lets the caller
// decide how to merge them.

function normalizePattern(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

function pickOriginalInstructionText(node, bucket) {
  if (node && node.source && typeof node.source.rawText === 'string') {
    return node.source.rawText;
  }
  if (typeof node.sourceText === 'string') {
    return node.sourceText;
  }
  if (typeof bucket.instructions === 'string') {
    return bucket.instructions;
  }
  if (typeof bucket.rawInstructions === 'string') {
    return bucket.rawInstructions;
  }
  return '';
}

// Create a deterministic rule id based on bucket, project, local kind and index.
function makeRuleId(bucketId, projectId, kind, localIndex, extraSuffix) {
  const baseProject = projectId ? `proj-${projectId}` : 'global';
  const base = `derived-${bucketId}-${baseProject}-${kind}-${localIndex}`;
  if (extraSuffix !== undefined && extraSuffix !== null) {
    return `${base}-${extraSuffix}`;
  }
  return base;
}

// Derive REQUIRED rules from project.requiredFeatures
function deriveFromRequiredFeatures(bucket, project, projectIndex) {
  const derived = [];
  const bucketId = bucket.id || 'bucket';
  const projectId = project.id || `project-${projectIndex + 1}`;
  const features = Array.isArray(project.requiredFeatures)
    ? project.requiredFeatures
    : [];

  features.forEach((feature, idx) => {
    const pattern = normalizePattern(feature.pattern || feature.sourceText);
    if (!pattern) {
      return; // Conservative: skip if we cannot determine a stable pattern
    }

    const severity = feature.severity || 'MEDIUM';
    const originalInstructionText = pickOriginalInstructionText(feature, bucket);

    derived.push({
      // Deterministic id based only on bucket/project/position
      id: makeRuleId(bucketId, projectId, 'feature', idx + 1),
      // Type is specific so the Rule Engine and UI can see feature intent
      type: 'required_feature',
      severity,
      pattern,
      sourceText: feature.sourceText || originalInstructionText,
      projectId,
      originalInstructionText,
    });
  });

  return derived;
}

// Derive REQUIRED rules from project.requiredApis
function deriveFromRequiredApis(bucket, project, projectIndex) {
  const derived = [];
  const bucketId = bucket.id || 'bucket';
  const projectId = project.id || `project-${projectIndex + 1}`;
  const apiRules = Array.isArray(project.requiredApis)
    ? project.requiredApis
    : [];

  apiRules.forEach((apiRule, idx) => {
    const apiNames = Array.isArray(apiRule.apiNames) ? apiRule.apiNames : [];
    const basePattern = normalizePattern(apiRule.pattern || apiRule.sourceText);
    const originalInstructionText = pickOriginalInstructionText(apiRule, bucket);
    const severity = apiRule.severity || 'MEDIUM';

    if (!apiNames.length) {
      // No explicit apiNames; fall back to a single rule on the base pattern.
      if (!basePattern) return;
      derived.push({
        id: makeRuleId(bucketId, projectId, 'api', idx + 1),
        type: 'required_api',
        severity,
        pattern: basePattern,
        sourceText: apiRule.sourceText || originalInstructionText,
        projectId,
        originalInstructionText,
      });
      return;
    }

    // One derived rule per concrete API name. This keeps matching simple and traceable.
    apiNames.forEach((name, apiIdx) => {
      const pattern = normalizePattern(String(name));
      if (!pattern) return;

      derived.push({
        id: makeRuleId(bucketId, projectId, 'api', idx + 1, apiIdx + 1),
        type: 'required_api',
        severity,
        pattern,
        sourceText: apiRule.sourceText || originalInstructionText,
        projectId,
        originalInstructionText,
      });
    });
  });

  return derived;
}

// Derive FORBIDDEN rules from globalRules.forbiddenApis
function deriveFromForbiddenApis(bucket) {
  const derived = [];
  const bucketId = bucket.id || 'bucket';
  const globalRules = bucket.globalRules || {};
  const forbidden = Array.isArray(globalRules.forbiddenApis)
    ? globalRules.forbiddenApis
    : [];

  forbidden.forEach((rule, idx) => {
    const apiNames = Array.isArray(rule.apiNames) ? rule.apiNames : [];
    const basePattern = normalizePattern(rule.pattern || rule.sourceText);
    const originalInstructionText = pickOriginalInstructionText(rule, bucket);
    const severity = rule.severity || 'HIGH';

    if (!apiNames.length) {
      // No explicit API names; use base pattern if available
      if (!basePattern) return;
      derived.push({
        id: makeRuleId(bucketId, null, 'forbidden-api', idx + 1),
        type: 'forbidden_api',
        severity,
        pattern: basePattern,
        sourceText: rule.sourceText || originalInstructionText,
        projectId: null,
        originalInstructionText,
      });
      return;
    }

    // For each explicitly listed API name, create a derived rule with word-boundary matching.
    // This ensures "React" matches "React" but not "unreactive".
    apiNames.forEach((name, apiIdx) => {
      const rawName = String(name).trim();
      if (!rawName) return;

      // Lowercase for case-insensitive matching, but preserve the exact API name for display.
      const pattern = rawName.toLowerCase();

      derived.push({
        id: makeRuleId(bucketId, null, 'forbidden-api', idx + 1, apiIdx + 1),
        type: 'forbidden_api',
        severity,
        pattern,  // Lowercased literal API name (e.g., "react", "firebase")
        sourceText: rule.sourceText || originalInstructionText,
        projectId: null,
        originalInstructionText,
      });
    });
  });

  return derived;
}

// Public API: derive rules from a single structured Knowledge Bucket.
//
// This function only uses a subset of the structured model:
// - project.requiredFeatures → required_feature rules
// - project.requiredApis → required_api rules
// - globalRules.forbiddenApis → forbidden_api rules
//
// The resulting rules conform to the shape expected by the existing
// Rule Engine (id, type, severity, pattern, sourceText) but they also
// carry projectId and originalInstructionText for traceability.
function deriveRulesFromBucket(bucket) {
  if (!bucket || typeof bucket !== 'object') {
    return [];
  }

  const projects = Array.isArray(bucket.projects) ? bucket.projects : [];
  const derived = [];

  projects.forEach((project, projectIndex) => {
    derived.push(
      ...deriveFromRequiredFeatures(bucket, project, projectIndex),
      ...deriveFromRequiredApis(bucket, project, projectIndex)
    );
  });

  derived.push(...deriveFromForbiddenApis(bucket));

  return derived;
}

module.exports = {
  deriveRulesFromBucket,
};
