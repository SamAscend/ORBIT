"use client";

import { useEffect, useRef } from "react";
import { useLanguage } from "@/lib/i18n";

type OnboardingAction = {
  label: string;
  description: string;
  onChoose: () => void;
};

export function WorkspaceOnboarding({ name, actions, onDismiss }: {
  name: string;
  actions: OnboardingAction[];
  onDismiss: () => void;
}) {
  const { t } = useLanguage();
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  return <div className="modal-backdrop onboarding-backdrop">
    <section className="modal-card onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" aria-describedby="onboarding-intro">
      <button ref={closeButton} type="button" className="onboarding-close" onClick={onDismiss} aria-label={t("Close")}>×</button>
      <span className="eyebrow">{t("A COMMUNITY, IN MOTION")}</span>
      <h2 id="onboarding-title">{t("Welcome to ORBIT,")} {name}</h2>
      <p className="onboarding-intro" id="onboarding-intro">{t("Here are a few good places to start. You can always find them in the menu.")}</p>
      <div className="onboarding-actions">
        {actions.map((action, index) => <button type="button" className="onboarding-action" key={action.label} onClick={action.onChoose}>
          <span className="onboarding-step">{index + 1}</span>
          <span><b>{t(action.label)}</b><small>{t(action.description)}</small></span>
          <span aria-hidden="true">↗</span>
        </button>)}
      </div>
      <button type="button" className="onboarding-dismiss" onClick={onDismiss}>{t("Got it, let’s go")}</button>
    </section>
  </div>;
}
