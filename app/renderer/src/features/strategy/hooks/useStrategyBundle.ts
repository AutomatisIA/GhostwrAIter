import { useEffect, useState } from "react";
import type { StrategyBundleInput } from "@shared/schemas/strategy";
import { useToast } from "../../../feedback/toast-context";

const emptyBundle: StrategyBundleInput = {
  profile: {
    name: "",
    positioning: "",
    bio: "",
    expertiseSummary: ""
  },
  offers: [],
  icps: [],
  pillars: [],
  voiceRules: []
};

export function createEmptyOffer() {
  return {
    name: "",
    promise: "",
    problems: "",
    proofPoints: "",
    ctaModes: ""
  };
}

export function createEmptyIcp() {
  return {
    segment: "",
    pains: "",
    objections: "",
    desiredOutcomes: "",
    languageCues: "",
    linkedinBehavior: ""
  };
}

export function createEmptyPillar(position: number) {
  return {
    label: "",
    description: "",
    position,
    isDefault: position === 0
  };
}

export function createEmptyVoiceRule() {
  return {
    category: "",
    ruleText: "",
    ruleType: "anti_style" as const
  };
}

export function useStrategyBundle() {
  const toast = useToast();
  const [bundle, setBundle] = useState<StrategyBundleInput>(emptyBundle);
  const [loading, setLoading] = useState(true);
  const [foundationSummary, setFoundationSummary] = useState("");
  const [foundationOutdated, setFoundationOutdated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    window.linkedinPoster.settings
      .getPreference("foundation_summary")
      .then((pref) => {
        if (!isMounted) return;
        if (pref.value) setFoundationSummary(pref.value);
      })
      .catch(() => {});

    window.linkedinPoster.strategy
      .getActiveBundle()
      .then((result) => {
        if (!isMounted) return;
        setBundle({
          profile: {
            name: result.profile.name,
            positioning: result.profile.positioning,
            bio: result.profile.bio ?? "",
            expertiseSummary: result.profile.expertiseSummary ?? ""
          },
          offers: result.offers.map((offer) => ({
            name: offer.name,
            promise: offer.promise,
            problems: offer.problems,
            proofPoints: offer.proofPoints ?? "",
            ctaModes: offer.ctaModes ?? ""
          })),
          icps: result.icps.map((icp) => ({
            segment: icp.segment,
            pains: icp.pains,
            objections: icp.objections ?? "",
            desiredOutcomes: icp.desiredOutcomes ?? "",
            languageCues: icp.languageCues ?? "",
            linkedinBehavior: icp.linkedinBehavior ?? ""
          })),
          pillars: result.pillars.map((pillar, index) => ({
            label: pillar.label,
            description: pillar.description ?? "",
            position: pillar.position ?? index,
            isDefault: pillar.isDefault ?? index === 0
          })),
          voiceRules: result.voiceRules.map((rule) => ({
            category: rule.category,
            ruleText: rule.ruleText,
            ruleType: rule.ruleType
          }))
        });
      })
      .catch(() => {
        // Aucune strategie active n'est pas une erreur : on garde le bundle vide.
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function updateProfileField(
    field: keyof StrategyBundleInput["profile"],
    value: string
  ) {
    setBundle((current) => ({
      ...current,
      profile: { ...current.profile, [field]: value }
    }));
  }

  function updateOfferField(
    index: number,
    field: keyof StrategyBundleInput["offers"][number],
    value: string
  ) {
    setBundle((current) => ({
      ...current,
      offers: current.offers.map((offer, currentIndex) =>
        currentIndex === index ? { ...offer, [field]: value } : offer
      )
    }));
  }

  function updateIcpField(
    index: number,
    field: keyof StrategyBundleInput["icps"][number],
    value: string
  ) {
    setBundle((current) => ({
      ...current,
      icps: current.icps.map((icp, currentIndex) =>
        currentIndex === index ? { ...icp, [field]: value } : icp
      )
    }));
  }

  function updatePillarField(
    index: number,
    field: keyof StrategyBundleInput["pillars"][number],
    value: string | boolean
  ) {
    setBundle((current) => ({
      ...current,
      pillars: current.pillars.map((pillar, currentIndex) =>
        currentIndex === index ? { ...pillar, [field]: value } : pillar
      )
    }));
  }

  function updateVoiceRuleField(
    index: number,
    field: keyof StrategyBundleInput["voiceRules"][number],
    value: string
  ) {
    setBundle((current) => ({
      ...current,
      voiceRules: current.voiceRules.map((rule, currentIndex) =>
        currentIndex === index ? { ...rule, [field]: value } : rule
      )
    }));
  }

  function addOffer() {
    setBundle((current) => ({
      ...current,
      offers: [...current.offers, createEmptyOffer()]
    }));
  }

  function addIcp() {
    setBundle((current) => ({
      ...current,
      icps: [...current.icps, createEmptyIcp()]
    }));
  }

  function addPillar() {
    setBundle((current) => ({
      ...current,
      pillars: [...current.pillars, createEmptyPillar(current.pillars.length)]
    }));
  }

  function addVoiceRule() {
    setBundle((current) => ({
      ...current,
      voiceRules: [...current.voiceRules, createEmptyVoiceRule()]
    }));
  }

  function removeOffer(index: number) {
    setBundle((current) => ({
      ...current,
      offers: current.offers.filter((_, currentIndex) => currentIndex !== index)
    }));
  }

  function removeIcp(index: number) {
    setBundle((current) => ({
      ...current,
      icps: current.icps.filter((_, currentIndex) => currentIndex !== index)
    }));
  }

  function removePillar(index: number) {
    setBundle((current) => ({
      ...current,
      pillars: current.pillars
        .filter((_, currentIndex) => currentIndex !== index)
        .map((pillar, currentIndex) => ({
          ...pillar,
          position: currentIndex,
          isDefault: current.pillars[index]?.isDefault ? currentIndex === 0 : pillar.isDefault
        }))
    }));
  }

  function removeVoiceRule(index: number) {
    setBundle((current) => ({
      ...current,
      voiceRules: current.voiceRules.filter((_, currentIndex) => currentIndex !== index)
    }));
  }

  /**
   * Rend `true` quand l enregistrement a abouti.
   *
   * L erreur reste absorbee ici, avec son toast, mais le VERDICT remonte :
   * l ecran posait sinon « Enregistré à HH:MM » sur un echec, a cote du toast
   * qui disait le contraire.
   */
  async function saveBundle(): Promise<boolean> {
    const normalizedBundle: StrategyBundleInput = {
      ...bundle,
      pillars: bundle.pillars.map((pillar, index) => ({
        ...pillar,
        position: index
      }))
    };
    setSaving(true);
    try {
      await window.linkedinPoster.strategy.saveBundle(normalizedBundle);
      if (foundationSummary) setFoundationOutdated(true);
      toast.show({ kind: "success", message: "Stratégie enregistrée." });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast.show({
        kind: "error",
        message: `Échec de l'enregistrement de la stratégie : ${message}`
      });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function generateFoundation() {
    setGenerating(true);
    try {
      const result = await window.linkedinPoster.strategy.generateFoundation();
      setFoundationSummary(result.summaryMarkdown);
      setFoundationOutdated(false);
      await window.linkedinPoster.settings.setPreference("foundation_summary", result.summaryMarkdown);
      toast.show({ kind: "success", message: "Socle éditorial généré." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast.show({
        kind: "error",
        message: `Échec de la génération du socle éditorial : ${message}`
      });
    } finally {
      setGenerating(false);
    }
  }

  function updateFoundationSummary(value: string) {
    setFoundationSummary(value);
    window.linkedinPoster.settings.setPreference("foundation_summary", value).catch(() => {});
  }

  return {
    bundle,
    loading,
    saving,
    generating,
    foundationSummary,
    foundationOutdated,
    setFoundationSummary: updateFoundationSummary,
    updateProfileField,
    updateOfferField,
    updateIcpField,
    updatePillarField,
    updateVoiceRuleField,
    addOffer,
    addIcp,
    addPillar,
    addVoiceRule,
    removeOffer,
    removeIcp,
    removePillar,
    removeVoiceRule,
    saveBundle,
    generateFoundation
  };
}
