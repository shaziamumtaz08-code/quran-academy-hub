/**
 * "Back to Class Room" navigation.
 *
 * The VCR / Syllabus screens can be reached from more than one roster:
 * the Class Room page (/class-room) and the teacher "My students" list.
 * Going back should return to whichever list the user actually came from,
 * falling back to the Class Room roster when there is no in-app history
 * (deep link, refreshed tab, opened in a new window).
 */
import type { NavigateFunction } from 'react-router-dom';

export function goBackToClassRoom(navigate: NavigateFunction) {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
  if (idx > 0) {
    navigate(-1);
    return;
  }
  navigate('/class-room');
}
