const ALIASES: Record<string, string> = {
  js: 'javascript',
  ecmascript: 'javascript',
  ts: 'typescript',
  node: 'nodejs',
  nodejs: 'nodejs',
  'node js': 'nodejs',
  reactjs: 'react',
  'react js': 'react',
  nextjs: 'next',
  'next js': 'next',
  vuejs: 'vue',
  postgres: 'postgresql',
  psql: 'postgresql',
  mongo: 'mongodb',
  k8s: 'kubernetes',
  'amazon web services': 'aws',
  'google cloud': 'gcp',
  'google cloud platform': 'gcp',
  azure: 'microsoft azure',
  golang: 'go',
  'c sharp': 'c#',
  csharp: 'c#',
  py: 'python',
  ml: 'machine learning',
  ai: 'artificial intelligence',
  llm: 'large language models',
  llms: 'large language models',
  'ci cd': 'cicd',
  'continuous integration': 'cicd',
  tf: 'terraform',
  'rest api': 'rest',
  'restful apis': 'rest',
  'rest apis': 'rest',
  restful: 'rest',
  gql: 'graphql',
};

export function normalizeSkill(skill: string): string {
  const base = skill
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\.js\b/g, 'js')
    .replace(/[^a-z0-9#+ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return ALIASES[base] ?? ALIASES[base.replace(/ /g, '')] ?? base;
}

export function dedupeSkills(skills: string[]): string[] {
  const seen = new Map<string, string>();
  for (const s of skills) {
    const key = normalizeSkill(s);
    if (key && !seen.has(key)) seen.set(key, s.trim());
  }
  return [...seen.values()];
}
