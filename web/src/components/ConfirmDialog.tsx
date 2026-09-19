import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent } from 'react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // The safe choice takes the focus so a stray Enter cannot confirm, and the
  // focus goes back to what opened the dialog once it closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => opener?.focus();
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const wrapsForward = !event.shiftKey && document.activeElement === confirmRef.current;
    const wrapsBackward = event.shiftKey && document.activeElement === cancelRef.current;
    if (wrapsForward || wrapsBackward) {
      event.preventDefault();
      (wrapsForward ? cancelRef : confirmRef).current?.focus();
    }
  }

  return (
    <div className="dialog-backdrop">
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={messageId}>{message}</p>
        <div className="dialog-actions">
          <button type="button" className="secondary" ref={cancelRef} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" ref={confirmRef} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
