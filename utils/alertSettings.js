export const ALERT_MODES = ['disabled', 'summary', 'alert', 'ping'];

export const MODE_META = {
  disabled: { icon: '⬜', label: 'Disabled' },
  summary: { icon: '🟨', label: 'Summary only' },
  alert: { icon: '🔴', label: 'Mod alert' },
  ping: { icon: '🚨', label: 'Alert + role ping' },
};

export const SENSITIVITY_PRESETS = {
  chill: '🟢 Chill Server',
  balanced: '🟡 Balanced',
  strict: '🔴 Strict Moderation',
  custom: '🛠 Custom',
};

export const ALERT_TREE = [
  {
    key: 'bigotry',
    label: 'Bigotry',
    description: 'Racism, homophobia, casteism, sexism, identity hate, slurs, and hostile generalizations.',
    subcategories: [
      { key: 'racism', label: 'Racism', leaves: ['slurs', 'stereotypes', 'targeted harassment', 'dehumanization / violence rhetoric'] },
      { key: 'homophobia', label: 'Homophobia', leaves: ['slurs', 'mockery', 'targeted harassment', 'dehumanization'] },
      { key: 'casteism', label: 'Casteism', leaves: ['caste slurs', 'caste superiority', 'targeted harassment', 'discrimination support'] },
      { key: 'sexism', label: 'Sexism', leaves: ['gendered insults', 'misogyny / misandry', 'targeted harassment', 'hostile generalizations'] },
      { key: 'transphobia', label: 'Transphobia', leaves: ['slurs', 'mockery', 'targeted harassment', 'dehumanization'] },
      { key: 'ableism', label: 'Ableism', leaves: ['slurs', 'mockery', 'targeted harassment', 'dehumanization'] },
      { key: 'religious_hate', label: 'Religious Hate', leaves: ['slurs', 'mockery', 'targeted harassment', 'dehumanization'] },
      { key: 'xenophobia', label: 'Xenophobia', leaves: ['slurs', 'stereotypes', 'targeted harassment', 'dehumanization'] },
    ],
  },
  {
    key: 'harassment',
    label: 'Harassment',
    description: 'Targeted insults, bullying, dogpiling, intimidation, and repeated personal attacks.',
    subcategories: [
      { key: 'targeted_insults', label: 'Targeted Insults', leaves: ['single insult', 'repeated insults', 'degrading language'] },
      { key: 'bullying', label: 'Bullying', leaves: ['mockery', 'pile-on behavior', 'social exclusion pressure'] },
      { key: 'dogpiling', label: 'Dogpiling', leaves: ['multi-user pressure', 'coordinated ridicule', 'repeated mentions'] },
      { key: 'intimidation', label: 'Intimidation', leaves: ['pressure to comply', 'fear-based language', 'threat-adjacent language'] },
    ],
  },
  {
    key: 'escalating_argument',
    label: 'Escalating Arguments',
    description: 'Long hostile debates, identity/politics/religion fights, dogpiles, and anti-group generalizations.',
    subcategories: [
      { key: 'political_fights', label: 'Political Fights', leaves: ['heated debate', 'hostile pile-on', 'ACAB-style escalation'] },
      { key: 'gender_war', label: 'Gender-war Arguments', leaves: ['all men / all women claims', 'hostile generalizations', 'prolonged argument'] },
      { key: 'religious_fights', label: 'Religious Fights', leaves: ['mockery', 'hostile debate', 'group generalizations'] },
      { key: 'identity_debates', label: 'Identity Debates', leaves: ['hostile identity debate', 'anti-group claims', 'prolonged pile-on'] },
      { key: 'long_hostile_thread', label: 'Long Hostile Thread', leaves: ['50+ message argument', '100+ message argument', '200+ message argument'] },
    ],
  },
  {
    key: 'nsfw_sexual',
    label: 'NSFW / Sexual Topics',
    description: 'Flirty banter is usually summary-only; harassment, coercion, sexual violence, and minor safety are actionable.',
    subcategories: [
      { key: 'flirty_banter', label: 'Flirty Banter', leaves: ['mild flirting', 'playful NSFW jokes', 'consensual banter'] },
      { key: 'explicit_discussion', label: 'Explicit Discussion', leaves: ['explicit jokes', 'explicit topic discussion', 'graphic sexual detail'] },
      { key: 'sexual_harassment', label: 'Sexual Harassment', leaves: ['unwanted sexual remarks', 'targeted sexual pressure', 'degrading sexual comments'] },
      { key: 'sexual_violence', label: 'Sexual Violence', leaves: ['sexual violence mention', 'coercion', 'threat/praise of sexual violence'] },
      { key: 'minor_safety', label: 'Minor Safety', leaves: ['sexualized minor mention', 'unsafe minor content', 'predatory implication'] },
    ],
  },
  {
    key: 'self_harm',
    label: 'Self-harm',
    description: 'Differentiate meme phrases from distress, plans, or imminent risk.',
    subcategories: [
      { key: 'joke_phrase', label: 'Joke / Meme Phrase', leaves: ['kms meme', 'kill me jokingly', 'casual exaggeration'] },
      { key: 'ambiguous_distress', label: 'Ambiguous Distress', leaves: ['sadness', 'hopeless phrasing', 'repeated dark comments'] },
      { key: 'clear_distress', label: 'Clear Distress', leaves: ['direct distress', 'help-seeking', 'serious self-harm mention'] },
      { key: 'imminent', label: 'Plan / Intent / Imminent', leaves: ['plan', 'timeline', 'method', 'immediate danger'] },
    ],
  },
  {
    key: 'violence',
    label: 'Violence / Threats',
    description: 'Playful threats are usually summary-only; targeted/credible threats need review.',
    subcategories: [
      { key: 'playful_threats', label: 'Playful Threats', leaves: ['gaming violence', 'banter threat', 'obvious joke'] },
      { key: 'targeted_threats', label: 'Targeted Threats', leaves: ['threat toward user', 'intimidating threat', 'repeated targeting'] },
      { key: 'credible_threats', label: 'Credible Threats', leaves: ['location-linked threat', 'real-world plan', 'urgent safety risk'] },
      { key: 'encouragement', label: 'Encouragement', leaves: ['encourage real violence', 'praise violent act', 'incitement'] },
      { key: 'graphic_violence', label: 'Graphic Violence', leaves: ['graphic description', 'gore-heavy detail', 'threatening graphic detail'] },
    ],
  },
  {
    key: 'doxxing_privacy',
    label: 'Doxxing / Privacy',
    description: 'Personal info sharing, location exposure, or threats to expose someone.',
    subcategories: [
      { key: 'personal_info', label: 'Personal Info', leaves: ['phone/email/address', 'private social info', 'real name exposure'] },
      { key: 'location_exposure', label: 'Location Exposure', leaves: ['address/location', 'school/workplace', 'tracking implication'] },
      { key: 'threat_to_expose', label: 'Threat to Expose', leaves: ['blackmail', 'leak threat', 'dox threat'] },
      { key: 'impersonation', label: 'Impersonation', leaves: ['fake identity', 'account impersonation', 'identity misuse'] },
    ],
  },
  {
    key: 'scam_phishing',
    label: 'Scam / Phishing',
    description: 'Suspicious links, Nitro/crypto scams, malware, and impersonation attempts.',
    subcategories: [
      { key: 'suspicious_links', label: 'Suspicious Links', leaves: ['unknown shortlink', 'credential request', 'suspicious attachment'] },
      { key: 'fake_nitro', label: 'Fake Nitro', leaves: ['free Nitro bait', 'gift link scam', 'Discord login bait'] },
      { key: 'crypto_scam', label: 'Crypto Scam', leaves: ['pump bait', 'wallet drain', 'investment scam'] },
      { key: 'malware', label: 'Malware', leaves: ['download bait', 'token grabber', 'malicious file'] },
    ],
  },
  {
    key: 'spam_raid',
    label: 'Spam / Raid',
    description: 'Flooding, mass mentions, copypasta, and suspicious raid behavior.',
    subcategories: [
      { key: 'repeated_spam', label: 'Repeated Spam', leaves: ['fast repeated posts', 'duplicate content', 'channel flooding'] },
      { key: 'mass_mentions', label: 'Mass Mentions', leaves: ['many user mentions', 'role mention spam', 'everyone/here abuse'] },
      { key: 'copypasta', label: 'Copypasta Flood', leaves: ['copy-paste spam', 'wall of repeated text', 'chain spam'] },
      { key: 'raid_pattern', label: 'Raid Pattern', leaves: ['multi-user burst', 'new-account swarm', 'coordinated spam'] },
    ],
  },
];

