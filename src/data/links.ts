// Profile links, kept in one place so the page, the shell and the old template pages agree
export const GITHUB_URL = 'https://github.com/jogee489';
export const LINKEDIN_URL = 'https://www.linkedin.com/in/jjdorko';
export const RESUME_URL = 'https://docs.google.com/document/d/1FB6sleJ1ML4Hoe_g6wiSWh8CZVqXwje7lVZqr0MkE-M/edit?usp=sharing';

/** a link as it reads in text: no scheme, no www */
export const bare = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '');
