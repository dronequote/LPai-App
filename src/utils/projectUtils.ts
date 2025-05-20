export function getStrippedTitle(title: string, contactName?: string): string {
  if (!contactName) {
    console.log('[getStrippedTitle] No contactName provided. Returning title:', title);
    return title;
  }

  const prefix = `${contactName} - `;
  const isPrefixed = title.startsWith(prefix);

  console.log('[getStrippedTitle]', {
    title,
    contactName,
    prefix,
    isPrefixed,
    result: isPrefixed ? title.replace(prefix, '') : title,
  });

  return isPrefixed ? title.replace(prefix, '') : title;
}
