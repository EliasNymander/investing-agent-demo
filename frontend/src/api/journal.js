const BASE = '/api/journal';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const fetchJournal = () =>
  fetch(BASE).then((r) => r.json()).then((r) => r.data);

export const addJournalEntry = (data) =>
  fetch(BASE, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data) })
    .then((r) => r.json()).then((r) => r.data);

export const updateJournalEntry = (id, patch) =>
  fetch(`${BASE}/${id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(patch) })
    .then((r) => r.json()).then((r) => r.data);

export const deleteJournalEntry = (id) =>
  fetch(`${BASE}/${id}`, { method: 'DELETE' }).then((r) => r.json());
