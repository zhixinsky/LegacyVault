interface NoteEditAuth {
  code: string;
  expiresAt: number;
}

const noteEditAuth = new Map<string, NoteEditAuth>();
const NOTE_EDIT_AUTH_TTL_MS = 2 * 60 * 1000;

export function authorizeNoteEdit(noteId: string, code: string) {
  noteEditAuth.set(noteId, {
    code,
    expiresAt: Date.now() + NOTE_EDIT_AUTH_TTL_MS,
  });
}

export function consumeNoteEditAuth(noteId: string) {
  const auth = noteEditAuth.get(noteId);
  noteEditAuth.delete(noteId);

  if (!auth || auth.expiresAt < Date.now()) {
    return '';
  }

  return auth.code;
}
