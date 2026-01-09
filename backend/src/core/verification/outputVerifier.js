const { evaluateRuleAgainstText } = require('../rules/ruleEngine');
const { scoreRiskFromResults } = require('../scoring/riskScoring');
const { deriveRulesFromBucket } = require('../derivation/ruleDeriver');

async function evaluateTextAgainstBuckets({ promptText, responseText, buckets, chatId = null }) {
  const allRuleResults = [];
  
  // Ensure buckets is always an array
  const validBuckets = Array.isArray(buckets) ? buckets : [];
 
  for (const bucket of validBuckets) {
    const baseRules = Array.isArray(bucket.rules) ? bucket.rules : [];
    const derivedRules = deriveRulesFromBucket(bucket);

    // Merge derived rules with existing flat rules. Existing rules win
    // on conflicts to preserve current behaviour; derived rules fill
    // in any gaps and ensure a single place (the structured bucket)
    // acts as the source of truth for what can be checked.
    const seen = new Set();
    const mergedRules = [];

    function addRule(rule) {
      const key = `${(rule.type || '').toLowerCase()}::${(rule.pattern || '').toLowerCase()}::${
        rule.projectId || ''
      }`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      mergedRules.push(rule);
    }

    baseRules.forEach(addRule);
    derivedRules.forEach(addRule);

    const rulePromises = mergedRules.map(async (rule) => {
      const result = await evaluateRuleAgainstText(rule, promptText, responseText, chatId);
      return {
        ...result,
        bucketId: bucket.id,
        bucketName: bucket.name,
        ruleSourceText: rule.sourceText,
        ruleType: rule.type,
        ruleSeverity: rule.severity || 'MEDIUM',
      };
    });
    
    const ruleResults = await Promise.all(rulePromises);
    allRuleResults.push(...ruleResults);
  };

  const risk = scoreRiskFromResults(allRuleResults, buckets);

  return {
    promptText,
    responseText,
    bucketsAnalyzed: buckets.map((b) => ({ id: b.id, name: b.name })),
    risk,
    ruleResults: allRuleResults,
  };
}

module.exports = { evaluateTextAgainstBuckets };
