import { useState, useEffect } from "react";
import type { ArchitectureFlowStep } from "./types.js";

export function ArchitectureTracer({ steps }: { steps: ArchitectureFlowStep[] }) {
  const [activeStep, setActiveStep] = useState(0);

  // Reset active step when steps array changes or is shorter
  useEffect(() => {
    setActiveStep(0);
  }, [steps]);

  if (!steps || steps.length === 0) return null;

  const safeIndex = activeStep >= 0 && activeStep < steps.length ? activeStep : 0;
  const currentStep = steps[safeIndex];
  if (!currentStep) return null;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-2.5">
        <span className="font-mono text-xs font-bold tracking-wider text-teal-600">
          Follow the Message Step-by-Step
        </span>
        <span className="font-mono text-xs text-neutral-400">
          Step {safeIndex + 1} of {steps.length}
        </span>
      </div>

      {/* Step Nodes */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
        {steps.map((step, idx) => {
          const isActive = idx === safeIndex;
          return (
            <button
              key={idx}
              type="button"
              className={`rounded-lg border p-3 text-left font-mono text-xs transition-colors ${
                isActive
                  ? "border-teal-600 bg-neutral-800 text-white font-bold"
                  : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700"
              }`}
              onClick={() => setActiveStep(idx)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-neutral-500">Step {idx + 1}</span>
                {isActive && <span className="text-teal-600">● Here</span>}
              </div>
              <div className="font-semibold text-neutral-200">{step.actor}</div>
              <div className="text-neutral-400 truncate">{step.action}</div>
            </button>
          );
        })}
      </div>

      {/* Active Step Details */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2 font-mono text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-white">
            Action: <span className="text-teal-600">{currentStep.action}</span>
          </span>
          <span className="rounded bg-neutral-900 px-2 py-0.5 text-neutral-300">
            Who: {currentStep.actor}
          </span>
        </div>

        <div className="text-neutral-300">
          <span className="text-neutral-500">Data Sent: </span>
          <code className="text-neutral-100">{currentStep.payload}</code>
        </div>

        <div className="border-t border-neutral-700 pt-2 text-neutral-300">
          <span className="font-bold text-teal-600">Rule to Follow: </span>
          <span>{currentStep.invariant}</span>
        </div>
      </div>
    </div>
  );
}
