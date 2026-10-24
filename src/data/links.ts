// Profile links, kept in one place so the page, the shell and the old template pages agree
export const GITHUB_URL = 'https://github.com/jogee489';
export const LINKEDIN_URL = 'https://www.linkedin.com/in/jjdorko';
// Built from the résumé Google Doc on every deploy, without the phone number; see scripts/resume.ts
export const RESUME_URL = '/resume.pdf';
export const RESUME_FILE = 'JJ-Dorko-Resume.pdf';

/** a link as it reads in text: no scheme, no www */
export const bare = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '');
