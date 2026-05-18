import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { MAP_STYLES, type MapStyleId } from "./theme";

type Props = {
  value: MapStyleId;
  onChange: (id: MapStyleId) => void;
  ariaLabel: string;
};

export function StyleSelect({ value, onChange, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = MAP_STYLES.find((s) => s.id === value) ?? MAP_STYLES[0];

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="style-select" ref={rootRef}>
      <button
        type="button"
        className={"style-select-trigger" + (open ? " is-open" : "")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="style-select-label">{current.label}</span>
        <motion.span
          className="style-select-caret"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <ChevronDown size={14} strokeWidth={2} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            className="style-select-menu"
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            {MAP_STYLES.map((s) => {
              const active = s.id === value;
              return (
                <motion.li
                  key={s.id}
                  role="option"
                  aria-selected={active}
                  className={"style-select-option" + (active ? " is-active" : "")}
                  onClick={() => {
                    onChange(s.id);
                    setOpen(false);
                  }}
                  whileHover={{ x: 2 }}
                  transition={{ duration: 0.12 }}
                >
                  <span>{s.label}</span>
                  <span className="style-select-check">
                    {active && <Check size={14} strokeWidth={2.4} />}
                  </span>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
