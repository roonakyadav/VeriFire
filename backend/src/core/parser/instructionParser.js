function splitLinesWithMeta(instructions) {
  const text = (instructions || '').replace(/\r\n/g, '\n');
  const rawLines = text.split('\n');
  return rawLines.map((lineText, idx) => {
    const lineNumber = idx + 1;
    return {
      line: lineNumber,
      text: lineText,
      trimmed: lineText.trim(),
    };
  });
}

function detectSectionType(lineText) {
  const trimmed = (lineText || '').trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();

  if (/^🎯\s*features/i.test(trimmed) || /^features\b/i.test(trimmed)) {
    return 'FEATURES';
  }
  if (/^⭐/u.test(trimmed) || /^api\b/i.test(lower) || /^web api\b/i.test(lower)) {
    return 'API';
  }
  if (/^❌/u.test(trimmed) || /^forbidden\b/i.test(lower) || /^do not\b/i.test(lower)) {
    return 'FORBIDDEN';
  }
  if (/^📌/u.test(trimmed) || /^rules\b/i.test(lower) || /^constraints\b/i.test(lower)) {
    return 'RULES';
  }
  if (/^learning objectives\b/i.test(trimmed) || /^learning goals\b/i.test(trimmed) || /^objectives\b/i.test(trimmed)) {
    return 'LEARNING';
  }
  if (/^project options\b/i.test(trimmed) || /^alternative projects\b/i.test(trimmed)) {
    return 'PROJECT_OPTIONS';
  }
  if (/^beginner safety\b/i.test(trimmed) || /^safety\b/i.test(trimmed) || /^beginner constraints\b/i.test(trimmed)) {
    return 'SAFETY';
  }
  if (/^project\b/i.test(trimmed) || /^main project\b/i.test(trimmed)) {
    return 'PROJECTS';
  }

  return null;
}

function buildSections(lines) {
  const sections = [];
  if (!lines.length) {
    return sections;
  }

  let current = null;
  const lastLineNumber = lines[lines.length - 1].line;

  lines.forEach((line) => {
    const type = detectSectionType(line.text);
    if (type) {
      if (current) {
        current.endLine = line.line - 1;
      }
      const id = `sec-${type.toLowerCase()}-${sections.length + 1}`;
      current = {
        id,
        type,
        startLine: line.line,
        endLine: lastLineNumber,
      };
      sections.push(current);
    }
  });

  if (!sections.length) {
    sections.push({
      id: 'sec-unstructured-1',
      type: 'UNSTRUCTURED',
      startLine: lines[0].line,
      endLine: lastLineNumber,
    });
  } else if (current) {
    current.endLine = lastLineNumber;
  }

  return sections;
}

function isBulletLine(trimmed) {
  return /^[-*•]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed);
}

function stripBulletPrefix(trimmed) {
  let text = trimmed;
  text = text.replace(/^[-*•]\s+/, '');
  text = text.replace(/^\d+[.)]\s+/, '');
  return text.trim();
}

function extractApiNames(text) {
  const names = [];
  const regex = /`([^`]+)`/g;
  let match;
  while ((match = regex.exec(text))) {
    names.push(match[1]);
  }
  return names;
}

function extractPattern(text) {
  if (!text) return null;
  const backtickMatch = text.match(/`([^`]+)`/);
  if (backtickMatch) {
    return backtickMatch[1].toLowerCase();
  }

  const cleaned = text
    .replace(/must not|do not|never|must|should|only/gi, '')
    .trim();

  if (!cleaned) return null;

  const tokens = cleaned.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (!tokens.length) return null;

  return tokens.slice(0, 4).join(' ').toLowerCase();
}

function extractComplexityLevel(lines) {
  for (const line of lines) {
    const lower = line.text.toLowerCase();
    if (lower.includes('beginner')) {
      return {
        value: 'BEGINNER',
        source: {
          sectionId: null,
          line: line.line,
          rawText: line.text,
        },
      };
    }
    if (lower.includes('intermediate')) {
      return {
        value: 'INTERMEDIATE',
        source: {
          sectionId: null,
          line: line.line,
          rawText: line.text,
        },
      };
    }
    if (lower.includes('advanced')) {
      return {
        value: 'ADVANCED',
        source: {
          sectionId: null,
          line: line.line,
          rawText: line.text,
        },
      };
    }
  }
  return null;
}

