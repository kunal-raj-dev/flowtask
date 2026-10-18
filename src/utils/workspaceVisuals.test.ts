import { describe, expect, it } from "vitest";
import type { MediaAsset } from "../types/studio";
import { recommendWorkspaceVisuals } from "./workspaceVisuals";

const assets: MediaAsset[] = [
  { id: "study", title: "Study scene", category: "study-research", contexts: ["study", "reading"], src: "/media/study.webp", creator: "FlowTask", license: "Original" },
  { id: "code", title: "Code scene", category: "code-build", contexts: ["code", "software"], src: "/media/code.webp", creator: "FlowTask", license: "Original" },
  { id: "plan", title: "Planning scene", category: "planning-reflection", contexts: ["planning", "project"], src: "/media/plan.webp", creator: "FlowTask", license: "Original" },
];

describe("workspace cover suggestions", () => {
  it("ranks relevant scenes using project name and existing task tags", () => {
    const result = recommendWorkspaceVisuals(assets, { kind: "project", projectName: "DSA Graph Algorithms", taskTags: ["study", "exam"] });
    expect(result[0].asset.id).toBe("study");
    expect(result[0].reason).toContain("study");
    expect(result.find(item => item.asset.id === "plan")?.score).toBeLessThan(result[0].score);
  });
  it("uses each image's own context tags to rank covers within a matching collection", () => {
    const codeScenes = [
      { ...assets[1], id: "software-studio", title: "Software Studio", contexts: ["software", "build", "developer"] },
      { ...assets[1], id: "hardware-bench", title: "Hardware Bench", contexts: ["hardware", "engineering", "build"] },
    ];
    const result = recommendWorkspaceVisuals(codeScenes, { kind: "project", projectName: "Build software API" });
    expect(result[0].asset.id).toBe("software-studio");
    expect(result[0].reason).toContain("software");
  });
  it("uses a gentle category default when no project terms match", () => {
    const result = recommendWorkspaceVisuals(assets, { kind: "dashboard" });
    expect(result.every(item => item.asset.category === "planning-reflection")).toBe(true);
  });
  it("only creates suggestions and does not mutate the source assets", () => {
    const original = structuredClone(assets);
    recommendWorkspaceVisuals(assets, { kind: "project", projectName: "API release" });
    expect(assets).toEqual(original);
  });
});
