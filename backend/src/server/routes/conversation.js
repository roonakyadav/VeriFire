/**
 * Conversation Management Routes
 * 
 * Handles conversation state initialization and management
 */

const conversationManager = require('../../core/conversation/conversationManager');

function createConversationHandler(config) {
  return async (req, res) => {
    const { chatId } = req.body || {};

    if (!chatId) {
      return res.status(400).json({ 
        error: 'chatId is required' 
      });
    }

    try {
      // Initialize conversation state if it doesn't exist
      // The conversationManager.getOrCreateConversation will handle this automatically
      const conversation = conversationManager.getOrCreateConversation(chatId);
      
      res.json({
        ok: true,
        chatId: conversation.chatId,
        message: 'Conversation initialized successfully'
      });
    } catch (err) {
      console.error('[VeriFire] Conversation init error', err);
      res.status(500).json({ error: 'internal_error' });
    }
  };
}

module.exports = { 
  createConversationHandler 
};