
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'AI & ML': [
    'ai', 'machine learning', 'deep learning', 'neural', 'gpt', 'llm', 'openai',
    'claude', 'model', 'intelligence', 'ml', 'artificial', 'genai', 'training data',
    'prompt', 'transformer', 'nvidia', 'cuda', 'tensorflow', 'pytorch',
  ],
  'Frontend': [
    'frontend', 'front-end', 'react', 'next.js', 'nextjs', 'vue', 'angular', 'svelte',
    'css', 'html', 'javascript', 'typescript', 'js', 'ts', 'ui', 'ux', 'tailwind',
    'web design', 'vite', 'component',
  ],
  'Backend': [
    'backend', 'back-end', 'api', 'server', 'node', 'express', 'fastify', 'microservice',
    'graphql', 'rest', 'go', 'golang', 'python', 'django', 'flask', 'spring', 'java',
    'endpoint', 'runtime', 'function', 'socket',
  ],
  'Systems': [
    'rust', 'c++', 'c plus plus', 'systems', 'kernel', 'memory', 'embedded',
    'low-level', 'low level', 'concurrency', 'assembly', 'operating system',
    'performance', 'compiler', 'distributed', 'hardware', 'os',
  ],
  'Security': [
    'security', 'cybersecurity', 'hacking', 'hacker', 'vulnerability', 'exploit',
    'encryption', 'auth', 'oauth', 'jwt', 'xss', 'sql injection', 'malware',
    'privacy', 'zero trust', 'penetration', 'breach', 'ransomware', 'firewall',
  ],
  'DevOps': [
    'devops', 'docker', 'kubernetes', 'k8s', 'ci/cd', 'jenkins', 'github actions',
    'terraform', 'ansible', 'cloud native', 'sre', 'deployment', 'pipeline',
    'gitops', 'monitoring', 'observability', 'infrastructure as code',
  ],
  'Databases': [
    'database', 'postgres', 'postgresql', 'sql', 'nosql', 'mongodb', 'redis',
    'mysql', 'sqlite', 'drizzle', 'prisma', 'orm', 'indexing', 'query', 'db',
    'cassandra', 'data modeling', 'replica', 'sharding',
  ],
  'Cloud': [
    'aws', 'azure', 'gcp', 'google cloud', 'cloud', 'serverless', 'lambda', 'ec2',
    's3', 'cloudflare', 'vercel', 'netlify', 'infrastructure', 'vps', 'heroku',
    'kubernetes', 'orchestration', 'container', 'containers', 'containerization',
    'docker',
  ],
  'Mobile': [
    'mobile', 'ios', 'android', 'swift', 'kotlin', 'flutter', 'react native',
    'app store', 'sdk',
  ],
  'Startups': [
    'startup', 'start-up', 'venture', 'funding', 'vc', 'founder', 'launch',
    'product', 'pitch', 'saas',
  ],
};


/**
 * Returns the list of categories a content belongs to. Generous matching:
 * any keyword hit in the title or summary adds that category. Falls back to
 * 'General' when nothing matches so every content still gets a category.
 */
const patterns = new Map<string, RegExp>();

/** Whole-word match. A plain substring test labelled "The Capital Cost of Nuclear
 *  Power" as an API/AI topic ("c-api-tal"), which polluted every personalised feed. */
function hasWord(haystack: string, keyword: string): boolean {
  const kw = keyword.toLowerCase();
  let re = patterns.get(kw);
  if (!re) {
    re = new RegExp(`(^|[^a-z0-9+#])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9+#])`, 'i');
    patterns.set(kw, re);
  }
  return re.test(haystack);
}

export function classifyContent(title: string, summary?: string | null): string[] {
  const haystack = `${title} ${summary || ''}`.toLowerCase();
  const hits = new Set<string>();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => hasWord(haystack, kw))) {
      hits.add(category);
    }
  }

  // Nothing specific matched: every content still gets a category.
  if (hits.size === 0) {
    hits.add('General');
  }

  return Array.from(hits);
}
