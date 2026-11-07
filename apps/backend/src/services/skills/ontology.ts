/* A small, curated map of what there is to know and what depends on what. It is the starting point of the
   knowledge graph: topics the learner meets are matched to these concepts, unknown topics become new
   concepts, and the learner can hide any link they disagree with.
   `requires` means "you should know these first" (a prerequisite). `related` is a looser link. */

export type Area = 'foundations' | 'languages' | 'systems' | 'web' | 'data' | 'ai' | 'tools' | 'graphics' | 'security' | 'practice' | 'theory' | 'general';

export interface OntologyConcept {
  slug: string;
  name: string;
  area: Area;
  description: string;
  requires?: string[];
  related?: string[];
}

export const ONTOLOGY: OntologyConcept[] = [
  // foundations
  { slug: 'programming-basics', name: 'Programming fundamentals', area: 'foundations', description: 'Variables, conditions, loops and functions: the ideas every language shares.' },
  { slug: 'data-structures', name: 'Data structures', area: 'foundations', description: 'Ways to organise data: arrays, lists, stacks, queues, trees and hash tables.', requires: ['programming-basics'] },
  { slug: 'algorithms', name: 'Algorithms', area: 'foundations', description: 'Step-by-step methods to solve problems, and how to compare them.', requires: ['programming-basics'] },
  { slug: 'complexity', name: 'Complexity (Big-O)', area: 'theory', description: 'How the cost of an algorithm grows with the size of its input.', requires: ['algorithms'] },
  { slug: 'recursion', name: 'Recursion', area: 'foundations', description: 'Solving a problem by solving smaller copies of it.', requires: ['programming-basics'] },
  { slug: 'sorting', name: 'Sorting', area: 'foundations', description: 'Putting data in order, and the trade-offs between the usual methods.', requires: ['algorithms', 'data-structures'] },
  { slug: 'graphs', name: 'Graphs', area: 'theory', description: 'Nodes and links: paths, search, connectivity and shortest routes.', requires: ['data-structures', 'algorithms'] },
  { slug: 'dynamic-programming', name: 'Dynamic programming', area: 'theory', description: 'Reusing the answers to sub-problems instead of recomputing them.', requires: ['recursion', 'complexity'] },
  { slug: 'strings', name: 'Strings', area: 'foundations', description: 'Text as data: building, searching, formatting and encoding.', requires: ['programming-basics'] },
  { slug: 'mathematics', name: 'Mathematics for programmers', area: 'theory', description: 'The maths that programming leans on most.' },
  { slug: 'linear-algebra', name: 'Linear algebra', area: 'theory', description: 'Vectors, matrices and transformations.', requires: ['mathematics'] },
  { slug: 'statistics', name: 'Statistics & probability', area: 'theory', description: 'Describing data and reasoning with uncertainty.', requires: ['mathematics'] },
  // languages
  { slug: 'c', name: 'C', area: 'languages', description: 'A small, low-level language close to the machine: the base of most systems code.', requires: ['programming-basics'] },
  { slug: 'cpp', name: 'C++', area: 'languages', description: 'C with classes, templates and a large standard library.', requires: ['c', 'object-oriented'] },
  { slug: 'python', name: 'Python', area: 'languages', description: 'A readable general-purpose language, popular in data and AI.', requires: ['programming-basics'] },
  { slug: 'javascript', name: 'JavaScript', area: 'languages', description: 'The language of the web, in the browser and on servers.', requires: ['programming-basics'] },
  { slug: 'typescript', name: 'TypeScript', area: 'languages', description: 'JavaScript with types.', requires: ['javascript'] },
  { slug: 'rust', name: 'Rust', area: 'languages', description: 'A systems language that guarantees memory safety without a garbage collector.', requires: ['programming-basics', 'memory-management'] },
  { slug: 'go', name: 'Go', area: 'languages', description: 'A simple, fast language built for servers and concurrency.', requires: ['programming-basics'] },
  { slug: 'java', name: 'Java', area: 'languages', description: 'A widely used object-oriented language on the JVM.', requires: ['object-oriented'] },
  { slug: 'sql', name: 'SQL', area: 'languages', description: 'The language to query and change relational databases.', requires: ['databases'] },
  // systems
  { slug: 'unix', name: 'Unix & Linux', area: 'systems', description: 'The operating-system family behind servers, phones and most developer tools.' },
  { slug: 'shell', name: 'Shell & command line', area: 'tools', description: 'Working with the terminal: commands, pipes, scripts.', requires: ['unix'] },
  { slug: 'pointers', name: 'Pointers', area: 'systems', description: 'Variables that hold the address of other data.', requires: ['c'] },
  { slug: 'memory-management', name: 'Memory management', area: 'systems', description: 'How programs get, use and give back memory.', requires: ['pointers'] },
  { slug: 'system-calls', name: 'System calls', area: 'systems', description: 'How a program asks the operating system to do things: files, processes, network.', requires: ['unix', 'c'] },
  { slug: 'processes', name: 'Processes', area: 'systems', description: 'Running programs: creating, waiting for and replacing them.', requires: ['system-calls'] },
  { slug: 'pipes', name: 'Pipes & redirections', area: 'systems', description: 'Connecting the output of one process to the input of another.', requires: ['processes'] },
  { slug: 'signals', name: 'Signals', area: 'systems', description: 'Asynchronous messages the system sends to processes.', requires: ['processes'] },
  { slug: 'threads', name: 'Threads', area: 'systems', description: 'Several flows of execution inside one process.', requires: ['processes'] },
  { slug: 'concurrency', name: 'Concurrency', area: 'systems', description: 'Doing several things at once safely: races, locks, ordering.', requires: ['threads'] },
  { slug: 'operating-systems', name: 'Operating systems', area: 'systems', description: 'Scheduling, memory, files and devices: what sits under your programs.', requires: ['processes', 'memory-management'] },
  { slug: 'dynamic-libraries', name: 'Dynamic libraries', area: 'systems', description: 'Code loaded at run time: shared objects, plugins, linking.', requires: ['c', 'operating-systems'] },
  { slug: 'networking', name: 'Networking', area: 'systems', description: 'How machines talk: addresses, protocols, packets.', requires: ['programming-basics'] },
  { slug: 'sockets', name: 'Sockets', area: 'systems', description: 'The programming interface to the network.', requires: ['networking', 'system-calls'] },
  { slug: 'tcp', name: 'TCP', area: 'systems', description: 'Reliable, ordered connections.', requires: ['networking'] },
  { slug: 'udp', name: 'UDP', area: 'systems', description: 'Fast, connectionless messages with no delivery guarantee.', requires: ['networking'] },
  { slug: 'distributed-systems', name: 'Distributed systems', area: 'systems', description: 'Software spread over many machines: failure, replication, consensus.', requires: ['networking', 'concurrency'] },
  // tools & practice
  { slug: 'git', name: 'Git', area: 'tools', description: 'Version control: history, branches and working with others.' },
  { slug: 'make', name: 'Build systems & Make', area: 'tools', description: 'Automating how a project is compiled and assembled.', requires: ['shell'] },
  { slug: 'debugging', name: 'Debugging', area: 'tools', description: 'Finding and fixing faults: debuggers, logs, memory tools.', requires: ['programming-basics'] },
  { slug: 'testing', name: 'Testing', area: 'practice', description: 'Checking that software does what it should: unit, integration, end-to-end.', requires: ['programming-basics'] },
  { slug: 'software-engineering', name: 'Software engineering', area: 'practice', description: 'Building software as a team: design, review, delivery.', requires: ['git', 'testing'] },
  { slug: 'agile', name: 'Agile', area: 'practice', description: 'Working in short cycles with feedback: Scrum, Kanban.', requires: ['software-engineering'] },
  { slug: 'product', name: 'Product thinking', area: 'practice', description: 'Choosing what to build for whom, and checking it was worth it.', requires: ['software-engineering'] },
  { slug: 'devops', name: 'DevOps', area: 'tools', description: 'Shipping and running software: automation, deployment, monitoring.', requires: ['shell', 'git'] },
  { slug: 'docker', name: 'Docker & containers', area: 'tools', description: 'Packaging software with what it needs to run.', requires: ['devops', 'unix'] },
  { slug: 'kubernetes', name: 'Kubernetes', area: 'tools', description: 'Running and scaling containers on a cluster.', requires: ['docker'] },
  { slug: 'cloud', name: 'Cloud', area: 'tools', description: 'Renting infrastructure and services on demand.', requires: ['devops', 'networking'] },
  // objects & design
  { slug: 'object-oriented', name: 'Object-oriented programming', area: 'foundations', description: 'Organising code around objects: classes, inheritance, polymorphism.', requires: ['programming-basics'] },
  { slug: 'templates', name: 'Templates & generics', area: 'languages', description: 'Writing code once for many types.', requires: ['cpp', 'object-oriented'] },
  { slug: 'stl', name: 'The C++ standard library', area: 'languages', description: 'Containers, iterators and algorithms that ship with C++.', requires: ['cpp', 'data-structures'] },
  { slug: 'design-patterns', name: 'Design patterns', area: 'practice', description: 'Proven solutions to recurring design problems.', requires: ['object-oriented'] },
  { slug: 'architecture', name: 'Software architecture', area: 'practice', description: 'How a system is divided into parts and how they fit together.', requires: ['design-patterns', 'software-engineering'] },
  // web
  { slug: 'http', name: 'HTTP', area: 'web', description: 'The protocol of the web: requests, responses, methods and status codes.', requires: ['networking'] },
  { slug: 'html', name: 'HTML', area: 'web', description: 'The structure of web pages.' },
  { slug: 'css', name: 'CSS', area: 'web', description: 'Styling and laying out web pages.', requires: ['html'] },
  { slug: 'web', name: 'Web development', area: 'web', description: 'Building sites and web applications, front and back.', requires: ['http', 'html', 'javascript'] },
  { slug: 'react', name: 'React', area: 'web', description: 'A library for building user interfaces from components.', requires: ['javascript', 'web'] },
  { slug: 'api', name: 'APIs', area: 'web', description: 'Interfaces that let programs talk to each other.', requires: ['http'] },
  { slug: 'oauth', name: 'OAuth', area: 'security', description: 'Letting an app act for a user on another service without their password.', requires: ['api', 'security'] },
  { slug: 'mobile', name: 'Mobile development', area: 'web', description: 'Apps for phones and tablets.', requires: ['programming-basics'] },
  { slug: 'databases', name: 'Databases', area: 'data', description: 'Storing and querying data reliably.', requires: ['programming-basics'] },
  { slug: 'data-engineering', name: 'Data engineering', area: 'data', description: 'Moving, cleaning and organising data at scale.', requires: ['databases', 'python'] },
  // graphics & games
  { slug: 'graphics', name: 'Graphics', area: 'graphics', description: 'Drawing: pixels, sprites, rendering.', requires: ['programming-basics', 'mathematics'] },
  { slug: 'csfml', name: 'CSFML', area: 'graphics', description: 'The C binding of the SFML multimedia library.', requires: ['c', 'graphics'] },
  { slug: 'sfml', name: 'SFML', area: 'graphics', description: 'A C++ multimedia library for windows, graphics, sound and input.', requires: ['cpp', 'graphics'] },
  { slug: 'game-development', name: 'Game development', area: 'graphics', description: 'The game loop, input, state and rendering of interactive games.', requires: ['graphics', 'object-oriented'] },
  { slug: '3d', name: '3D graphics', area: 'graphics', description: 'Models, cameras, lighting and transformations in three dimensions.', requires: ['graphics', 'linear-algebra'] },
  { slug: 'ray-tracing', name: 'Ray tracing', area: 'graphics', description: 'Rendering by following rays of light through a scene.', requires: ['3d', 'cpp'] },
  { slug: 'multiplayer', name: 'Multiplayer networking', area: 'graphics', description: 'Keeping many players in the same game state.', requires: ['networking', 'game-development'] },
  // ai & security
  { slug: 'machine-learning', name: 'Machine learning', area: 'ai', description: 'Learning patterns from data to predict or decide.', requires: ['python', 'statistics', 'linear-algebra'] },
  { slug: 'deep-learning', name: 'Deep learning', area: 'ai', description: 'Learning with many-layered neural networks.', requires: ['machine-learning'] },
  { slug: 'artificial-intelligence', name: 'Artificial intelligence', area: 'ai', description: 'Making software that perceives, reasons and acts.', requires: ['algorithms'] },
  { slug: 'security', name: 'Security', area: 'security', description: 'Protecting systems and data from misuse.', requires: ['networking'] },
  { slug: 'cryptography', name: 'Cryptography', area: 'security', description: 'Keeping information secret and verifiable.', requires: ['security', 'mathematics'] },
];

