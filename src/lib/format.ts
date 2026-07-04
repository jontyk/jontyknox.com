export function titleCase(value: string): string {
  return value
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatPublishedAt(value?: Date): string {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

export function metaLine(publishedAt: Date | undefined, category: string): string {
  return [formatPublishedAt(publishedAt), titleCase(category)].filter(Boolean).join(" · ");
}

export function formatMonthYear(value?: Date): string {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

export function metaParts(publishedAt: Date | undefined, category: string): string[] {
  return [formatMonthYear(publishedAt), titleCase(category)].filter(Boolean);
}
