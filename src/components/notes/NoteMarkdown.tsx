import React from "react";
import type { Note } from "../../types/note";
import type { Task } from "../../types/task";

/** Raw HTML stays text; only HTTP(S) URLs become external links. */
export function NoteMarkdown({
  body,
  notes,
  tasks,
  onNote,
  onTask,
}: {
  body: string;
  notes: Note[];
  tasks: Task[];
  onNote: (id: string) => void;
  onTask: (id: string) => void;
}) {
  const inline = (line: string): React.ReactNode[] =>
    line
      .split(
        /(\[\[(?:note|task):[a-zA-Z0-9_-]{1,200}\]\]|\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^\s)]+\))/g,
      )
      .map((part, index) => {
        const ref = part.match(/^\[\[(note|task):([a-zA-Z0-9_-]+)\]\]$/);
        if (ref) {
          const target =
            ref[1] === "note"
              ? notes.find((n) => n.id === ref[2] && !n.deletedAt)
              : tasks.find((t) => t.id === ref[2] && !t.deletedAt);
          return (
            <button
              key={index}
              type="button"
              className="note-reference"
              disabled={!target}
              onClick={() =>
                ref[1] === "note" ? onNote(ref[2]) : onTask(ref[2])
              }
            >
              {target?.title || "Unavailable reference"}
            </button>
          );
        }
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("`") && part.endsWith("`"))
          return <code key={index}>{part.slice(1, -1)}</code>;
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link && /^https?:\/\//i.test(link[2]))
          return (
            <a
              key={index}
              href={link[2]}
              target="_blank"
              rel="noopener noreferrer"
            >
              {link[1]}
            </a>
          );
        return part;
      });
  const result: React.ReactNode[] = [];
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const code: string[] = [];
      while (++i < lines.length && !lines[i].startsWith("```"))
        code.push(lines[i]);
      result.push(
        <pre key={i}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
    } else if (/^#{1,3} /.test(line)) {
      const level = line.match(/^#+/)![0].length;
      const Tag = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
      result.push(<Tag key={i}>{inline(line.slice(level + 1))}</Tag>);
    } else if (/^- \[[ xX]\] /.test(line))
      result.push(
        <p key={i} className="note-check">
          <span
            aria-label={line[3].toLowerCase() === "x" ? "Checked" : "Unchecked"}
          >
            {line[3].toLowerCase() === "x" ? "☑" : "☐"}
          </span>
          {inline(line.slice(6))}
        </p>,
      );
    else if (/^[-*] /.test(line))
      result.push(
        <p key={i} className="note-bullet">
          <span aria-hidden="true">•</span>
          {inline(line.slice(2))}
        </p>,
      );
    else if (line.trim()) result.push(<p key={i}>{inline(line)}</p>);
    else result.push(<div key={i} className="note-space" />);
  }
  return <div className="note-markdown">{result}</div>;
}
