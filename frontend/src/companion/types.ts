export type MilestoneCategory =
  | "Big Picture"
  | "Game Basics"
  | "Game Rules"
  | "Problems & Tests"
  | "Scores"
  | "Web Server"
  | "Database"
  | "Code Runner"
  | "Screen & Network"
  | "Teammates"
  | "Live Connections";

export interface CodeAnnotation {
  line: number;
  label: string;
  detail: string;
}

export interface RealSnippet {
  title: string;
  filePath: string;
  lines: string;
  language: "typescript" | "json" | "bash";
  code: string;
  annotations?: CodeAnnotation[];
  whyItMatters: string;
}

export interface CBridge {
  cConcept: string;
  tsConcept: string;
  cComparison: string;
  whyDiffer: string;
}

export interface TestGuide {
  terminalCommand: string;
  testFile: string;
  whatItAsserts: string;
  commonFailure: {
    symptom: string;
    diagnostic: string;
    fix: string;
  };
}

export interface ArchitectureFlowStep {
  actor: string;
  action: string;
  payload: string;
  invariant: string;
}

export interface FileScaffold {
  folderPath: string;
  createCommand: string;
  targetFile: string;
  purpose: string;
  starterBoilerplate: string;
}

export interface MilestoneGuide {
  id: string; // "M00", "M01", etc.
  act: string; // "Part 1: The Basic Game", etc.
  title: string;
  subtitle: string;
  category: MilestoneCategory;
  prerequisites: string[];
  
  // The What & The Why (in easy plain English)
  theWhat: string;
  theWhy: string;
  keyInvariant: string;
  catastrophicFailureIfOmitted: string;

  // Real Code Snippets from Code Arena
  snippets: RealSnippet[];

  // What to create in your IDE (File & folder scaffold)
  scaffold?: FileScaffold;

  // C to TypeScript Bridge
  cBridge?: CBridge;

  // Verification in your local IDE
  testGuide: TestGuide;

  // Visual Architecture Flow
  dataFlow: ArchitectureFlowStep[];
}

export interface ReferenceFileSummary {
  filePath: string;
  subsystem: "Game Basics" | "Game Engine" | "Code Runner" | "Web Server" | "Screen & Network";
  purpose: string;
  keyExports: string[];
  invariants: string[];
  snippet: string;
}
