const adjectives = [
  "luminous",
  "quiet",
  "amber",
  "velvet",
  "silver",
  "golden",
  "misty",
  "crystal",
  "wild",
  "gentle",
  "midnight",
  "solar",
  "pale",
  "deep",
  "bright",
  "soft",
  "ancient",
  "vivid",
  "calm",
  "electric",
];

const nouns = [
  "dawn",
  "harbor",
  "moss",
  "river",
  "ember",
  "cedar",
  "horizon",
  "linen",
  "dusk",
  "coral",
  "willow",
  "frost",
  "canyon",
  "pearl",
  "orchid",
  "storm",
  "meadow",
  "ink",
  "saffron",
  "tide",
];

function pick(words: string[]): string {
  return words[Math.floor(Math.random() * words.length)] ?? words[0]!;
}

export function randomRampName(taken: Iterable<string>): string {
  const used = new Set([...taken].map((name) => name.trim().toLowerCase()));
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const name = `${pick(adjectives)} ${pick(nouns)}`;
    if (!used.has(name)) return name;
  }
  return `${pick(adjectives)} ${pick(nouns)} ${Math.floor(Math.random() * 90 + 10)}`;
}
