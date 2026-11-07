import { saveContent, type ContentInput } from '../store.js';

/* Reference material for the subjects school programmes are built on: C and Unix, the shell,
   C++, networking, graphics and games, algorithms, mathematics, software engineering. These are
   free, long-lived and well known, and very few of them have an API, so (like The Odin Project)
   they are a short curated list. Each carries `tags`, the topics it covers: they are what a
   school project's stage is matched against. Only the title, link and a short description are
   stored; the material stays on its own site. */

interface Ref {
  title: string;
  url: string;
  source: string;
  type: 'doc' | 'course';
  summary: string;
  tags: string[];
  level: 'beginner' | 'basics' | 'intermediate' | 'advanced';
}

export const FOUNDATIONS: Ref[] = [
  // --- C and Unix
  { title: "Beej's Guide to C Programming", url: 'https://beej.us/guide/bgc/', source: 'Beej', type: 'doc', level: 'basics', tags: ['c', 'pointers', 'memory', 'strings', 'structs', 'unix'], summary: 'A friendly, complete guide to C: types, pointers, strings, structs, dynamic memory and the standard library.' },
  { title: 'Learn C', url: 'https://www.learn-c.org/', source: 'learn-c.org', type: 'course', level: 'beginner', tags: ['c', 'pointers', 'strings', 'arrays', 'structs'], summary: 'Interactive lessons in your browser: variables, arrays, pointers, strings, structures and dynamic allocation.' },
  { title: 'Exercism: C track', url: 'https://exercism.org/tracks/c', source: 'Exercism', type: 'course', level: 'basics', tags: ['c', 'pointers', 'strings', 'algorithms'], summary: 'Practise C with exercises and optional mentoring, from first programs to memory management.' },
  { title: "Beej's Quick Guide to GDB", url: 'https://beej.us/guide/bggdb/', source: 'Beej', type: 'doc', level: 'basics', tags: ['c', 'debugging', 'gdb', 'unix'], summary: 'Find bugs in C programs with the GNU debugger: breakpoints, stepping, inspecting memory.' },
  { title: 'Valgrind: quick start', url: 'https://valgrind.org/docs/manual/quick-start.html', source: 'Valgrind', type: 'doc', level: 'basics', tags: ['c', 'memory', 'debugging', 'unix', 'memory leaks'], summary: 'Detect memory leaks and invalid accesses in C and C++ programs.' },
  { title: 'GNU Make manual', url: 'https://www.gnu.org/software/make/manual/make.html', source: 'GNU', type: 'doc', level: 'basics', tags: ['c', 'make', 'makefile', 'build', 'unix'], summary: 'Automate the build of a project: rules, variables, dependencies and Makefiles.' },
  { title: 'Operating Systems: Three Easy Pieces', url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/', source: 'University of Wisconsin', type: 'doc', level: 'intermediate', tags: ['operating systems', 'processes', 'threads', 'concurrency', 'memory', 'unix', 'system calls', 'files'], summary: 'A free book on how an operating system virtualises the CPU and memory, handles concurrency and stores files.' },
  { title: "Beej's Guide to Unix Interprocess Communication", url: 'https://beej.us/guide/bgipc/', source: 'Beej', type: 'doc', level: 'intermediate', tags: ['unix', 'processes', 'pipes', 'signals', 'fork', 'system calls', 'c', 'shared memory'], summary: 'Processes talking to each other: fork, pipes, FIFOs, signals, message queues and shared memory.' },
  { title: 'The Linux Command Line', url: 'https://linuxcommand.org/tlcl.php', source: 'William Shotts', type: 'doc', level: 'beginner', tags: ['shell', 'unix', 'bash', 'linux', 'files', 'command line', 'pipes'], summary: 'A free book that takes you from your first command to writing shell scripts.' },
  { title: 'The Missing Semester of Your CS Education', url: 'https://missing.csail.mit.edu/', source: 'MIT', type: 'course', level: 'basics', tags: ['shell', 'unix', 'git', 'vim', 'debugging', 'command line', 'tools'], summary: 'MIT course on the tools every programmer needs: the shell, editors, Git, debugging, profiling, build systems.' },
  { title: 'Exercism: Bash track', url: 'https://exercism.org/tracks/bash', source: 'Exercism', type: 'course', level: 'beginner', tags: ['bash', 'shell', 'unix', 'scripts'], summary: 'Learn shell scripting by solving exercises.' },
  { title: 'Pro Git', url: 'https://git-scm.com/book/en/v2', source: 'git-scm.com', type: 'doc', level: 'beginner', tags: ['git', 'version control', 'branches', 'collaboration'], summary: 'The official, free book on Git: from the basics to branching, merging and workflows with a team.' },
  { title: 'POSIX threads programming', url: 'https://hpc-tutorials.llnl.gov/posix/', source: 'Lawrence Livermore National Laboratory', type: 'doc', level: 'intermediate', tags: ['threads', 'pthreads', 'concurrency', 'c', 'mutex', 'synchronisation', 'unix'], summary: 'A clear tutorial on creating threads and protecting shared data with mutexes and condition variables.' },
  // --- networking
  { title: "Beej's Guide to Network Programming", url: 'https://beej.us/guide/bgnet/', source: 'Beej', type: 'doc', level: 'intermediate', tags: ['networking', 'sockets', 'tcp', 'udp', 'c', 'unix', 'servers', 'multiplayer'], summary: 'The classic guide to sockets in C: clients, servers, TCP, UDP and handling many connections.' },
  { title: 'Networking for Game Programmers', url: 'https://gafferongames.com/categories/game-networking/', source: 'Gaffer On Games', type: 'doc', level: 'advanced', tags: ['networking', 'udp', 'game development', 'multiplayer', 'protocols', 'c++', 'architecture'], summary: 'How real-time games send state over UDP: packets, reliability, snapshots and latency.' },
  { title: 'An overview of HTTP', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview', source: 'MDN', type: 'doc', level: 'beginner', tags: ['http', 'networking', 'web', 'api'], summary: 'What HTTP is, how requests and responses work, and the pieces of the web around it.' },
  { title: 'OAuth 2.0 Simplified', url: 'https://www.oauth.com/', source: 'oauth.com', type: 'doc', level: 'intermediate', tags: ['oauth', 'api', 'web', 'security', 'authentication'], summary: 'A readable guide to OAuth 2.0: flows, tokens and how to integrate with other services.' },
  // --- algorithms and maths
  { title: 'Algorithms by Jeff Erickson', url: 'https://jeffe.cs.illinois.edu/teaching/algorithms/', source: 'University of Illinois', type: 'doc', level: 'advanced', tags: ['algorithms', 'sorting', 'data structures', 'recursion', 'graphs', 'dynamic programming'], summary: 'A free university textbook on algorithm design and analysis.' },
  { title: 'VisuAlgo', url: 'https://visualgo.net/', source: 'VisuAlgo', type: 'course', level: 'basics', tags: ['algorithms', 'sorting', 'data structures', 'graphs', 'visualisation'], summary: 'Animations of sorting, linked lists, trees, graphs and more, to see how algorithms work.' },
  { title: 'Big-O Cheat Sheet', url: 'https://www.bigocheatsheet.com/', source: 'bigocheatsheet.com', type: 'doc', level: 'basics', tags: ['algorithms', 'complexity', 'sorting', 'data structures'], summary: 'Time and space complexity of the usual algorithms and data structures on one page.' },
  { title: 'Essence of linear algebra', url: 'https://www.3blue1brown.com/topics/linear-algebra', source: '3Blue1Brown', type: 'course', level: 'basics', tags: ['mathematics', 'linear algebra', 'matrices', 'vectors', 'graphics', 'geometry'], summary: 'A visual series that builds geometric intuition for vectors, matrices and transformations.' },
  { title: 'Linear algebra', url: 'https://www.khanacademy.org/math/linear-algebra', source: 'Khan Academy', type: 'course', level: 'basics', tags: ['mathematics', 'linear algebra', 'matrices', 'vectors'], summary: 'Free lessons and exercises on vectors, matrices and linear transformations.' },
  { title: 'The Python Tutorial', url: 'https://docs.python.org/3/tutorial/', source: 'Python.org', type: 'doc', level: 'beginner', tags: ['python', 'programming', 'data structures', 'modules'], summary: 'The official introduction to Python, from first statements to modules and classes.' },
  // --- graphics and games
  { title: 'SFML tutorials', url: 'https://www.sfml-dev.org/tutorials/2.6/', source: 'SFML', type: 'doc', level: 'basics', tags: ['graphics', 'csfml', 'sfml', 'game development', 'sprites', 'window', 'c++', 'game loop'], summary: 'Open a window, draw sprites and text, handle events and play sounds: the basics behind CSFML projects.' },
  { title: 'Game Programming Patterns', url: 'https://gameprogrammingpatterns.com/', source: 'Robert Nystrom', type: 'doc', level: 'intermediate', tags: ['game development', 'design patterns', 'game loop', 'architecture', 'c++', 'object-oriented', '3d'], summary: 'A free book on the patterns behind game code: the game loop, components, state machines and more.' },
  { title: 'Ray Tracing in One Weekend', url: 'https://raytracing.github.io/books/RayTracingInOneWeekend.html', source: 'raytracing.github.io', type: 'doc', level: 'intermediate', tags: ['graphics', 'ray tracing', 'c++', 'mathematics', 'vectors', 'rendering'], summary: 'Write a ray tracer from scratch in C++: rays, spheres, shading, materials and anti-aliasing.' },
  // --- C++ and design
  { title: 'Learn C++', url: 'https://www.learncpp.com/', source: 'learncpp.com', type: 'course', level: 'beginner', tags: ['c++', 'object-oriented', 'templates', 'stl', 'pointers', 'classes', 'memory'], summary: 'A thorough, free C++ tutorial from the basics to classes, templates and the standard library.' },
  { title: 'cppreference', url: 'https://en.cppreference.com/', source: 'cppreference.com', type: 'doc', level: 'basics', tags: ['c++', 'stl', 'templates', 'threads', 'reference', 'c'], summary: 'The reference for the C and C++ languages and their standard libraries.' },
  { title: 'C++ Core Guidelines', url: 'https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines', source: 'isocpp', type: 'doc', level: 'advanced', tags: ['c++', 'object-oriented', 'design patterns', 'memory', 'best practices', 'templates'], summary: 'Guidelines for writing modern, safe and fast C++, by Bjarne Stroustrup and Herb Sutter.' },
  { title: 'Design Patterns', url: 'https://refactoring.guru/design-patterns', source: 'Refactoring Guru', type: 'doc', level: 'intermediate', tags: ['design patterns', 'object-oriented', 'architecture', 'c++', 'software engineering'], summary: 'The classic design patterns explained with diagrams and examples, including C++.' },
  { title: 'Dynamic libraries: shared objects on Linux', url: 'https://tldp.org/HOWTO/Program-Library-HOWTO/shared-libraries.html', source: 'The Linux Documentation Project', type: 'doc', level: 'intermediate', tags: ['dynamic libraries', 'c', 'c++', 'unix', 'linking', 'plugins'], summary: 'How shared libraries are built, linked and loaded at run time (the basis of plugin systems).' },
  // --- software engineering, web, devops
  { title: 'Google Engineering Practices', url: 'https://google.github.io/eng-practices/', source: 'Google', type: 'doc', level: 'intermediate', tags: ['software engineering', 'code review', 'teamwork', 'agile', 'best practices'], summary: "How Google reviews code and writes changes: a practical guide to working well in a team." },
  { title: 'The Practical Test Pyramid', url: 'https://martinfowler.com/articles/practical-test-pyramid.html', source: 'martinfowler.com', type: 'doc', level: 'intermediate', tags: ['testing', 'software engineering', 'unit tests', 'integration tests', 'agile'], summary: 'What to test and at which level, with examples: unit, integration and end-to-end tests.' },
  { title: 'Agile Coach', url: 'https://www.atlassian.com/agile', source: 'Atlassian', type: 'doc', level: 'beginner', tags: ['agile', 'scrum', 'product', 'software engineering', 'teamwork', 'kanban'], summary: 'Scrum, kanban, sprints and backlogs explained for teams building a product.' },
  { title: 'The Twelve-Factor App', url: 'https://12factor.net/', source: '12factor.net', type: 'doc', level: 'intermediate', tags: ['software engineering', 'devops', 'cloud', 'architecture', 'deployment', 'docker'], summary: 'Twelve principles for building software that is easy to deploy and run in the cloud.' },
  { title: 'Docker: get started', url: 'https://docs.docker.com/get-started/', source: 'Docker', type: 'course', level: 'beginner', tags: ['docker', 'devops', 'containers', 'deployment', 'cloud'], summary: 'Build, run and share containers: images, volumes, networks and Compose.' },
  { title: 'Learn Kubernetes basics', url: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/', source: 'Kubernetes', type: 'course', level: 'intermediate', tags: ['kubernetes', 'cloud', 'devops', 'containers', 'deployment'], summary: 'An interactive tutorial on deploying, scaling and updating an application on a cluster.' },
  { title: 'React: learn', url: 'https://react.dev/learn', source: 'React', type: 'course', level: 'basics', tags: ['react', 'web', 'mobile', 'javascript', 'frontend', 'components'], summary: 'The official React tutorial: components, state, effects and thinking in React.' },
  { title: 'SQLBolt', url: 'https://sqlbolt.com/', source: 'SQLBolt', type: 'course', level: 'beginner', tags: ['databases', 'sql', 'queries', 'joins'], summary: 'Interactive SQL lessons: queries, joins, aggregates and modifying data.' },
  // --- security, data and AI
  { title: 'OWASP Top 10', url: 'https://owasp.org/www-project-top-ten/', source: 'OWASP', type: 'doc', level: 'basics', tags: ['security', 'web', 'api', 'vulnerabilities', 'testing'], summary: 'The ten most critical web application security risks, with how to prevent them.' },
  { title: 'The Cryptopals Crypto Challenges', url: 'https://cryptopals.com/', source: 'Cryptopals', type: 'course', level: 'advanced', tags: ['security', 'cryptography', 'cipher', 'mathematics', 'python'], summary: 'Learn cryptography by breaking real constructions, one challenge at a time.' },
  { title: 'Machine Learning Crash Course', url: 'https://developers.google.com/machine-learning/crash-course', source: 'Google', type: 'course', level: 'basics', tags: ['machine learning', 'artificial intelligence', 'python', 'data engineering', 'mathematics'], summary: "Google's fast-paced introduction to machine learning, with videos, visualisations and exercises." },
  { title: 'Practical Deep Learning for Coders', url: 'https://course.fast.ai/', source: 'fast.ai', type: 'course', level: 'intermediate', tags: ['deep learning', 'machine learning', 'python', 'artificial intelligence'], summary: 'A free, code-first course on building and deploying deep-learning models.' },
  { title: 'Distributed Systems (MIT 6.5840)', url: 'https://pdos.csail.mit.edu/6.824/', source: 'MIT', type: 'course', level: 'advanced', tags: ['distributed systems', 'architecture', 'concurrency', 'networking', 'cloud'], summary: 'Lectures, papers and labs on fault tolerance, replication and consensus.' },
];

/** Saves the curated references. Returns how many there are. */
export async function fetchFoundations(): Promise<number> {
  for (const r of FOUNDATIONS) {
    const row: ContentInput = {
      title: r.title,
      url: r.url,
      source: r.source,
      type: r.type,
      summary: r.summary,
      categories: [],
      meta: { kind: 'reference', provider: r.source, level: r.level, free: true, tags: r.tags, learn: true },
    };
    await saveContent(row);
  }
  return FOUNDATIONS.length;
}
