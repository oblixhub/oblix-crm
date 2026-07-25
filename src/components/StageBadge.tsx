import type { Stage } from "../types";

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span className={`stage-badge stage-${stage.toLowerCase()}`}>
      <i />
      {stage}
    </span>
  );
}
