/* The curriculum skeletons. A path is built from these, then each slot is filled
   with the best matching resources already in the catalogue. Stage order follows
   how the subject is actually learned; `from`/`to` (levels 0-3: beginner, basics,
   intermediate, advanced) decide which stages a learner at each level still needs. */

export const GOALS = ['frontend', 'backend', 'fullstack', 'data-ai', 'devops', 'security', 'systems'] as const;
export const LEVELS = ['beginner', 'basics', 'intermediate', 'advanced'] as const;
export const STYLES = ['videos', 'reading', 'practice', 'mixed'] as const;
export const LANGUAGES = ['JavaScript', 'TypeScript', 'Python', 'Rust', 'Go', 'Java', 'C++', 'C#', 'SQL'] as const;

export type Goal = (typeof GOALS)[number];
export type Level = (typeof LEVELS)[number];
export type Style = (typeof STYLES)[number];

export type SlotType = 'roadmap' | 'course' | 'video' | 'doc' | 'exercise' | 'repo' | 'paper' | 'question' | 'opportunity';

export interface Slot {
  type: SlotType;
  /** Matched against title (strong), summary, categories and tags. "$lang" expands to the learner's languages. */
  terms: string[];
  count: number;
  /** A resource must match at least one of these, whatever else it matches (a project's main topics). */
  must?: string[];
}

export interface StageTemplate {
  title: string;
  objective: string;
  /** Relative share of the learner's time. */
  weight: number;
  /** Levels (0-3) for which this stage is part of the path. */
  from: number;
  to: number;
  slots: Slot[];
}

const FOUNDATIONS_EXERCISES: Slot = { type: 'exercise', terms: [], count: 4 };

export const GOAL_TITLES: Record<Goal, string> = {
  frontend: 'Front-end development',
  backend: 'Back-end development',
  fullstack: 'Full-stack development',
  'data-ai': 'Data science and AI',
  devops: 'DevOps and cloud',
  security: 'Cybersecurity',
  systems: 'Systems programming',
};

/** Default languages when the learner did not pick any. */
export const DEFAULT_LANGUAGES: Record<Goal, string[]> = {
  frontend: ['JavaScript', 'TypeScript'],
  backend: ['TypeScript', 'Python'],
  fullstack: ['TypeScript'],
  'data-ai': ['Python'],
  devops: ['Python'],
  security: ['Python'],
  systems: ['Rust'],
};

const PROBLEM_SOLVING: StageTemplate = {
  title: 'Problem solving and algorithms',
  objective: 'Turn ideas into working code under constraints: data structures, complexity and the habit of practising a little every day.',
  weight: 2,
  from: 0,
  to: 3,
  slots: [
    { type: 'roadmap', terms: ['datastructures', 'algorithms'], count: 1 },
    { type: 'course', terms: ['algorithms', 'data structures'], count: 1 },
    { type: 'video', terms: ['algorithms', 'data structures', 'cs50', 'leetcode', 'neetcode'], count: 2 },
    { type: 'exercise', terms: [], count: 6 },
  ],
};

const CONTRIBUTE: StageTemplate = {
  title: 'Build and contribute',
  objective: 'Read real projects, then change one: a first contribution to open source is the proof that you can work in a real codebase.',
  weight: 2,
  from: 0,
  to: 3,
  slots: [
    { type: 'repo', terms: ['$lang'], count: 3 },
    { type: 'opportunity', terms: [], count: 2 },
    { type: 'question', terms: ['$lang'], count: 2 },
  ],
};

