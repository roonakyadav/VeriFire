function scoreRiskFromResults(results, buckets) {
  let score = 0;
  let maxScore = 0;

  const ruleById = new Map();
  buckets.forEach((bucket) => {
    (bucket.rules || []).forEach((rule) => {
      ruleById.set(rule.id, rule);
    });
  });

  results.forEach((r) => {
    const rule = ruleById.get(r.ruleId);
    const severity = rule && rule.severity ? rule.severity : 'MEDIUM';

    let weight = 1;
    if (severity === 'HIGH') weight = 3;
    else if (severity === 'MEDIUM') weight = 2;

    maxScore += weight;

    if (r.status === 'FAILED') {
      score += weight;
    }
  });

  const ratio = maxScore === 0 ? 0 : score / maxScore;

  let label = 'LOW';
  if (ratio >= 0.66) label = 'HIGH';
  else if (ratio >= 0.33) label = 'MEDIUM';

  return {
    label,
    numericScore: score,
    numericMax: maxScore,
    ratio,
  };
}

module.exports = { scoreRiskFromResults };
