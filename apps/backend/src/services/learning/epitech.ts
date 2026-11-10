import type { Programme } from '../../db/schema.js';

/**
 * A STARTING programme for Epitech, year by year with the projects students go through.
 *
 * It is a draft written from public sources and student-published material (some items,
 * such as Indie Studio and Zappy in the second year, are named in Epitech's own material;
 * the rest follow what the school's projects are commonly called). It is marked "draft" and
 * shown as such to learners until Epitech or an administrator checks it. The school corrects
 * it through the partner API (PUT /api/partner/curriculum) or Admin → Schools.
 */
export const EPITECH_PROGRAMME: Programme = {
  status: 'draft',
  years: [
    {
      year: 1,
      title: 'Year 1: C, Unix and the foundations',
      summary: 'An intensive start in C and the Unix shell, then algorithms, graphics and mathematics through short projects.',
      projects: [
        { name: 'Piscine: C and Unix pool', kind: 'piscine', hours: 80, summary: 'Weeks of intensive C, shell and Git before the year starts.', topics: ['c', 'unix', 'shell', 'git', 'algorithms'] },
        { name: 'my_ls and my_printf', kind: 'project', hours: 30, summary: 'Rebuild two classics of the C library and the shell: listing files and formatted output.', topics: ['c', 'unix', 'system calls', 'strings'] },
        { name: 'Minishell', kind: 'project', hours: 40, summary: 'Write a small Unix shell: parsing, processes, pipes and redirections.', topics: ['c', 'unix', 'processes', 'shell', 'pipes'] },
        { name: 'my_navy', kind: 'project', hours: 30, summary: 'A two-player battleship game where the processes talk through Unix signals.', topics: ['c', 'signals', 'unix', 'processes'] },
        { name: 'Matchstick, Bistromatic and Push_swap', kind: 'project', hours: 40, summary: 'Algorithm-flavoured projects: a game with a strategy, arithmetic on big numbers, and sorting with constraints.', topics: ['c', 'algorithms', 'sorting', 'data structures'] },
        { name: 'my_hunter and my_radar', kind: 'project', hours: 40, summary: 'Interactive graphics: a game loop, sprites and a simulation with the CSFML library.', topics: ['c', 'graphics', 'game development', 'csfml'] },
        { name: 'Mathematics seminar', kind: 'module', hours: 30, summary: 'Short mathematical projects: geometry, ciphers, matrices and sequences, solved by programming.', topics: ['mathematics', 'linear algebra', 'python', 'algorithms'] },
      ],
    },
    {
      year: 2,
      title: 'Year 2: C++, architecture and big team projects',
      summary: 'Object-oriented C++, then larger projects built in groups.',
      projects: [
        { name: 'C++ pool', kind: 'piscine', hours: 60, summary: 'An intensive return to programming, this time in object-oriented C++.', topics: ['c++', 'object-oriented', 'templates', 'stl'] },
        { name: 'Indie Studio', kind: 'project', hours: 120, summary: 'A group video game with 3D graphics, built in C++.', topics: ['c++', 'game development', 'graphics', 'object-oriented', '3d'] },
        { name: 'Zappy', kind: 'project', hours: 120, summary: 'A networked multiplayer game: a server, a graphical client and AI clients that play on their own.', topics: ['c', 'networking', 'sockets', 'artificial intelligence', 'multiplayer'] },
        { name: 'Arcade and Nanotekspice', kind: 'project', hours: 60, summary: 'Design with C++: a games platform with dynamic libraries, and a simulator of logic circuits.', topics: ['c++', 'design patterns', 'object-oriented', 'dynamic libraries'] },
        { name: 'Plazza and Raytracer', kind: 'project', hours: 60, summary: 'Concurrency with threads and processes, and rendering images by tracing rays of light.', topics: ['c++', 'threads', 'concurrency', 'graphics', 'mathematics'] },
      ],
    },
    {
      year: 3,
      title: 'Year 3: products, teamwork and an internship',
      summary: 'Larger products, the first steps of the final-year project, and a long internship.',
      projects: [
        { name: 'R-Type', kind: 'project', hours: 120, summary: 'A multiplayer shoot-them-up with its own game engine and network protocol.', topics: ['c++', 'networking', 'game development', 'udp', 'architecture'] },
        { name: 'Area: automation between web services', kind: 'project', hours: 100, summary: 'A web and mobile application that links online services with actions and reactions.', topics: ['web', 'api', 'oauth', 'docker', 'react', 'mobile'] },
        { name: 'Epitech Innovative Project (start)', kind: 'project', hours: 80, summary: 'The first phase of the long group project: choosing a product, a team and a technical plan.', topics: ['software engineering', 'agile', 'product', 'git', 'testing'] },
        { name: 'Internship', kind: 'internship', hours: 40, summary: 'A long internship: prepare for it with the tools and practices companies expect.', topics: ['software engineering', 'git', 'testing', 'devops', 'agile'] },
      ],
    },
    {
      year: 4,
      title: 'Year 4: studying abroad',
      summary: 'A year in a partner university: pick courses that complete your profile.',
      projects: [
        { name: 'Courses at a partner university', kind: 'module', hours: 80, summary: 'Choose subjects with your coordinator: these resources help you go deeper on the usual choices.', topics: ['machine learning', 'databases', 'software engineering', 'distributed systems'] },
      ],
    },
    {
      year: 5,
      title: 'Year 5: final project and specialisation',
      summary: 'The final-year group project and a specialisation of your choice.',
      projects: [
        { name: 'Epitech Innovative Project (final)', kind: 'project', hours: 150, summary: 'Deliver and defend the product built over the last years.', topics: ['software engineering', 'devops', 'testing', 'architecture', 'cloud'] },
        { name: 'Specialisation: cloud and security', kind: 'module', hours: 60, summary: 'Go deeper on running software safely at scale.', topics: ['cloud', 'security', 'kubernetes', 'devops'] },
        { name: 'Specialisation: data and AI', kind: 'module', hours: 60, summary: 'Go deeper on machine learning in practice.', topics: ['machine learning', 'deep learning', 'python', 'data engineering'] },
      ],
    },
  ],
};
