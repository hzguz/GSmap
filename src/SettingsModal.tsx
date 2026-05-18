import { type MouseEvent, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Moon, Sun, X } from "lucide-react";
import { useLocale, type LocalePref } from "./i18n";

type Props = {
  open: boolean;
  onClose: () => void;
  uiTheme: "light" | "dark";
  onChangeTheme: (theme: "light" | "dark") => void;
};

export function SettingsModal({ open, onClose, uiTheme, onChangeTheme }: Props) {
  const { t, pref, setPref } = useLocale();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const langOptions: { value: LocalePref; label: string; hint?: string }[] = [
    { value: "auto", label: t.settings.languageAuto, hint: t.settings.languageAutoHint },
    { value: "pt-BR", label: "Português (BR)" },
    { value: "en", label: "English" },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className="modal-header">
              <h2 id="settings-title" className="modal-title">{t.settings.title}</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={onClose}
                aria-label={t.settings.close}
              >
                <X size={16} strokeWidth={2} />
              </button>
            </header>

            <div className="modal-body">
              <section className="modal-section">
                <h3 className="modal-section-title">{t.settings.theme}</h3>
                <div className="seg-row">
                  <SegOption
                    active={uiTheme === "light"}
                    onClick={() => onChangeTheme("light")}
                    icon={<Sun size={15} strokeWidth={2} />}
                    label={t.settings.themeLight}
                  />
                  <SegOption
                    active={uiTheme === "dark"}
                    onClick={() => onChangeTheme("dark")}
                    icon={<Moon size={15} strokeWidth={2} />}
                    label={t.settings.themeDark}
                  />
                </div>
              </section>

              <section className="modal-section">
                <h3 className="modal-section-title">{t.settings.language}</h3>
                <div className="lang-list">
                  {langOptions.map((opt) => (
                    <motion.button
                      key={opt.value}
                      type="button"
                      className={"lang-row" + (pref === opt.value ? " lang-row-active" : "")}
                      onClick={() => setPref(opt.value)}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.99 }}
                      transition={{ duration: 0.12 }}
                    >
                      <span className="lang-row-label">
                        <span>{opt.label}</span>
                        {opt.hint && <span className="lang-row-hint">{opt.hint}</span>}
                      </span>
                      <span className="lang-row-check">
                        {pref === opt.value && <Check size={15} strokeWidth={2.4} />}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type SegOptionProps = {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
};

function SegOption({ active, onClick, icon, label }: SegOptionProps) {
  return (
    <motion.button
      type="button"
      className={"seg-option" + (active ? " seg-option-active" : "")}
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12 }}
    >
      {icon}
      <span>{label}</span>
    </motion.button>
  );
}
