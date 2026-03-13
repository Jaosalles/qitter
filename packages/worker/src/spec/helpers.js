/**
 * Helper functions for HyperDB index key maps.
 * Referenced by build-schema.mjs via qitterDB.require('./helpers.js').
 */

/**
 * Maps a comment record to its secondary index key for comments-by-post.
 * Returns [{ postId, id }] so the index can support prefix-range scans by postId.
 *
 * @param {{ postId?: string; id?: string }} record
 * @returns {Array<{ postId: string; id: string }>}
 */
exports.mapCommentToPostKey = (record) => {
  if (!record.postId || !record.id) return [];
  return [{ postId: record.postId, id: record.id }];
};