export const TEMPLATES: Record<Goal, StageTemplate[]> = {
  frontend: [
    {
      title: 'How the web works, HTML and CSS',
      objective: 'Understand what happens when a page loads, then structure content with HTML and style it with modern CSS (layout, responsive design).',
      weight: 3, from: 0, to: 1,
      slots: [
        { type: 'roadmap', terms: ['frontend', 'html', 'css'], count: 1 },
        { type: 'course', terms: ['html', 'css', 'responsive', 'web design', 'foundations'], count: 2 },
        { type: 'doc', terms: ['html', 'css', 'flexbox', 'grid', 'layout'], count: 3 },
        { type: 'video', terms: ['html', 'css', 'web development'], count: 1 },
        FOUNDATIONS_EXERCISES,
      ],
    },
    {
      title: 'JavaScript, properly',
      objective: 'The language of the web: types, functions, objects, asynchronous code and the browser APIs you will use every day.',
      weight: 4, from: 0, to: 2,
      slots: [
        { type: 'roadmap', terms: ['javascript'], count: 1 },
        { type: 'course', terms: ['javascript', 'async', 'functions', 'objects'], count: 2 },
        { type: 'doc', terms: ['javascript', 'promise', 'fetch', 'async'], count: 3 },
        { type: 'video', terms: ['javascript', 'fireship'], count: 2 },
        { type: 'exercise', terms: ['$lang', 'strings', 'arrays', 'fundamentals'], count: 5 },
      ],
    },
    {
      title: 'Tooling and TypeScript',
      objective: 'Work like a professional: Git, the command line, packages, and TypeScript to catch mistakes before your users do.',
      weight: 2, from: 0, to: 2,
      slots: [
        { type: 'roadmap', terms: ['typescript', 'git'], count: 1 },
        { type: 'course', terms: ['git', 'typescript', 'bash', 'command line'], count: 2 },
        { type: 'video', terms: ['typescript', 'git'], count: 1 },
        { type: 'question', terms: ['typescript', 'git'], count: 2 },
      ],
    },
    {
      title: 'A framework: React',
      objective: 'Build interfaces from components, manage state and data, and structure a real application.',
      weight: 4, from: 0, to: 3,
      slots: [
        { type: 'roadmap', terms: ['react'], count: 1 },
        { type: 'course', terms: ['react', 'front end libraries', 'libraries'], count: 1 },
        { type: 'video', terms: ['react', 'next.js', 'fireship'], count: 2 },
        { type: 'repo', terms: ['react', 'next', 'typescript'], count: 2 },
        { type: 'question', terms: ['react'], count: 2 },
      ],
    },
    {
      title: 'Quality: accessibility, performance and testing',
      objective: 'Make it usable by everyone, fast on a bad connection, and safe to change.',
      weight: 2, from: 1, to: 3,
      slots: [
        { type: 'roadmap', terms: ['qa', 'frontend'], count: 1 },
        { type: 'doc', terms: ['accessibility', 'caching', 'service workers', 'web components'], count: 4 },
        { type: 'video', terms: ['performance', 'testing', 'accessibility'], count: 1 },
      ],
    },
    PROBLEM_SOLVING,
    CONTRIBUTE,
  ],
  backend: [
    {
      title: 'Programming fundamentals',
      objective: 'Variables, control flow, functions and data structures in your first language, until writing small programs feels natural.',
      weight: 4, from: 0, to: 1,
      slots: [
        { type: 'roadmap', terms: ['backend-beginner', 'backend', '$lang'], count: 1 },
        { type: 'course', terms: ['$lang', 'python basics', 'javascript', 'introduction to'], count: 2 },
        { type: 'video', terms: ['$lang', 'programming'], count: 2 },
        { type: 'exercise', terms: ['$lang', 'fundamentals', 'strings'], count: 6 },
      ],
    },
    {
      title: 'The web, HTTP and APIs',
      objective: 'How clients and servers talk: HTTP, REST, JSON, status codes, and how to design an API others enjoy using.',
      weight: 3, from: 0, to: 2,
      slots: [
        { type: 'roadmap', terms: ['api-design', 'backend'], count: 1 },
        { type: 'doc', terms: ['http', 'fetch', 'caching', 'cors', 'api'], count: 4 },
        { type: 'course', terms: ['back end', 'apis', 'node', 'express'], count: 1 },
        { type: 'video', terms: ['api', 'rest', 'node', 'http'], count: 1 },
      ],
    },
    {
      title: 'Databases and SQL',
      objective: 'Model data, query it with SQL, understand indexes and transactions, and know when a relational database is the right tool.',
      weight: 4, from: 0, to: 3,
      slots: [
        { type: 'roadmap', terms: ['sql', 'postgresql'], count: 1 },
        { type: 'course', terms: ['sql', 'postgresql', 'relational database'], count: 2 },
        { type: 'video', terms: ['sql', 'database', 'postgres'], count: 1 },
        { type: 'question', terms: ['sql', 'postgresql'], count: 2 },
        { type: 'paper', terms: ['database', 'query'], count: 1 },
      ],
    },
    {
      title: 'Security and authentication',
      objective: 'Protect users and data: passwords, sessions and tokens, and the common web vulnerabilities.',
      weight: 2, from: 1, to: 3,
      slots: [
        { type: 'roadmap', terms: ['cyber-security', 'api-design'], count: 1 },
        { type: 'doc', terms: ['security', 'cookies', 'csp', 'cors', 'authentication'], count: 3 },
        { type: 'course', terms: ['information security', 'security'], count: 1 },
        { type: 'question', terms: ['security', 'authentication', 'jwt', 'injection'], count: 2 },
      ],
    },
    {
      title: 'Architecture, testing and deployment',
      objective: 'Structure a service so it can grow, prove that it works, and ship it with Docker and a pipeline.',
      weight: 3, from: 1, to: 3,
      slots: [
        { type: 'roadmap', terms: ['software-architect', 'docker', 'system-design'], count: 2 },
        { type: 'course', terms: ['docker', 'git', 'quality assurance', 'testing'], count: 1 },
        { type: 'video', terms: ['docker', 'system design', 'architecture', 'microservices'], count: 2 },
        { type: 'repo', terms: ['backend', 'api', 'fastify', 'express', 'django'], count: 2 },
      ],
    },
    PROBLEM_SOLVING,
    CONTRIBUTE,
  ],
  fullstack: [
    {
      title: 'The web: HTML, CSS and JavaScript',
      objective: 'The three languages of the browser, from a first page to interactive, responsive interfaces.',
      weight: 5, from: 0, to: 1,
      slots: [
        { type: 'roadmap', terms: ['full-stack', 'frontend-beginner'], count: 1 },
        { type: 'course', terms: ['html', 'css', 'javascript', 'foundations', 'full stack'], count: 3 },
        { type: 'doc', terms: ['html', 'css', 'javascript', 'flexbox'], count: 3 },
        { type: 'video', terms: ['html', 'css', 'javascript', 'cs50'], count: 2 },
        { type: 'exercise', terms: ['$lang', 'strings', 'fundamentals'], count: 5 },
      ],
    },
    {
      title: 'TypeScript, Git and the command line',
      objective: 'The toolbox of a working developer.',
      weight: 2, from: 0, to: 2,
      slots: [
        { type: 'roadmap', terms: ['typescript', 'git'], count: 1 },
        { type: 'course', terms: ['git', 'typescript', 'bash'], count: 2 },
        { type: 'video', terms: ['typescript', 'git'], count: 1 },
      ],
    },
    {
      title: 'A front-end framework: React',
      objective: 'Components, state and data fetching: build the client side of a real application.',
      weight: 3, from: 0, to: 3,
      slots: [
        { type: 'roadmap', terms: ['react'], count: 1 },
        { type: 'course', terms: ['react', 'front end libraries'], count: 1 },
        { type: 'video', terms: ['react', 'next.js'], count: 2 },
        { type: 'repo', terms: ['react', 'next'], count: 2 },
      ],
    },
    {
      title: 'Servers, APIs and databases',
      objective: 'Build the other half: an HTTP API on Node, a SQL database, and the way they talk to your front end.',
      weight: 5, from: 0, to: 3,
      slots: [
        { type: 'roadmap', terms: ['nodejs', 'backend', 'sql'], count: 2 },
        { type: 'doc', terms: ['http', 'fetch', 'api', 'caching'], count: 3 },
        { type: 'course', terms: ['back end', 'node', 'sql', 'relational database', 'apis'], count: 2 },
        { type: 'video', terms: ['node', 'api', 'sql', 'postgres', 'full stack'], count: 2 },
        { type: 'question', terms: ['node.js', 'sql', 'express'], count: 2 },
      ],
    },
    {
      title: 'Security, testing and shipping',
      objective: 'Authentication, the common vulnerabilities, tests, containers and deployment.',
      weight: 3, from: 1, to: 3,
      slots: [
        { type: 'roadmap', terms: ['cyber-security', 'docker', 'qa'], count: 2 },
        { type: 'doc', terms: ['security', 'cookies', 'csp', 'service workers'], count: 3 },
        { type: 'video', terms: ['docker', 'security', 'testing', 'deployment'], count: 2 },
      ],
    },
    PROBLEM_SOLVING,
    CONTRIBUTE,
  ],
  'data-ai': [
    {
      title: 'Python and the maths behind data',
      objective: 'Python for data work, plus the algebra, statistics and probability you will rely on.',
      weight: 4, from: 0, to: 1,
      slots: [
        { type: 'roadmap', terms: ['python', 'data-analyst', 'computer-science'], count: 1 },
        { type: 'course', terms: ['python', 'algebra', 'precalculus', 'scientific computing'], count: 3 },
        { type: 'video', terms: ['python', 'cs50', 'mit'], count: 2 },
        { type: 'exercise', terms: ['python', 'fundamentals', 'strings'], count: 5 },
      ],
    },
    {
      title: 'Working with data',
      objective: 'Load, clean, query and visualise data: SQL, pandas-style analysis and charts that tell a story.',
      weight: 3, from: 0, to: 2,
      slots: [
        { type: 'roadmap', terms: ['data-analyst', 'sql', 'python-data-analysis'], count: 2 },
        { type: 'course', terms: ['data analysis', 'data visualization', 'sql', 'relational database'], count: 2 },
        { type: 'video', terms: ['data', 'sql', 'pandas'], count: 1 },
        { type: 'question', terms: ['python', 'sql', 'pandas'], count: 2 },
      ],
    },
    {
      title: 'Machine learning fundamentals',
      objective: 'Supervised and unsupervised learning, evaluation, overfitting: the ideas that every model rests on.',
      weight: 4, from: 0, to: 3,
      slots: [
        { type: 'roadmap', terms: ['machine-learning', 'ai-data-scientist'], count: 2 },
        { type: 'course', terms: ['machine learning', 'scientific computing', 'python'], count: 1 },
        { type: 'video', terms: ['machine learning', 'neural network', 'deep learning', 'data science'], count: 2 },
        { type: 'paper', terms: ['machine learning', 'deep learning', 'neural network'], count: 2 },
      ],
    },
    {
      title: 'Deep learning and language models',
      objective: 'Neural networks, transformers and LLMs: how they work, how to use them, and how to evaluate them.',
      weight: 4, from: 1, to: 3,
      slots: [
        { type: 'roadmap', terms: ['ai-engineer', 'prompt-engineering', 'mlops'], count: 2 },
        { type: 'video', terms: ['llm', 'neural network', 'transformer', 'language model', 'deep learning'], count: 2 },
        { type: 'paper', terms: ['language model', 'llm', 'transformer'], count: 3 },
        { type: 'course', terms: ['datacamp'], count: 1 },
        { type: 'repo', terms: ['llm', 'machine-learning', 'ai'], count: 2 },
      ],
    },
    PROBLEM_SOLVING,
    CONTRIBUTE,
  ],
  devops: [
    {
      title: 'Linux, the shell and Git',
      objective: 'Be at ease on a server: the command line, processes, permissions, scripting and version control.',
      weight: 4, from: 0, to: 1,
      slots: [
        { type: 'roadmap', terms: ['linux', 'shell-bash', 'git-github'], count: 2 },
        { type: 'course', terms: ['bash', 'git', 'linux', 'command line', 'nano'], count: 3 },
        { type: 'video', terms: ['linux', 'bash', 'git'], count: 1 },
        { type: 'exercise', terms: ['strings', 'fundamentals'], count: 3 },
      ],
    },
    {
      title: 'Networking and how the web is served',
      objective: 'DNS, TCP, HTTP, TLS, load balancers: what happens between a browser and your service.',
      weight: 3, from: 0, to: 2,
      slots: [
        { type: 'roadmap', terms: ['network-engineer', 'cloudflare'], count: 1 },
        { type: 'doc', terms: ['http', 'caching', 'cors'], count: 3 },
        { type: 'video', terms: ['network', 'http', 'dns'], count: 1 },
        { type: 'paper', terms: ['distributed', 'network'], count: 1 },
      ],
    },
    {
      title: 'Containers and orchestration',
      objective: 'Package applications with Docker and run them reliably with Kubernetes.',
      weight: 4, from: 0, to: 3,
      slots: [
        { type: 'roadmap', terms: ['docker', 'kubernetes'], count: 2 },
        { type: 'video', terms: ['docker', 'kubernetes'], count: 2 },
        { type: 'repo', terms: ['docker', 'kubernetes', 'devops'], count: 3 },
        { type: 'question', terms: ['docker', 'kubernetes'], count: 2 },
      ],
    },
    {
      title: 'Cloud, infrastructure as code and CI/CD',
      objective: 'Provision infrastructure from code, automate delivery and watch what you run.',
      weight: 4, from: 1, to: 3,
      slots: [
        { type: 'roadmap', terms: ['aws', 'terraform', 'devops', 'cloud-computing'], count: 3 },
        { type: 'video', terms: ['aws', 'terraform', 'ci/cd', 'cloud'], count: 2 },
        { type: 'repo', terms: ['terraform', 'ci/cd', 'monitoring', 'cloud'], count: 2 },
      ],
    },
    PROBLEM_SOLVING,
    CONTRIBUTE,
  ],
  security: [
    {
      title: 'Computing and networking foundations',
      objective: 'Operating systems, the command line and networking: you cannot defend what you do not understand.',
      weight: 4, from: 0, to: 1,
      slots: [
        { type: 'roadmap', terms: ['cyber-security', 'linux', 'network-engineer', 'computer-science'], count: 2 },
        { type: 'course', terms: ['bash', 'git', 'information security', 'introduction to'], count: 2 },
        { type: 'video', terms: ['network', 'linux', 'cs50', 'security'], count: 2 },
        { type: 'exercise', terms: ['strings', 'fundamentals'], count: 3 },
      ],
    },
    {
      title: 'Web security',
      objective: 'The vulnerabilities that matter (injection, XSS, broken authentication) and how browsers defend against them.',
      weight: 4, from: 0, to: 3,
      slots: [
        { type: 'roadmap', terms: ['cyber-security', 'api-design'], count: 1 },
        { type: 'doc', terms: ['security', 'csp', 'cors', 'cookies', 'http'], count: 5 },
        { type: 'course', terms: ['information security', 'security'], count: 1 },
        { type: 'video', terms: ['security', 'hacking', 'owasp'], count: 2 },
        { type: 'question', terms: ['security', 'xss', 'injection', 'authentication'], count: 3 },
      ],
    },
    {
      title: 'Cryptography and secure systems',
      objective: 'What encryption and hashing guarantee, and what they do not; designing systems that fail safely.',
      weight: 3, from: 1, to: 3,
      slots: [
        { type: 'video', terms: ['cryptography', 'encryption', 'security'], count: 2 },
        { type: 'paper', terms: ['security', 'cryptography', 'attack', 'survey'], count: 4 },
        { type: 'repo', terms: ['security', 'crypto', 'pentest'], count: 2 },
      ],
    },
    PROBLEM_SOLVING,
    CONTRIBUTE,
  ],
  systems: [
    {
      title: 'A systems language from scratch',
      objective: 'Memory, types and ownership: learn the language that gives you control, and write small programs with it.',
      weight: 5, from: 0, to: 2,
      slots: [
        { type: 'roadmap', terms: ['rust', 'cpp', 'golang', 'c'], count: 1 },
        { type: 'course', terms: ['$lang', 'rust', 'go', 'c++'], count: 2 },
        { type: 'video', terms: ['$lang', 'rust', 'c++', 'go'], count: 2 },
        { type: 'exercise', terms: ['$lang', 'fundamentals'], count: 5 },
      ],
    },
    {
      title: 'How computers work',
      objective: 'Processors, memory, operating systems and the cost of every abstraction.',
      weight: 3, from: 0, to: 3,
      slots: [
        { type: 'roadmap', terms: ['computer-science', 'linux'], count: 1 },
        { type: 'video', terms: ['cs50', 'operating system', 'memory', 'compiler'], count: 3 },
        { type: 'course', terms: ['bash', 'linux', 'introduction to'], count: 1 },
        { type: 'paper', terms: ['operating system', 'memory', 'compiler'], count: 2 },
      ],
    },
    {
      title: 'Concurrency and performance',
      objective: 'Threads, async, locks and the memory model: write fast programs that stay correct.',
      weight: 4, from: 1, to: 3,
      slots: [
        { type: 'video', terms: ['concurrency', 'performance', 'async', 'rust'], count: 2 },
        { type: 'paper', terms: ['concurrency', 'distributed', 'performance'], count: 3 },
        { type: 'repo', terms: ['rust', 'go', 'c++', 'systems'], count: 3 },
        { type: 'question', terms: ['rust', 'c++', 'go', 'memory'], count: 2 },
      ],
    },
    PROBLEM_SOLVING,
    CONTRIBUTE,
  ],
};
