import { useId, useState, type ReactNode } from 'react';

interface ActionButtonProps {
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

// A button that explains itself on hover or keyboard focus. The tooltip belongs to the
// wrapper: a disabled button receives no pointer events, yet it is the one that most
// needs to say why it cannot be used.
export default function ActionButton({ tooltip, onClick, disabled, className, children }: ActionButtonProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span
      className="action-tip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        className={className}
        disabled={disabled}
        aria-describedby={open ? tooltipId : undefined}
        onClick={onClick}
      >
        {children}
      </button>
      {open && (
        <div id={tooltipId} role="tooltip" className="action-tooltip">
          {tooltip}
        </div>
      )}
    </span>
  );
}
