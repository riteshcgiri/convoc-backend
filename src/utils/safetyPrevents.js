const escapeRegex = (text) => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export {escapeRegex}