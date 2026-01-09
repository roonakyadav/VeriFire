const { classifyIntent } = require('../ai/aiIntentClassifier');
const conversationManager = require('../conversation/conversationManager');
const { escapeRegExp } = require('../../shared/utils');

async function evaluateRuleAgainstText(rule, promptText, responseText, chatId = null) {
  // If a chatId is provided, use conversation-aware evaluation
  if (chatId) {
    const conversationState = conversationManager.getOrCreateConversation(chatId);
    return evaluateRuleAgainstConversation(rule, promptText, responseText, conversationState);
  }
  
  // Otherwise, use legacy evaluation
  return await evaluateRuleAgainstConversation(rule, promptText, responseText, null);
}

function classifyViolationLevel(pattern, responseText) {
  // Convert to lowercase for case-insensitive matching
  const text = responseText.toLowerCase();
  
  // Escape the pattern to prevent regex errors with special characters
  const escapedPattern = escapeRegExp(pattern);
  
  // NON_VIOLATION signals (strength 0) - highest precedence
  // These override any other signals if present
  const nonViolationPatterns = [
    new RegExp('\explaining.*?\' + escapedPattern + '\'), 
    new RegExp('\describe.*?\' + escapedPattern + '\'), 
    new RegExp('\describing.*?\' + escapedPattern + '\'), 
    new RegExp('\example of.*?\' + escapedPattern + '\'), 
    new RegExp('\' + escapedPattern + '\ stands for'), 
    new RegExp('\' + escapedPattern + '\ refers to'), 
    new RegExp('\' + escapedPattern + '\ means'), 
    new RegExp('\' + escapedPattern + '\ is'), 
    new RegExp('definition:.*?\' + escapedPattern + '\'), 
    new RegExp('what is.*?\' + escapedPattern + '\'), 
    new RegExp('overview of.*?\' + escapedPattern + '\'), 
    new RegExp('introduction to.*?\' + escapedPattern + '\'), 
    new RegExp('not using.*?\' + escapedPattern + '\'), 
    new RegExp('avoiding.*?\' + escapedPattern + '\'), 
    new RegExp('not recommend.*?\' + escapedPattern + '\'), 
    new RegExp('against.*?\' + escapedPattern + '\'), 
    new RegExp('opposed to.*?\' + escapedPattern + '\'), 
    new RegExp('rejected.*?\' + escapedPattern + '\'), 
    new RegExp('if we used.*?\' + escapedPattern + '\'), 
    new RegExp('were we to use.*?\' + escapedPattern + '\'), 
    new RegExp('hypothetically.*?\' + escapedPattern + '\'), 
    new RegExp('theoretically.*?\' + escapedPattern + '\'), 
    new RegExp('in theory.*?\' + escapedPattern + '\')
  ];
  
  // Check for quoted/mentioned markers separately since they involve quotes
  const quoteMarkers = ['"' + escapedPattern + '"', "'" + escapedPattern + "'", '`' + escapedPattern + '`', '“' + escapedPattern + '”', '‘' + escapedPattern + '’'];
  
  // Prohibitive context patterns - also NON_VIOLATION
  const prohibitivePatterns = [
    new RegExp('do not.*?\' + escapedPattern + '\'), 
    new RegExp('don\'t.*?\' + escapedPattern + '\'), 
    new RegExp('should not.*?\' + escapedPattern + '\'), 
    new RegExp('must not.*?\' + escapedPattern + '\'), 
    new RegExp('never.*?\' + escapedPattern + '\'), 
    new RegExp('not.*?\' + escapedPattern + '\.*?use'), 
    new RegExp('not.*?\' + escapedPattern + '\.*?suggest'), 
    new RegExp('not.*?\' + escapedPattern + '\.*?recommend')
  ];
  
  // Check for NON_VIOLATION first (highest precedence)
  for (const patternRegex of nonViolationPatterns) {
    if (text.match(patternRegex)) {
      return 'NON_VIOLATION';
    }
  }
  
  // Check for prohibitive context
  for (const patternRegex of prohibitivePatterns) {
    if (text.match(patternRegex)) {
      return 'NON_VIOLATION';
    }
  }
  
  // Check for quoted/mentioned markers
  for (const quoteMarker of quoteMarkers) {
    if (text.includes(quoteMarker)) {
      return 'NON_VIOLATION';
    }
  }
  
  // Check for hard evidence first (imperative verbs, setup commands, etc.)
  // If hard evidence exists, return HARD_VIOLATION regardless of AI
  const hardViolationWords = [
    'use', 'implement', 'apply', 'integrate', 'install', 'setup', 'configure', 'deploy', 'execute', 'run', 'call', 'invoke', 'utilize', 'leverage', 'adopt', 'switch to', 'migrate to', 'choose', 'select', 'enable', 'activate', 'initiate', 'trigger', 'perform', 'carry out', 'conduct', 'achieve', 'build with', 'develop using',
    'will', 'going to', 'shall', 'about to', 'ready to', 'now using', 'currently using', 'we use', 'using', 'applied', 'implemented', 'deployed', 'running', 'executing', 'activated',
    'first, install', 'set up', 'get started with', 'initialize', 'register', 'sign up for', 'authenticate with'
  ];
  
  for (const word of hardViolationWords) {
    if (text.includes(word) && text.includes(escapedPattern)) {
      // Check if the word and pattern appear in close proximity (within 50 characters)
      const wordIndex = text.indexOf(word);
      const patternIndex = text.indexOf(escapedPattern);
      if (Math.abs(wordIndex - patternIndex) < 50) {
        return 'HARD_VIOLATION';
      }
    }
  }
  
  // No hard evidence found, now we can consider AI classification
  // Since AI is currently disabled, this will always fall back to deterministic classification
  return applyDeterministicOnlyClassification(pattern, responseText);
}

// Helper function to extract a context window around the pattern
function extractContextWindow(pattern, responseText, windowSize = 100) {
  const lowerText = responseText.toLowerCase();
  const patternLower = pattern.toLowerCase();
  const index = lowerText.indexOf(patternLower);
  
  if (index === -1) {
    return responseText.substring(0, Math.min(windowSize * 2, responseText.length));
  }
  
  const start = Math.max(0, index - windowSize);
  const end = Math.min(responseText.length, index + pattern.length + windowSize);
  
  return responseText.substring(start, end);
}

// Apply deterministic-only classification as fallback when AI is disabled
function applyDeterministicOnlyClassification(pattern, responseText) {
  const text = responseText.toLowerCase();
  
  // Escape the pattern to prevent regex errors with special characters
  const escapedPattern = escapeRegExp(pattern);
  
  // SOFT_VIOLATION signals (strength 1)
  const softViolationWords = [
    'could', 'might', 'may', 'should', 'can', 'would', 'ought to', 'perhaps', 'possibly',
    'consider', 'think about', 'looking into', 'evaluating', 'researching', 'exploring', 'investigating',
    'suggest', 'recommend', 'proposal', 'idea', 'option', 'alternative', 'possibility',
    'assuming', 'given', 'provided', 'if', 'when we do', 'once we use'
  ];
  
  // Check for SOFT_VIOLATION
  for (const word of softViolationWords) {
    if (text.includes(word) && text.includes(escapedPattern)) {
      // Check if the word and pattern appear in close proximity (within 50 characters)
      const wordIndex = text.indexOf(word);
      const patternIndex = text.indexOf(escapedPattern);
      if (Math.abs(wordIndex - patternIndex) < 50) {
        return 'SOFT_VIOLATION';
      }
    }
  }
  
  // If no specific signals found, default to NON_VIOLATION
  return 'NON_VIOLATION';
}

// Check for hard evidence (deterministic scan)
function checkHardEvidence(pattern, responseText) {
  const text = responseText.toLowerCase();
  const patternLower = pattern.toLowerCase();
  
  if (text.includes(patternLower)) {
    if (
      hasImperativeLanguageNear(patternLower, text) ||
      hasCodeContext(patternLower, text)
    ) {
      return {
        found: true,
        evidence: 'hard_evidence',
        reason: 'Pattern appears with imperative language or in code context'
      };
    }
  }
  
  // If no hard evidence found
  return {
    found: false,
    evidence: null,
    reason: null
  };
}

// Helper function to check for code context
function hasCodeContext(pattern, text) {
  // Check for code block markers
  if (text.includes('```') && text.includes(pattern)) {
    return true;
  }
  
  // Check for inline code markers
  if (text.includes('`' + pattern + '`')) {
    return true;
  }
  
  // Check for quotes around the pattern
  if (text.includes("'" + pattern + "'") || text.includes('"' + pattern + '"')) {
    return true;
  }
  
  return false;
}

// Helper function to check for imperative language near the pattern
function hasImperativeLanguageNear(pattern, text) {
  const idx = text.indexOf(pattern);
  if (idx === -1) return false;

  const windowStart = Math.max(0, idx - 100);
  const windowEnd = Math.min(text.length, idx + pattern.length + 100);
  const window = text.slice(windowStart, windowEnd);

  const imperativeWords = [
    "install",
    "use ",
    "run ",
    "execute",
    "setup",
    "initialize",
    "create",
    "bypass",
    "exploit",
    "download",
    "access",
    "modify",
    "configure",
    "deploy",
    "implement",
    "apply",
    "integrate"
  ];
  
  return imperativeWords.some(word => window.includes(word));
}

// Calculate numeric confidence score based on deterministic evidence signals
function calculateConfidenceScore(pattern, responseText, violationLevel) {
  let score = 0.30; // Base score
  
  const text = responseText.toLowerCase();
  const patternLower = pattern.toLowerCase();
  
  // Count occurrences of the pattern in the text
  const patternRegex = new RegExp(escapeRegExp(patternLower), 'g');
  const matches = text.match(patternRegex);
  const occurrences = matches ? matches.length : 0;
  
  // Positive signals (additive)
  
  // Exact pattern match
  if (text.includes(patternLower)) {
    score += 0.30;
  }
  
  // Appears in code block or setup instruction
  const codeBlockIndicators = ['`', 'install', 'setup', 'configure', 'npm install', 'pip install', 'yarn add', 'import', 'require', 'use'];
  for (const indicator of codeBlockIndicators) {
    if (text.includes(indicator) && text.includes(patternLower)) {
      // Check if they appear in close proximity (within 50 characters)
      const indicatorIndex = text.indexOf(indicator);
      const patternIndex = text.indexOf(patternLower);
      if (Math.abs(indicatorIndex - patternIndex) < 50) {
        score += 0.30;
        break; // Only add once
      }
    }
  }
  
  // Appears in imperative sentence
  const imperativeVerbs = ['use', 'implement', 'apply', 'integrate', 'install', 'setup', 'configure', 'deploy', 'execute', 'run', 'call', 'invoke'];
  for (const verb of imperativeVerbs) {
    if (text.includes(verb) && text.includes(patternLower)) {
      // Check if they appear in close proximity (within 50 characters)
      const verbIndex = text.indexOf(verb);
      const patternIndex = text.indexOf(patternLower);
      if (Math.abs(verbIndex - patternIndex) < 50) {
        score += 0.20;
        break; // Only add once
      }
    }
  }
  
  // Negative signals (subtractive)
  
  // Explanatory intent detected
  const escapedPatternForRegex = escapeRegExp(patternLower);
  const explanatoryPatterns = [
    new RegExp('\explaining.*?\' + escapedPatternForRegex + '\'), 
    new RegExp('\describe.*?\' + escapedPatternForRegex + '\'), 
    new RegExp('\describing.*?\' + escapedPatternForRegex + '\'), 
    new RegExp('\example of.*?\' + escapedPatternForRegex + '\'), 
    new RegExp('\' + escapedPatternForRegex + '\ stands for'), 
    new RegExp('\' + escapedPatternForRegex + '\ refers to'), 
    new RegExp('\' + escapedPatternForRegex + '\ means'), 
    new RegExp('\' + escapedPatternForRegex + '\ is'), 
    new RegExp('definition:.*?\' + escapedPatternForRegex + '\'), 
    new RegExp('what is.*?\' + escapedPatternForRegex + '\'), 
    new RegExp('overview of.*?\' + escapedPatternForRegex + '\'), 
    new RegExp('introduction to.*?\' + escapedPatternForRegex + '\')
  ];
  for (const patternRegex of explanatoryPatterns) {
    if (text.match(patternRegex)) {
      score -= 0.20;
      break; // Only subtract once
    }
  }
  
  // Ambiguous / suggestion intent detected
  const suggestionWords = ['could', 'might', 'may', 'should', 'can', 'would', 'perhaps', 'possibly', 'suggest', 'recommend', 'consider'];
  for (const word of suggestionWords) {
    if (text.includes(word) && text.includes(patternLower)) {
      // Check if they appear in close proximity (within 50 characters)
      const wordIndex = text.indexOf(word);
      const patternIndex = text.indexOf(patternLower);
      if (Math.abs(wordIndex - patternIndex) < 50) {
        score -= 0.10;
        break; // Only subtract once
      }
    }
  }
  
  // Pattern appears only once
  if (occurrences === 1) {
    score -= 0.10;
  }
  
  // Clamp final score to [0.0, 1.0]
  score = Math.max(0.0, Math.min(1.0, score));
  
  // Map score to label
  let confidenceLabel;
  if (score >= 0.90) {
    confidenceLabel = 'HIGH';
  } else if (score >= 0.70) {
    confidenceLabel = 'MEDIUM';
  } else if (score >= 0.40) {
    confidenceLabel = 'LOW';
  } else {
    confidenceLabel = 'VERY_LOW';
  }
  
  return {
    confidenceScore: score,
    confidenceLabel
  };
}

// Evaluate a single rule against conversation context
async function evaluateRuleAgainstConversation(rule, promptText, responseText, conversationState = null) {
  const pattern = (rule.pattern || '').toLowerCase();
  const prompt = promptText.toLowerCase();
  const response = responseText.toLowerCase();

  if (!pattern) {
    return {
      ruleId: rule.id,
      status: 'UNKNOWN',
      confidenceScore: 0.1,
      confidenceLabel: 'VERY_LOW',
      evidence: null,
      reason: 'No pattern extracted from instruction',
    };
  }

  const inPrompt = prompt.includes(pattern);
  const inResponse = response.includes(pattern);

  // Check if this rule has already been violated cumulatively
  if (conversationState && rule.scope === 'CUMULATIVE' && conversationState.cumulativeViolations.has(rule.id)) {
    // For cumulative rules, once violated, always return FAILED
    const { confidenceScore, confidenceLabel } = calculateConfidenceScore(pattern, responseText, 'CUMULATIVE_VIOLATION');
    return {
      ruleId: rule.id,
      status: 'FAILED',
      confidenceScore,
      confidenceLabel,
      evidence: pattern,
      reason: 'Rule was previously violated and is cumulative',
    };
  }

  // Run deterministic hard evidence scan first
  const hardEvidenceResult = checkHardEvidence(pattern, responseText);
  
  // If hard evidence exists, mark rule as violated and return immediately
  if (hardEvidenceResult.found) {
    // For cumulative rules, mark as violated permanently
    if (conversationState && rule.scope === 'CUMULATIVE') {
      conversationState.cumulativeViolations.add(rule.id);
      conversationState.violatedRules.add(rule.id);
    }
    
    const { confidenceScore, confidenceLabel } = calculateConfidenceScore(pattern, responseText, 'HARD_EVIDENCE');
    return {
      ruleId: rule.id,
      status: 'FAILED',
      confidenceScore,
      confidenceLabel,
      evidence: hardEvidenceResult.evidence,
      reason: hardEvidenceResult.reason,
    };
  }

  // If no hard evidence, call AI Intent Classifier with conversation context
  if (conversationState) {
    const contextMessages = conversationState.getRecentMessages(3); // Get last 3 assistant messages
    const aiResult = await classifyIntent(
      { pattern: rule.pattern, type: rule.type },
      responseText,
      contextMessages
    );
    
    if (aiResult.ok) {
      // AI succeeded, apply deterministic mapping based on AI intent
      const { intent } = aiResult;
      const { confidenceScore, confidenceLabel } = calculateConfidenceScore(pattern, responseText, `AI_${intent}`);
      
      if (intent === 'INSTRUCTION') {
        // For cumulative rules, mark as violated permanently
        if (rule.scope === 'CUMULATIVE') {
          conversationState.cumulativeViolations.add(rule.id);
          conversationState.violatedRules.add(rule.id);
        }
        
        return {
          ruleId: rule.id,
          status: 'FAILED',
          confidenceScore,
          confidenceLabel,
          evidence: pattern,
          reason: 'AI classified as INSTRUCTION - hard violation',
        };
      } else if (intent === 'SUGGESTION') {
        // For cumulative rules, mark as violated permanently
        if (rule.scope === 'CUMULATIVE') {
          conversationState.cumulativeViolations.add(rule.id);
          conversationState.violatedRules.add(rule.id);
        }
        
        return {
          ruleId: rule.id,
          status: 'FAILED',
          confidenceScore,
          confidenceLabel,
          evidence: pattern,
          reason: 'AI classified as SUGGESTION - soft violation',
        };
      } else { // EXPLANATION
        return {
          ruleId: rule.id,
          status: 'PASSED',
          confidenceScore,
          confidenceLabel,
          evidence: null,
          reason: 'AI classified as EXPLANATION - no violation',
        };
      }
    }
  }

  // If AI is disabled or failed, use fallback deterministic classification
  const fallbackResult = applyDeterministicOnlyClassification(pattern, responseText);
  const { confidenceScore, confidenceLabel } = calculateConfidenceScore(pattern, responseText, fallbackResult);
  
  if (fallbackResult === 'HARD_VIOLATION' || fallbackResult === 'SOFT_VIOLATION') {
    // For cumulative rules, mark as violated permanently
    if (conversationState && rule.scope === 'CUMULATIVE') {
      conversationState.cumulativeViolations.add(rule.id);
      conversationState.violatedRules.add(rule.id);
    }
    
    return {
      ruleId: rule.id,
      status: 'FAILED',
      confidenceScore,
      confidenceLabel,
      evidence: pattern,
      reason: `Fallback deterministic classification: ${fallbackResult}`,
    };
  } else {
    return {
      ruleId: rule.id,
      status: 'PASSED',
      confidenceScore,
      confidenceLabel,
      evidence: null,
      reason: 'Fallback deterministic classification: NON_VIOLATION',
    };
  }

  const type = (rule.type || '').toLowerCase();

  const isForbiddenType =
    type === 'forbidden' ||
    type === 'forbidden_api' ||
    type === 'safety';

  const isRequiredType =
    type === 'required' ||
    type === 'required_feature' ||
    type === 'required_api' ||
    type === 'learning_objective';

  const isScopeType = type === 'scope' || type === 'scope_rule';

  if (isForbiddenType) {
    if (inResponse) {
      // Determine violation level based on evidence signals
      const violationLevel = classifyViolationLevel(pattern, responseText);
      
      // Calculate confidence score for forbidden rules
      const { confidenceScore, confidenceLabel } = calculateConfidenceScore(pattern, responseText, violationLevel);
      
      // Map violation level to status and confidence
      if (violationLevel === 'HARD_VIOLATION') {
        // For cumulative rules, mark as violated permanently
        if (conversationState && rule.scope === 'CUMULATIVE') {
          conversationState.cumulativeViolations.add(rule.id);
          conversationState.violatedRules.add(rule.id);
        }
        
        return {
          ruleId: rule.id,
          status: 'FAILED',
          confidenceScore,
          confidenceLabel,
          evidence: pattern,
          reason: 'Forbidden pattern appears in response with execution intent',
        };
      } else if (violationLevel === 'SOFT_VIOLATION') {
        // For cumulative rules, mark as violated permanently
        if (conversationState && rule.scope === 'CUMULATIVE') {
          conversationState.cumulativeViolations.add(rule.id);
          conversationState.violatedRules.add(rule.id);
        }
        
        return {
          ruleId: rule.id,
          status: 'FAILED',
          confidenceScore,
          confidenceLabel,
          evidence: pattern,
          reason: 'Forbidden pattern appears in response with conditional intent',
        };
      } else { // NON_VIOLATION
        return {
          ruleId: rule.id,
          status: 'PASSED',
          confidenceScore,
          confidenceLabel,
          evidence: null,
          reason: 'Forbidden pattern appears in response but in explanatory context',
        };
      }
    }
    return {
      ruleId: rule.id,
      status: 'PASSED',
      confidenceScore: 0.9,
      confidenceLabel: 'HIGH',
      evidence: null,
      reason: 'Forbidden pattern not found in response',
    };
  }

  if (isRequiredType) {
    if (inResponse) {
      // Calculate confidence for required rules when found
      const { confidenceScore, confidenceLabel } = calculateConfidenceScore(pattern, responseText, 'REQUIRED_FOUND');
      return {
        ruleId: rule.id,
        status: 'PASSED',
        confidenceScore,
        confidenceLabel,
        evidence: pattern,
        reason: 'Required pattern found in response',
      };
    }
    // Calculate confidence for required rules when not found
    const { confidenceScore, confidenceLabel } = calculateConfidenceScore(pattern, responseText, 'REQUIRED_NOT_FOUND');
    return {
      ruleId: rule.id,
      status: 'FAILED',
      confidenceScore,
      confidenceLabel,
      evidence: null,
      reason: 'Required pattern not found in response',
    };
  }

  if (isScopeType) {
    if (!inPrompt && inResponse) {
      // Calculate confidence for scope rules when violated
      const { confidenceScore, confidenceLabel } = calculateConfidenceScore(pattern, responseText, 'SCOPE_VIOLATION');
      return {
        ruleId: rule.id,
        status: 'FAILED',
        confidenceScore,
        confidenceLabel,
        evidence: pattern,
        reason: 'Response mentions pattern that may be out of scope',
      };
    }
    // Calculate confidence for scope rules when not violated
    const { confidenceScore, confidenceLabel } = calculateConfidenceScore(pattern, responseText, 'SCOPE_OK');
    return {
      ruleId: rule.id,
      status: 'PASSED',
      confidenceScore,
      confidenceLabel,
      evidence: null,
      reason: 'Scope rule did not detect clear violation',
    };
  }

  return {
    ruleId: rule.id,
    status: 'UNKNOWN',
    confidenceScore: 0.2,
    confidenceLabel: 'VERY_LOW',
    evidence: null,
    reason: 'Generic rule type; no evaluation logic',
  };
}

// Export both the original function and the conversation-aware evaluation function
module.exports = { 
  evaluateRuleAgainstText,
  evaluateRuleAgainstConversation
};
