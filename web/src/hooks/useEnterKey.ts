import { useEffect } from 'react';

// Ignored when focus is already on a button/link: the browser's own Enter
// activation already fires the same handler via onClick, so calling it again
// here would run it twice (e.g. drawing two songs instead of one).
function isNativelyActivatable(target: EventTarget | null): boolean {
  const tagName = (target as HTMLElement | null)?.tagName;
  return tagName === 'BUTTON' || tagName === 'A';
}

export function useEnterKey(enabled: boolean, handler: () => void) {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter' || isNativelyActivatable(event.target)) return;
      event.preventDefault();
      handler();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled, handler]);
}