export function leafKey(categoryKey, subKey, leafLabel) {
  return `${categoryKey}.${subKey}.${slug(leafLabel)}`;
}

export function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function allLeafDefinitions() {
  const out = [];
  for (const cat of ALERT_TREE) {
    for (const sub of cat.subcategories) {
      for (const leaf of sub.leaves) {
        out.push({
          key: leafKey(cat.key, sub.key, leaf),
          label: leaf,
          categoryKey: cat.key,
          categoryLabel: cat.label,
          subKey: sub.key,
          subLabel: sub.label,
        });
      }
    }
  }
  return out;
}

export function makeDefaultAlertSettings(preset = 'balanced') {
  const modes = {};
  for (const leaf of allLeafDefinitions()) {
    modes[leaf.key] = defaultModeForLeaf(leaf, preset);
  }
  return {
    sensitivity: preset,
    cooldownMinutes: 30,
    modes,
  };
}

function defaultModeForLeaf(leaf, preset) {
  const k = leaf.key;
  if (preset === 'strict') {
    if (k.includes('flirty_banter') || k.includes('joke_phrase') || k.includes('playful_threats')) return 'summary';
    if (k.includes('minor_safety') || k.includes('imminent') || k.includes('credible_threats') || k.includes('doxxing_privacy')) return 'ping';
    return 'alert';
  }
  if (preset === 'chill') {
    if (k.includes('flirty_banter') || k.includes('explicit_discussion') || k.includes('joke_phrase') || k.includes('playful_threats')) return 'summary';
    if (k.includes('minor_safety') || k.includes('imminent') || k.includes('credible_threats') || k.includes('threat_to_expose') || k.includes('malware')) return 'ping';
    if (k.includes('bigotry') || k.includes('harassment') || k.includes('targeted_threats') || k.includes('sexual_harassment') || k.includes('sexual_violence') || k.includes('doxxing_privacy') || k.includes('scam_phishing')) return 'alert';
    if (k.includes('escalating_argument')) return 'summary';
    return 'disabled';
  }
  // balanced
  if (k.includes('flirty_banter') || k.includes('joke_phrase') || k.includes('playful_threats')) return 'summary';
  if (k.includes('minor_safety') || k.includes('imminent') || k.includes('credible_threats') || k.includes('sexual_violence') || k.includes('threat_to_expose')) return 'ping';
  if (k.includes('bigotry') || k.includes('harassment') || k.includes('escalating_argument') || k.includes('sexual_harassment') || k.includes('targeted_threats') || k.includes('doxxing_privacy') || k.includes('scam_phishing')) return 'alert';
  if (k.includes('explicit_discussion') || k.includes('ambiguous_distress') || k.includes('clear_distress') || k.includes('graphic_violence') || k.includes('spam_raid')) return 'summary';
  return 'disabled';
}