/** Names people use for the same thing, mapped to the concept's slug. */
export const ALIASES: Record<string, string> = {
  oop: 'object-oriented', 'object oriented': 'object-oriented', 'c++': 'cpp', 'c#': 'csharp', js: 'javascript', ts: 'typescript', ml: 'machine-learning', ai: 'artificial-intelligence',
  'artificial intelligence': 'artificial-intelligence', 'machine learning': 'machine-learning', 'deep learning': 'deep-learning', 'linear algebra': 'linear-algebra', 'data structures': 'data-structures',
  'game dev': 'game-development', 'game development': 'game-development', 'system calls': 'system-calls', 'memory leaks': 'memory-management', memory: 'memory-management', 'ray tracing': 'ray-tracing',
  'dynamic libraries': 'dynamic-libraries', 'software engineering': 'software-engineering', 'design patterns': 'design-patterns', 'distributed systems': 'distributed-systems', 'data engineering': 'data-engineering',
  'command line': 'shell', bash: 'shell', containers: 'docker', k8s: 'kubernetes', 'version control': 'git', maths: 'mathematics', math: 'mathematics', 'big-o': 'complexity', 'big o': 'complexity',
  pthreads: 'threads', mutex: 'concurrency', synchronisation: 'concurrency', sockets: 'sockets', makefile: 'make', gdb: 'debugging', valgrind: 'debugging', rest: 'api', apis: 'api', stdlib: 'stl',
  'dynamic programming': 'dynamic-programming', 'programming': 'programming-basics', 'ci/cd': 'devops', agile: 'agile', scrum: 'agile', crypto: 'cryptography', 'frontend': 'web', 'backend': 'web',
};

/** The slug a topic maps to: an alias, or the topic itself made safe ("C++" -> "cpp"). */
export function conceptSlug(topic: string): string {
  const t = topic.toLowerCase().replace(/\s+/g, ' ').trim();
  if (ALIASES[t]) return ALIASES[t]!;
  return t.replace(/\+/g, 'p').replace(/#/g, 'sharp').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export const titleCase = (s: string) => s.replace(/[-_]+/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase()).slice(0, 80);

export const bySlug = new Map(ONTOLOGY.map((c) => [c.slug, c]));
