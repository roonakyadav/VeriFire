/**
 * Shared utilities for the VeriFire backend
 */

/**
 * Escape special regular expression characters in a string
 * @param {string} string - The string to escape
 * @returns {string} - The escaped string safe for use in RegExp
 */
function escapeRegExp(string) {
  // Escape all RegExp meta characters: . * + ? ^ $ { } ( ) | [ ] \
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  escapeRegExp
};