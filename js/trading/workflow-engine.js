// Canonical XE3AGLE discipline workflow sequence.
export const WORKFLOW = Object.freeze(['prepare','rules','analysis','risk','check','active','review','journal','daily']);

export function getNextWorkflowStep(currentStep) {
  const index = WORKFLOW.indexOf(currentStep);
  return index >= 0 && index < WORKFLOW.length - 1 ? WORKFLOW[index + 1] : null;
}

export function isWorkflowStep(step) {
  return WORKFLOW.includes(step);
}
