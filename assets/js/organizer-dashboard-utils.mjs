function getVisibleEventsForOrganizer(events, organizerId) {
  if (!organizerId) return [];
  return events.filter((event) => event.organizerId === organizerId);
}

export { getVisibleEventsForOrganizer };
