

class ConversationState {
  constructor(chatId) {
    this.chatId = chatId;
    this.assistantMessages = [];
    this.violatedRules = new Set();
    this.cumulativeViolations = new Set();
    this.lastAnalysisAt = Date.now();
  }

  /**
   * Get recent assistant messages for context
   */
  getRecentMessages(count = 5) {
    return this.assistantMessages.slice(-count);
  }

  /**
   * Add an assistant message to the conversation
   */
  addAssistantMessage(messageText) {
    this.assistantMessages.push(messageText);
    this.lastAnalysisAt = Date.now();
  }

  /**
   * Mark a rule as violated in this conversation
   */
  markRuleViolated(ruleId, isCumulative = false) {
    this.violatedRules.add(ruleId);
    
    if (isCumulative) {
      this.cumulativeViolations.add(ruleId);
    }
  }

  /**
   * Check if a rule has been violated in this conversation
   */
  isRuleViolated(ruleId) {
    return this.violatedRules.has(ruleId) || this.cumulativeViolations.has(ruleId);
  }

  /**
   * Get all cumulative violations for this conversation
   */
  getCumulativeViolations() {
    return Array.from(this.cumulativeViolations);
  }
}

class ConversationManager {
  constructor() {
    this.conversations = new Map(); // chatId -> ConversationState
  }

  /**
   * Get or create a conversation state for a given chatId
   */
  getOrCreateConversation(chatId) {
    if (!this.conversations.has(chatId)) {
      this.conversations.set(chatId, new ConversationState(chatId));
    }
    return this.conversations.get(chatId);
  }

  /**
   * Add an assistant message to a conversation
   */
  addAssistantMessage(chatId, messageText) {
    const conversation = this.getOrCreateConversation(chatId);
    conversation.addAssistantMessage(messageText);
    return conversation;
  }

  /**
   * Mark a rule as violated in a conversation
   */
  markRuleViolated(chatId, ruleId, isCumulative = false) {
    const conversation = this.getOrCreateConversation(chatId);
    conversation.markRuleViolated(ruleId, isCumulative);
  }

  /**
   * Check if a rule has been violated in a conversation
   */
  isRuleViolated(chatId, ruleId) {
    const conversation = this.getOrCreateConversation(chatId);
    return conversation.isRuleViolated(ruleId);
  }

  /**
   * Get recent messages from a conversation for AI context
   */
  getRecentMessages(chatId, count = 5) {
    const conversation = this.getOrCreateConversation(chatId);
    return conversation.getRecentMessages(count);
  }

  /**
   * Get all cumulative violations for a conversation
   */
  getCumulativeViolations(chatId) {
    const conversation = this.getOrCreateConversation(chatId);
    return conversation.getCumulativeViolations();
  }

  /**
   * Clear a conversation state (for testing or cleanup)
   */
  clearConversation(chatId) {
    this.conversations.delete(chatId);
  }

  /**
   * Get all active conversation IDs
   */
  getAllActiveChats() {
    return Array.from(this.conversations.keys());
  }
}

// Export singleton instance
module.exports = new ConversationManager();