// Shared resume data shape for the builder + exporters.

export type BuilderResumeData = {
  personal: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    github: string;
    website: string;
    headline: string;
  };
  summary: string;
  experience: Array<{
    company: string;
    title: string;
    location: string;
    start: string;
    end: string;
    bullets: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    start: string;
    end: string;
    gpa: string;
  }>;
  projects: Array<{
    name: string;
    tech: string;
    link: string;
    description: string;
  }>;
  skills: string[];
  certifications: string[];
  achievements: string[];
};

export const EMPTY_RESUME: BuilderResumeData = {
  personal: {
    fullName: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    github: "",
    website: "",
    headline: "",
  },
  summary: "",
  experience: [],
  education: [],
  projects: [],
  skills: [],
  certifications: [],
  achievements: [],
};

export type ResumeTemplate = "ats" | "modern";
