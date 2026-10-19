import type { FeedEvent } from '@/lib/feed';

export type FeedSection = {
  title: string;
  data: FeedEvent[];
};

export function createFeedSections(events: FeedEvent[]): FeedSection[] {
  const sections: FeedSection[] = [];
  const sectionByDay = new Map<string, FeedSection>();

  for (const event of events) {
    const dayKey = getDayKey(event.created_at);
    let section = sectionByDay.get(dayKey);

    if (!section) {
      section = { title: formatDayLabel(event.created_at), data: [] };
      sectionByDay.set(dayKey, section);
      sections.push(section);
    }

    section.data.push(event);
  }

  return sections;
}

function getDayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAgo = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);

  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  return date.toLocaleDateString('en-GB');
}
