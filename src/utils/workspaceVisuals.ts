import type { MediaAsset } from "../types/studio";

export const WORKSPACE_VISUAL_CATEGORIES = [
  ["recommended", "Recommended"],
  ["study-research", "Study & Research"],
  ["code-build", "Code & Build"],
  ["writing-communication", "Writing"],
  ["design-creative", "Design & Creative"],
  ["planning-reflection", "Planning"],
  ["personal-life-admin", "Personal"],
  ["focus", "Focus rooms"],
  ["all", "All images"],
] as const;

export const WORKSPACE_VISUAL_STYLES = [
  ["all", "All styles"],
  ["flowtask-original", "FlowTask original"],
  ["nature", "Cinematic nature"],
  ["architecture", "Architecture & city"],
  ["space", "Space & science"],
  ["illustration", "Illustration & editorial art"],
  ["abstract", "Abstract & geometric"],
  ["macro", "Macro & materials"],
  ["personal", "Personal uploads"],
] as const;

export type WorkspaceVisualStyle = (typeof WORKSPACE_VISUAL_STYLES)[number][0];

export type WorkspaceVisualCategory = (typeof WORKSPACE_VISUAL_CATEGORIES)[number][0];
export interface WorkspaceVisualContext {
  kind: "dashboard" | "project" | "study" | "writing" | "planning" | "personal" | "code" | "design";
  projectName?: string;
  outcome?: string;
  taskTags?: string[];
}
export interface WorkspaceVisualRecommendation {
  asset: MediaAsset;
  reason: string;
  score: number;
}

const TERMS: Record<string, RegExp> = {
  "study-research": /\b(study|exam|course|lecture|learn|research|reading|algorithm|math|science|biology|thesis|school|university|homework)\b/gi,
  "code-build": /\b(code|coding|developer|development|software|api|bug|deploy|build|git|server|frontend|backend|engineering|prototype)\b/gi,
  "writing-communication": /\b(write|writing|draft|essay|email|communication|edit|editing|publish|article|voice|copy)\b/gi,
  "design-creative": /\b(design|creative|art|illustrat|draw|brand|color|colour|ceramic|sculpt|textile|architecture|visual)\b/gi,
  "planning-reflection": /\b(plan|planning|roadmap|milestone|review|reflect|weekly|calendar|priorit|schedule|organize|organise|routine|launch)\b/gi,
  "personal-life-admin": /\b(home|personal|travel|finance|budget|health|wellbeing|wellness|errand|household|meal|life admin|family)\b/gi,
};
const LABELS: Record<string, string> = {
  "study-research": "Study & Research", "code-build": "Code & Build",
  "writing-communication": "Writing & Communication", "design-creative": "Design & Creative",
  "planning-reflection": "Planning & Reflection", "personal-life-admin": "Personal & Life Admin",
};
const categoryForKind: Record<WorkspaceVisualContext["kind"], string> = {
  dashboard: "planning-reflection", project: "planning-reflection", study: "study-research",
  writing: "writing-communication", planning: "planning-reflection", personal: "personal-life-admin",
  code: "code-build", design: "design-creative",
};

function unique(values: string[]) { return [...new Set(values)]; }

/** Context matching runs only in memory. It returns suggestions, never mutates a cover. */
export function recommendWorkspaceVisuals(
  assets: MediaAsset[],
  context: WorkspaceVisualContext,
): WorkspaceVisualRecommendation[] {
  const source = [context.projectName, context.outcome, ...(context.taskTags || [])].filter(Boolean).join(" ");
  const categories = Object.entries(TERMS).map(([category, expression]) => {
    expression.lastIndex = 0;
    const matches = unique([...source.matchAll(expression)].map(match => match[0].toLowerCase()));
    return { category, matches };
  }).filter(item => item.matches.length > 0).sort((a, b) => b.matches.length - a.matches.length);
  if (!categories.length) {
    const fallback = categoryForKind[context.kind];
    return assets.filter(asset => asset.category === fallback).map(asset => ({ asset, reason: `A curated ${LABELS[fallback]} scene`, score: 1 }));
  }
  const matchByCategory = new Map(categories.map(item => [item.category, item.matches]));
  const matchedTerms = new Set(categories.flatMap(item => item.matches));
  return assets.map(asset => {
    const matches = (asset.contexts || []).filter(tag => matchedTerms.has(tag.toLowerCase()));
    const categoryMatches = matchByCategory.get(asset.category) || [];
    const score = categoryMatches.length * 4 + matches.length * 3;
    const bestTerm = matches[0] || categoryMatches[0] || categories[0]?.matches[0];
    const reason = score > 0
      ? `Matches “${bestTerm}” in this project context`
      : `Explore a different ${LABELS[asset.category] || asset.category} direction`;
    return { asset, reason, score };
  }).sort((a, b) => b.score - a.score || a.asset.title.localeCompare(b.asset.title));
}

export function workspaceVisualCategoryLabel(category: string): string {
  return LABELS[category] || category;
}

export function workspaceVisualStyleLabel(style?: string): string {
  return WORKSPACE_VISUAL_STYLES.find(([id]) => id === style)?.[1] || style || "Unspecified style";
}

/** Balance context relevance with variety; a new visitor need not learn the filters. */
export function curateWorkspaceVisuals(assets: MediaAsset[], context: WorkspaceVisualContext): WorkspaceVisualRecommendation[] {
  const ranked = recommendWorkspaceVisuals(assets, context);
  const byId = new Map(ranked.map(item => [item.asset.id, item]));
  const ordered = [...ranked, ...assets.filter(asset => !byId.has(asset.id)).map(asset => ({ asset, score: 0, reason: `Explore ${workspaceVisualStyleLabel(asset.visualStyle).toLowerCase()}` }))];
  const styles = ['flowtask-original', 'nature', 'architecture', 'illustration', 'space', 'abstract', 'macro'];
  const selected: WorkspaceVisualRecommendation[] = [];
  for (let round = 0; round < 2; round++) for (const style of styles) {
    const next = ordered.find(item => item.asset.visualStyle === style && !selected.some(chosen => chosen.asset.id === item.asset.id));
    if (next && selected.length < 12) selected.push(next);
  }
  for (const item of ordered) if (selected.length < 12 && !selected.some(chosen => chosen.asset.id === item.asset.id)) selected.push(item);
  return selected;
}
