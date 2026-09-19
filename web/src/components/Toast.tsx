interface ToastProps {
  message: string | null;
}

// The live region stays mounted even when empty: screen readers only announce
// content injected into a region that already existed.
export default function Toast({ message }: ToastProps) {
  return (
    <div className="toast-region" role="status">
      {message && (
        <div key={message} className="toast">
          {message}
        </div>
      )}
    </div>
  );
}
