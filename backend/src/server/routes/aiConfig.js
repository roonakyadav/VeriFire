/**
 * AI Configuration Route
 * 
 * Allows runtime updates to AI intent classification settings
 * without requiring a server restart.
 */

// Store the current AI configuration in memory
let currentAIConfig = {
  aiEnabled: false
};

function createAIConfigHandler(config) {
  return async (req, res) => {
    const { aiEnabled } = req.body || {};

    if (typeof aiEnabled !== 'boolean') {
      return res.status(400).json({ 
        error: 'aiEnabled must be a boolean' 
      });
    }

    try {
      // Update the in-memory configuration
      currentAIConfig.aiEnabled = aiEnabled;
      
      // Also update the process.env as the AI classifier checks that
      process.env.AI_INTENT_ENABLED = aiEnabled ? "true" : "false";
      
      res.json({
        success: true,
        aiEnabled: currentAIConfig.aiEnabled,
        message: `AI intent classification ${aiEnabled ? 'enabled' : 'disabled'}`
      });
    } catch (err) {
      console.error('[VeriFire] AI config update error', err);
      res.status(500).json({ error: 'internal_error' });
    }
  };
}

// Getter function to check if AI is enabled
function isAIEnabled() {
  return currentAIConfig.aiEnabled || process.env.AI_INTENT_ENABLED === "true";
}

module.exports = { 
  createAIConfigHandler,
  isAIEnabled
};