import { experienceRequiredForLevel } from "@/game/sim/progression";

export function ExperienceBar({
  level,
  experience,
  compact = false,
}: {
  level: number;
  experience: number;
  compact?: boolean;
}) {
  const requiredExperience = experienceRequiredForLevel(level);
  const currentExperience = Math.max(0, Math.min(requiredExperience, experience));
  const percent = (currentExperience / requiredExperience) * 100;
  const filledSegments = Math.floor((percent / 100) * 20);

  return (
    <div className={`experience-meter ${compact ? "experience-meter-compact" : ""}`}>
      <div className="experience-level">LEVEL {level}</div>
      <div
        className="experience-track"
        role="progressbar"
        aria-label="Experience"
        aria-valuemin={0}
        aria-valuemax={requiredExperience}
        aria-valuenow={currentExperience}
      >
        {Array.from({ length: 20 }, (_, index) => (
          <span
            key={index}
            className={
              index < filledSegments ? "experience-segment is-filled" : "experience-segment"
            }
          />
        ))}
      </div>
      <div className="experience-count">
        {currentExperience} / {requiredExperience} EXP
      </div>
    </div>
  );
}
