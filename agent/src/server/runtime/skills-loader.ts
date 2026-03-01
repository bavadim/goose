import fs from "node:fs";
import path from "node:path";

type SkillSource = {
  rootDir: string;
  scope: "working_dir" | "settings_dir";
};

type SkillsLoadResult = {
  mergedInstructions: string;
  warnings: string[];
};

const listSkillFiles = (rootDir: string): string[] => {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(rootDir, entry.name, "SKILL.md"))
    .filter((skillFile) => fs.existsSync(skillFile));
};

const readSkillSafe = (skillFile: string): string | null => {
  try {
    return fs.readFileSync(skillFile, "utf8").trim();
  } catch {
    return null;
  }
};

export const loadSkillsInstructions = (
  workingDir: string,
  settingsDir: string,
): SkillsLoadResult => {
  const warnings: string[] = [];
  const sources: SkillSource[] = [
    { rootDir: path.join(settingsDir, "skills"), scope: "settings_dir" },
    {
      rootDir: path.join(workingDir, ".codex", "skills"),
      scope: "working_dir",
    },
  ];
  const byName = new Map<
    string,
    { scope: SkillSource["scope"]; body: string }
  >();

  for (const source of sources) {
    const skillFiles = listSkillFiles(source.rootDir);
    for (const skillFile of skillFiles) {
      const skillName = path.basename(path.dirname(skillFile));
      const body = readSkillSafe(skillFile);
      if (!body) {
        warnings.push(`skill_load_failed:${source.scope}:${skillName}`);
        continue;
      }
      byName.set(skillName, { scope: source.scope, body });
    }
  }

  const merged = [...byName.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) =>
      `# skill:${name} (${value.scope})\n${value.body}`.trim(),
    )
    .join("\n\n");

  return {
    mergedInstructions: merged,
    warnings,
  };
};
