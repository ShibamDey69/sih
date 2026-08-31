export const extractEntitiesFromText = (rawText = '') => {
  if (!rawText || typeof rawText !== 'string') {
    return {
      legalSections: [],
      firNumbers: [],
      policeStations: [],
      dates: [],
      accusedPersons: [],
      complainants: [],
      investigatingOfficers: [],
      seizedArticles: [],
    };
  }

  const text = rawText.trim();

  const ipcMatches = text.match(/(?:(?:Section|Sec\.?|u\/s|U\/S)\s*)?(\d+[A-Z]?(?:\(\d+\))?)\s*(?:of\s+)?(?:IPC|Indian\s+Penal\s+Code)/gi) || [];
  const ipcDirect = text.match(/IPC\s*(?:Section|Sec\.?)?\s*(\d+[A-Z]?(?:\(\d+\))?)/gi) || [];
  const bnsMatches = text.match(/(?:(?:Section|Sec\.?|u\/s|U\/S)\s*)?(\d+[A-Z]?(?:\(\d+\))?)\s*(?:of\s+)?(?:BNS|Bharatiya\s+Nyaya\s+Sanhita)/gi) || [];
  const bnsDirect = text.match(/BNS\s*(?:Section|Sec\.?)?\s*(\d+[A-Z]?(?:\(\d+\))?)/gi) || [];
  const otherActs = text.match(/(?:NDPS|Arms\s+Act|IT\s+Act|POCSO|Prevention\s+of\s+Corruption\s+Act|CrPC|BNSS|BSA)\s*(?:Section|Sec\.?)?\s*(\d+[A-Z]?(?:\(\d+\))?)/gi) || [];

  const rawSections = [...ipcMatches, ...ipcDirect, ...bnsMatches, ...bnsDirect, ...otherActs];
  const cleanSections = Array.from(new Set(rawSections.map(s => s.trim().toUpperCase())));

  const firMatches = text.match(/(?:FIR\s*No\.?|Crime\s*No\.?|Case\s*No\.?)\s*[:.-]?\s*([A-Za-z0-9\/-]+)/gi) || [];
  const cleanFirs = Array.from(new Set(firMatches.map(f => f.trim())));

  const psMatches = text.match(/(?:Police\s+Station|P\.S\.|PS)\s*[:.-]?\s*([A-Za-z\s]+?)(?:,|\.|\n|District|Dist|City)/gi) || [];
  const cleanPS = Array.from(new Set(psMatches.map(p => p.replace(/(?:Police\s+Station|P\.S\.|PS)\s*[:.-]?\s*/i, '').trim()).filter(Boolean)));

  const datePatterns = [
    /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/g,
    /\b\d{4}-\d{1,2}-\d{1,2}\b/g,
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
    /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b/gi,
  ];
  let rawDates = [];
  datePatterns.forEach(pattern => {
    const m = text.match(pattern);
    if (m) rawDates.push(...m);
  });
  const cleanDates = Array.from(new Set(rawDates.map(d => d.trim())));

  const accusedMatches = text.match(/(?:Accused|Suspect|Perpetrator)\s*[:.-]?\s*([A-Za-z\s\.]+?)(?:,|\.|\n|S\/o|D\/o|W\/o|Age|Resident)/gi) || [];
  const cleanAccused = Array.from(new Set(accusedMatches.map(a => a.replace(/(?:Accused|Suspect|Perpetrator)\s*[:.-]?\s*/i, '').trim()).filter(Boolean)));

  const complainantMatches = text.match(/(?:Complainant|Informant|Victim)\s*[:.-]?\s*([A-Za-z\s\.]+?)(?:,|\.|\n|S\/o|D\/o|W\/o|Age|Resident)/gi) || [];
  const cleanComplainants = Array.from(new Set(complainantMatches.map(c => c.replace(/(?:Complainant|Informant|Victim)\s*[:.-]?\s*/i, '').trim()).filter(Boolean)));

  const ioMatches = text.match(/(?:Investigating\s+Officer|I\.O\.|IO|Inspector|Sub-Inspector|SI)\s*[:.-]?\s*([A-Za-z\s\.]+?)(?:,|\.|\n|Badge|Belt|Station)/gi) || [];
  const cleanIOs = Array.from(new Set(ioMatches.map(io => io.replace(/(?:Investigating\s+Officer|I\.O\.|IO|Inspector|Sub-Inspector|SI)\s*[:.-]?\s*/i, '').trim()).filter(Boolean)));

  const seizedMatches = text.match(/(?:Seized\s+Articles?|Recovered\s+Items?|Evidence\s+Seized)\s*[:.-]?\s*([^\n\.]+)/gi) || [];
  const cleanSeized = Array.from(new Set(seizedMatches.map(s => s.replace(/(?:Seized\s+Articles?|Recovered\s+Items?|Evidence\s+Seized)\s*[:.-]?\s*/i, '').trim()).filter(Boolean)));

  return {
    legalSections: cleanSections,
    firNumbers: cleanFirs,
    policeStations: cleanPS,
    dates: cleanDates,
    accusedPersons: cleanAccused,
    complainants: cleanComplainants,
    investigatingOfficers: cleanIOs,
    seizedArticles: cleanSeized,
  };
};
