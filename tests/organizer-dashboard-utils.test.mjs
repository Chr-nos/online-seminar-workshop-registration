import test from 'node:test';
import assert from 'node:assert/strict';
import { getVisibleEventsForOrganizer } from '../assets/js/organizer-dashboard-utils.mjs';

test('returns only events assigned to the current organizer', () => {
  const events = [
    { id: '1', organizerId: 'org-1' },
    { id: '2', organizerId: 'org-2' },
    { id: '3' }
  ];

  const visible = getVisibleEventsForOrganizer(events, 'org-1');

  assert.deepEqual(visible.map((event) => event.id), ['1']);
});

test('returns all assigned events for the organizer when present', () => {
  const events = [
    { id: '1', organizerId: 'org-1' },
    { id: '2', organizerId: 'org-1' },
    { id: '3', organizerId: 'org-2' }
  ];

  const visible = getVisibleEventsForOrganizer(events, 'org-1');

  assert.deepEqual(visible.map((event) => event.id), ['1', '2']);
});