function createRule(kind, section, line, indexWithinSection, extras) {
  const trimmed = line.trimmed;
  if (!trimmed) return null;

  const contentText = isBulletLine(trimmed) ? stripBulletPrefix(trimmed) : trimmed;
  if (!contentText) return null;

  const pattern = extractPattern(contentText);

  const severityByKind = {
    FORBIDDEN_API: 'HIGH',
    SAFETY: 'HIGH',
    SCOPE: 'HIGH',
    REQUIRED_FEATURE: 'MEDIUM',
    REQUIRED_API: 'MEDIUM',
    LEARNING_OBJECTIVE: 'LOW',
    OTHER: 'LOW',
  };

  const severity = severityByKind[kind] || 'MEDIUM';

  return {
    id: `${section.id}-${kind.toLowerCase()}-${indexWithinSection}`,
    type: kind,
    severity,
    pattern,
    apiNames: extractApiNames(contentText),
    tags: [],
    sourceText: contentText,
    source: {
      sectionId: section.id,
      line: line.line,
      rawText: line.text,
    },
    confidence: 'MEDIUM',
    ...(extras || {}),
  };
}

function parseInstructionsToBucketModel(instructions) {
  const rawInstructions = instructions || '';
  const lines = splitLinesWithMeta(rawInstructions);
  const sections = buildSections(lines);

  const project = {
    id: 'proj-default',
    name: 'Default Project',
    requiredApis: [],
    requiredFeatures: [],
    learningObjectives: [],
    projectOptions: [],
    complexityLevel: extractComplexityLevel(lines),
  };

  const globalRules = {
    scopeRules: [],
    forbiddenApis: [],
    beginnerSafetyConstraints: [],
    otherRules: [],
  };

  const flatRules = [];

  function addRuleToProject(kind, section, line, idxInSection, targetArray) {
    const rule = createRule(kind, section, line, idxInSection, { projectId: project.id });
    if (!rule) return;
    targetArray.push(rule);
    flatRules.push(rule);
  }

  function addRuleToGlobal(kind, section, line, idxInSection, targetArray) {
    const rule = createRule(kind, section, line, idxInSection, { projectId: null });
    if (!rule) return;
    targetArray.push(rule);
    flatRules.push(rule);
  }

  sections.forEach((section) => {
    const sectionLines = lines.filter(
      (l) => l.line > section.startLine && l.line <= section.endLine
    );

    let indexWithinSection = 0;

    sectionLines.forEach((line) => {
      indexWithinSection += 1;

      switch (section.type) {
        case 'FEATURES': {
          addRuleToProject('REQUIRED_FEATURE', section, line, indexWithinSection, project.requiredFeatures);
          break;
        }
        case 'API': {
          addRuleToProject('REQUIRED_API', section, line, indexWithinSection, project.requiredApis);
          break;
        }
        case 'FORBIDDEN': {
          addRuleToGlobal('FORBIDDEN_API', section, line, indexWithinSection, globalRules.forbiddenApis);
          break;
        }
        case 'RULES': {
          // Treat all as scope rules for now (conservative, deterministic)
          addRuleToGlobal('SCOPE', section, line, indexWithinSection, globalRules.scopeRules);
          break;
        }
        case 'LEARNING': {
          addRuleToProject('LEARNING_OBJECTIVE', section, line, indexWithinSection, project.learningObjectives);
          break;
        }
        case 'SAFETY': {
          addRuleToGlobal('SAFETY', section, line, indexWithinSection, globalRules.beginnerSafetyConstraints);
          break;
        }
        case 'PROJECT_OPTIONS': {
          addRuleToProject('OTHER', section, line, indexWithinSection, project.projectOptions);
          break;
        }
        default: {
          // UNSTRUCTURED or unrecognized sections: keep conservative
          break;
        }
      }
    });
  });

  return {
    rawInstructions,
    projects: [project],
    globalRules,
    flatRules,
  };
}

function parseInstructionsToRules(instructions) {
  const model = parseInstructionsToBucketModel(instructions);
  return model.flatRules;
}

module.exports = {
  parseInstructionsToRules,
  parseInstructionsToBucketModel,
};
