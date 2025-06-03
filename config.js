// config.js
export const CONFIG = {
  // maxScrollsForRawTextCollection is no longer used for scrolling,
  // but the keys ('posts', 'comments', 'reactions') might be used elsewhere if needed for section identification.
  // For now, it has no direct effect on extraction.
  maxScrollsForRawTextCollection: {
      posts: 0, // Was 25, scrolling removed
      comments: 0, // Was 15, scrolling removed
      reactions: 0 // Was 15, scrolling removed
  }
};