export function normalizeAlertSettings(raw) {
  const base = makeDefaultAlertSettings(raw?.sensitivity && raw.sensitivity !== 'custom' ? raw.sensitivity : 'balanced');
  const incoming = raw && typeof raw === 'object' ? raw : {};
  const modes = { ...base.modes };
  if (incoming.modes && typeof incoming.modes === 'object') {
    for (const leaf of allLeafDefinitions()) {
      const v = incoming.modes[leaf.key];
      if (ALERT_MODES.includes(v)) modes[leaf.key] = v;
    }
  }
  return {
    sensitivity: Object.keys(SENSITIVITY_PRESETS).includes(incoming.sensitivity) ? incoming.sensitivity : 'balanced',
    cooldownMinutes: Number.isFinite(parseInt(incoming.cooldownMinutes, 10)) ? Math.max(0, Math.min(360, parseInt(incoming.cooldownMinutes, 10))) : 30,
    modes,
  };
}

export function getCategory(categoryKey) {
  return ALERT_TREE.find((c) => c.key === categoryKey) || ALERT_TREE[0];
}

export function getSubcategory(categoryKey, subKey) {
  const cat = getCategory(categoryKey);
  return cat.subcategories.find((s) => s.key === subKey) || cat.subcategories[0];
}

export function setCategoryMode(settings, categoryKey, mode) {
  const next = normalizeAlertSettings(settings);
  const cat = getCategory(categoryKey);
  for (const sub of cat.subcategories) for (const leaf of sub.leaves) next.modes[leafKey(cat.key, sub.key, leaf)] = mode;
  next.sensitivity = 'custom';
  return next;
}

export function setSubcategoryMode(settings, categoryKey, subKey, mode) {
  const next = normalizeAlertSettings(settings);
  const cat = getCategory(categoryKey);
  const sub = getSubcategory(categoryKey, subKey);
  for (const leaf of sub.leaves) next.modes[leafKey(cat.key, sub.key, leaf)] = mode;
  next.sensitivity = 'custom';
  return next;
}

export function cycleLeafMode(settings, leafKeys) {
  const next = normalizeAlertSettings(settings);
  for (const key of leafKeys) {
    const current = ALERT_MODES.includes(next.modes[key]) ? next.modes[key] : 'disabled';
    next.modes[key] = ALERT_MODES[(ALERT_MODES.indexOf(current) + 1) % ALERT_MODES.length];
  }
  next.sensitivity = 'custom';
  return next;
}

export function applyPreset(preset) {
  return makeDefaultAlertSettings(preset);
}

export function categoryModeSummary(settings, categoryKey) {
  const s = normalizeAlertSettings(settings);
  const cat = getCategory(categoryKey);
  const counts = { disabled: 0, summary: 0, alert: 0, ping: 0 };
  for (const sub of cat.subcategories) for (const leaf of sub.leaves) counts[s.modes[leafKey(cat.key, sub.key, leaf)] || 'disabled']++;
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'disabled';
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return `${MODE_META[dominant].icon} ${counts.disabled}/${counts.summary}/${counts.alert}/${counts.ping} (off/summary/alert/ping, ${total} rules)`;
}

export function enabledLeafPrompts(settings, minModes = ['summary', 'alert', 'ping']) {
  const s = normalizeAlertSettings(settings);
  return allLeafDefinitions()
    .filter((leaf) => minModes.includes(s.modes[leaf.key]))
    .map((leaf) => ({ ...leaf, mode: s.modes[leaf.key] }));
}
