import { Tool } from './swmm-types';

export interface TutorialStep {
  id: string;
  steveSpeech: string;
  instruction: string;
  highlightTool?: Tool;
  requiredAction: 'place_junction' | 'place_outfall' | 'place_conduit' | 'start_sim' | 'auto_advance';
  glowPosition?: { x: number; y: number };
  autoAdvanceMs?: number;
}

export interface TutorialState {
  active: boolean;
  currentStep: number;
  completed: boolean;
  dismissed: boolean;
}

export const INITIAL_TUTORIAL: TutorialState = {
  active: true,
  currentStep: 0,
  completed: false,
  dismissed: false,
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    steveSpeech: "Hi! I'm Steve, your drainage engineer! Let's build a drainage network together!",
    instruction: "Welcome to SWMMCRAFT! Follow Steve's instructions to learn the basics.",
    requiredAction: 'auto_advance',
    autoAdvanceMs: 4000,
  },
  {
    id: 'place_junction_1',
    steveSpeech: "Press J to select the Junction tool, then click on the map to place one!",
    instruction: "STEP 1: Place your first junction - where water collects",
    highlightTool: 'junction',
    requiredAction: 'place_junction',
    glowPosition: { x: 250, y: 300 },
  },
  {
    id: 'place_junction_2',
    steveSpeech: "Great job! Now place a second junction to the right. Water flows downhill!",
    instruction: "STEP 2: Place another junction downstream",
    highlightTool: 'junction',
    requiredAction: 'place_junction',
    glowPosition: { x: 450, y: 300 },
  },
  {
    id: 'place_outfall',
    steveSpeech: "Now press O to place an Outfall - that's where water exits the system!",
    instruction: "STEP 3: Place an outfall - the exit point for your drainage",
    highlightTool: 'outfall',
    requiredAction: 'place_outfall',
    glowPosition: { x: 650, y: 350 },
  },
  {
    id: 'connect_conduit_1',
    steveSpeech: "Press C for Conduit mode. Click the first junction, then the second to connect them with a pipe!",
    instruction: "STEP 4: Connect your first junction to the second with a pipe",
    highlightTool: 'conduit',
    requiredAction: 'place_conduit',
  },
  {
    id: 'connect_conduit_2',
    steveSpeech: "One more pipe! Connect the second junction to the outfall to complete the flow path.",
    instruction: "STEP 5: Connect the second junction to the outfall",
    highlightTool: 'conduit',
    requiredAction: 'place_conduit',
  },
  {
    id: 'start_sim',
    steveSpeech: "Your network is ready! Hit the PLAY button to make it rain!",
    instruction: "STEP 6: Press Play on the simulation controls (bottom-left) to start a storm!",
    requiredAction: 'start_sim',
  },
  {
    id: 'complete',
    steveSpeech: "You built your first drainage network! You're a natural engineer!",
    instruction: "Tutorial complete! Explore on your own or try a Challenge Level!",
    requiredAction: 'auto_advance',
    autoAdvanceMs: 5000,
  },
];

export function advanceTutorial(
  state: TutorialState,
  event: string,
  detail?: any
): TutorialState {
  if (!state.active || state.completed || state.dismissed) return state;

  const step = TUTORIAL_STEPS[state.currentStep];
  if (!step) return { ...state, completed: true, active: false };

  let shouldAdvance = false;

  switch (step.requiredAction) {
    case 'place_junction':
      if (event === 'node_added' && detail?.type === 'junction') shouldAdvance = true;
      break;
    case 'place_outfall':
      if (event === 'node_added' && detail?.type === 'outfall') shouldAdvance = true;
      break;
    case 'place_conduit':
      if (event === 'link_added') shouldAdvance = true;
      break;
    case 'start_sim':
      if (event === 'sim_started') shouldAdvance = true;
      break;
  }

  if (!shouldAdvance) return state;

  const nextStep = state.currentStep + 1;
  if (nextStep >= TUTORIAL_STEPS.length) {
    return { ...state, currentStep: nextStep, completed: true, active: false };
  }
  return { ...state, currentStep: nextStep };
}
