export const previewPublicSuffix = (leadId: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < leadId.length; index += 1) {
    hash ^= leadId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(5, "0").slice(-5);
};

export const buildPreviewPublicSlug = (previewSlug: string, leadId: string) =>
  `${previewSlug}-${previewPublicSuffix(leadId)}`;

export const parsePreviewPublicSlug = (publicSlug: string) => {
  const match = publicSlug.match(/^([a-z0-9-]+)-([a-z0-9]{5})$/);
  return match ? { previewSlug: match[1], suffix: match[2] } : null;
};
